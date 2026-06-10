const prisma = require("../utils/prisma");
const axios = require("axios");
const { getResellerToken } = require("../services/voicelinkService");

const VL_RESELLER = "https://app.voicelink.co.in/api/v1/reseller";
const vlHeaders = () => ({
    Authorization: `Bearer ${getResellerToken()}`,
    "Content-Type": "application/json",
});

// Super Admin: pull DIDs from VoiceLink and upsert into local DIDNumber table
const syncDIDs = async (req, res) => {
    const { userId } = req.user;
    const token = getResellerToken();
    if (!token) return res.status(503).json({ message: "VoiceLink service not ready." });

    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found. Set up ZenCall first." });

        const cid = dbClient.clientId;
        let vlDids = [];
        let allDids = [];

        // Fetch all available DIDs from the reseller view
        try {
            const r = await axios.get(`${VL_RESELLER}/client/available-dids`, { headers: vlHeaders() });
            const raw = r.data?.data || r.data || [];
            allDids = Array.isArray(raw) ? raw : [];
            require("fs").writeFileSync("sync_debug.json", JSON.stringify(allDids, null, 2));
            // Look for DIDs explicitly belonging to this client OR marked as assigned
            vlDids = allDids.filter(d => {
                const dCid = Number(d.client_id ?? d.clientId ?? d.client_ID ?? d.client_id_label);
                const isMatch = dCid === cid;
                const isAssigned = d.user_status_label?.toLowerCase().includes("assigned") || 
                                 d.user_status_label?.toLowerCase().includes("mapped") ||
                                 d.status_label?.toLowerCase().includes("assigned") ||
                                 d.status_label?.toLowerCase().includes("mapped") ||
                                 d.status === 1 || d.is_assigned;
                
                // If it belongs to this client ID, we definitely want it
                if (isMatch) return true;
                
                // Fallback: If it is assigned and we can't find a client ID, but we know this is the only client for this user
                return isAssigned && (dCid === 0 || !dCid);
            });
        } catch (err) {
            console.error("DID Sync Strategy 1 failed:", err.message);
        }

        // Strategy 2: clients list may embed DID arrays
        if (vlDids.length === 0) {
            try {
                const r = await axios.get(`${VL_RESELLER}/clients`, { headers: vlHeaders() });
                const raw = r.data?.data || r.data?.clients || r.data || [];
                const list = Array.isArray(raw) ? raw : [];
                const match = list.find(c => Number(c.client_id ?? c.clientId ?? c.id) === cid);
                if (match) {
                    vlDids = match.dids ?? match.did_numbers ?? match.mapped_dids ?? match.did_list ?? [];
                }
            } catch { /* ignore */ }
        }

        let synced = 0;
        for (const did of vlDids) {
            const number = String(did.did_number || did.number || did.did_id || "").trim();
            const vlId = String(did.did_id || "").trim();
            const country = did.country_code || did.country ? String(did.country_code || did.country) : null;
            const type = did.type_label || did.type ? String(did.type_label || did.type) : null;
            if (!number) continue;

            await prisma.dIDNumber.upsert({
                where: { number: String(number) },
                update: { voicelinkDIDId: vlId, country, type },
                create: {
                    number,
                    voicelinkDIDId: vlId,
                    country,
                    type,
                    superAdminId: userId,
                    status: "AVAILABLE",
                },
            });
            synced++;
        }
        const all = await prisma.dIDNumber.findMany({
            where: { superAdminId: userId },
            include: {
                allocatedToAdmin: { select: { id: true, name: true, email: true } },
                assignedToEmployee: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        res.json({ message: `Synced ${synced} DID(s) from VoiceLink.`, dids: all });

    } catch (error) {
        console.error("DID Sync failed:", error);
        res.status(500).json({ 
            message: "Sync failed", 
            error: error.message,
            details: error.response?.data || null
        });
    }
};

// Super Admin: list all DIDs in the pool
const getDIDPool = async (req, res) => {
    try {
        const { userId } = req.user;
        const dids = await prisma.dIDNumber.findMany({
            where: { superAdminId: userId },
            include: {
                allocatedToAdmin: { select: { id: true, name: true, email: true } },
                assignedToEmployee: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        res.json(dids);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch DID pool", error: error.message });
    }
};

// Super Admin: allocate one or more DIDs to an admin
const allocateToAdmin = async (req, res) => {
    try {
        const { userId } = req.user;
        const { didIds, adminId } = req.body;

        if (!didIds?.length || !adminId) {
            return res.status(400).json({ message: "didIds (array) and adminId are required." });
        }

        const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } });
        if (!admin || admin.role !== "ADMIN") {
            return res.status(400).json({ message: "Target user must be an ADMIN." });
        }

        const dids = await prisma.dIDNumber.findMany({ where: { id: { in: didIds }, superAdminId: userId } });
        if (dids.length !== didIds.length) {
            return res.status(403).json({ message: "One or more DIDs not found in your pool." });
        }

        const unavailable = dids.filter(d => d.status !== "AVAILABLE");
        if (unavailable.length > 0) {
            return res.status(400).json({ message: `Cannot allocate: ${unavailable.length} DID(s) are already allocated or assigned.` });
        }

        await prisma.dIDNumber.updateMany({
            where: { id: { in: didIds } },
            data: { allocatedToAdminId: adminId, status: "ALLOCATED_TO_ADMIN", allocatedAt: new Date() },
        });

        res.json({ message: `${didIds.length} DID(s) allocated to admin successfully.` });
    } catch (error) {
        res.status(500).json({ message: "Failed to allocate DIDs", error: error.message });
    }
};

// Super Admin: reclaim a DID from an admin
const deallocateAdmin = async (req, res) => {
    try {
        const { userId } = req.user;
        const { didId } = req.params;

        const did = await prisma.dIDNumber.findUnique({ where: { id: didId } });
        if (!did) return res.status(404).json({ message: "DID not found." });
        if (did.superAdminId !== userId) return res.status(403).json({ message: "Not your DID." });
        if (did.status === "ASSIGNED_TO_EMPLOYEE") {
            return res.status(400).json({ message: "DID is assigned to an employee. Unassign the employee first." });
        }

        await prisma.dIDNumber.update({
            where: { id: didId },
            data: { allocatedToAdminId: null, status: "AVAILABLE", allocatedAt: null },
        });

        res.json({ message: "DID reclaimed from admin successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to deallocate DID", error: error.message });
    }
};

// Super Admin: per-admin DID count summary
const getAdminsSummary = async (req, res) => {
    try {
        const { userId } = req.user;
        const dids = await prisma.dIDNumber.findMany({
            where: { superAdminId: userId },
            include: { allocatedToAdmin: { select: { id: true, name: true, email: true } } },
        });

        const summary = {};
        for (const did of dids) {
            if (!did.allocatedToAdminId) continue;
            const key = did.allocatedToAdminId;
            if (!summary[key]) {
                summary[key] = { admin: did.allocatedToAdmin, total: 0, assignedToEmployees: 0, available: 0 };
            }
            summary[key].total++;
            if (did.assignedToEmployeeId) summary[key].assignedToEmployees++;
            else summary[key].available++;
        }

        res.json(Object.values(summary));
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch admins summary", error: error.message });
    }
};

// Admin: list DIDs allocated to me
const getMyAdminPool = async (req, res) => {
    try {
        const { userId } = req.user;
        const dids = await prisma.dIDNumber.findMany({
            where: { allocatedToAdminId: userId },
            include: { assignedToEmployee: { select: { id: true, name: true, email: true } } },
            orderBy: { allocatedAt: "asc" },
        });
        res.json(dids);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch admin DID pool", error: error.message });
    }
};

// Admin: assign a DID to an employee
const assignToEmployee = async (req, res) => {
    try {
        const { userId } = req.user;
        const { didId, employeeId } = req.body;

        if (!didId || !employeeId) {
            return res.status(400).json({ message: "didId and employeeId are required." });
        }

        const did = await prisma.dIDNumber.findUnique({ where: { id: didId } });
        if (!did) return res.status(404).json({ message: "DID not found." });
        if (did.allocatedToAdminId !== userId) return res.status(403).json({ message: "This DID is not in your pool." });
        if (did.status === "ASSIGNED_TO_EMPLOYEE") {
            return res.status(400).json({ message: "This DID is already assigned to an employee." });
        }

        const alreadyHas = await prisma.dIDNumber.findUnique({ where: { assignedToEmployeeId: employeeId } });
        if (alreadyHas) {
            return res.status(400).json({ message: "This employee already has a DID assigned. Unassign it first." });
        }

        await prisma.dIDNumber.update({
            where: { id: didId },
            data: { assignedToEmployeeId: employeeId, status: "ASSIGNED_TO_EMPLOYEE", assignedAt: new Date() },
        });

        res.json({ message: "DID assigned to employee successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to assign DID to employee", error: error.message });
    }
};

// Admin: remove DID from an employee
const unassignEmployee = async (req, res) => {
    try {
        const { userId } = req.user;
        const { didId } = req.params;

        const did = await prisma.dIDNumber.findUnique({ where: { id: didId } });
        if (!did) return res.status(404).json({ message: "DID not found." });
        if (did.allocatedToAdminId !== userId) return res.status(403).json({ message: "This DID is not in your pool." });

        await prisma.dIDNumber.update({
            where: { id: didId },
            data: { assignedToEmployeeId: null, status: "ALLOCATED_TO_ADMIN", assignedAt: null },
        });

        res.json({ message: "DID unassigned from employee successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to unassign DID", error: error.message });
    }
};

// Admin: get employees in the same workspace for assignment
const getAssignableEmployees = async (req, res) => {
    try {
        const { userId } = req.user;
        const admin = await prisma.user.findUnique({ where: { id: userId }, select: { workspaceId: true } });

        const employees = await prisma.user.findMany({
            where: {
                role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
                isActive: true,
                ...(admin?.workspaceId ? { workspaceId: admin.workspaceId } : {}),
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        });

        const assignedDIDs = await prisma.dIDNumber.findMany({
            where: { assignedToEmployeeId: { in: employees.map(e => e.id) } },
            select: { assignedToEmployeeId: true, number: true },
        });

        const didMap = {};
        for (const d of assignedDIDs) {
            if (d.assignedToEmployeeId) didMap[d.assignedToEmployeeId] = d.number;
        }

        res.json(employees.map(e => ({ ...e, assignedDID: didMap[e.id] || null })));
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch employees", error: error.message });
    }
};

// Super Admin: get all ADMIN users available for DID allocation
const getWorkspaceAdmins = async (req, res) => {
    try {
        const { userId } = req.user;
        const superAdmin = await prisma.user.findUnique({ where: { id: userId }, select: { workspaceId: true } });

        const admins = await prisma.user.findMany({
            where: {
                role: "ADMIN",
                isActive: true,
                ...(superAdmin?.workspaceId ? { workspaceId: superAdmin.workspaceId } : {}),
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        });

        const didCounts = await prisma.dIDNumber.groupBy({
            by: ["allocatedToAdminId"],
            where: { allocatedToAdminId: { in: admins.map(a => a.id) } },
            _count: { id: true },
        });

        const countMap = {};
        for (const row of didCounts) {
            if (row.allocatedToAdminId) countMap[row.allocatedToAdminId] = row._count.id;
        }

        res.json(admins.map(a => ({ ...a, didCount: countMap[a.id] || 0 })));
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch admin users", error: error.message });
    }
};

// Employee / Team Lead / Admin: get my assigned DID
const getMyDID = async (req, res) => {
    try {
        const { userId } = req.user;
        const did = await prisma.dIDNumber.findUnique({
            where: { assignedToEmployeeId: userId },
            select: { id: true, number: true, status: true, assignedAt: true },
        });
        res.json({ did: did || null });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch your DID", error: error.message });
    }
};

module.exports = {
    syncDIDs,
    getDIDPool,
    allocateToAdmin,
    deallocateAdmin,
    getAdminsSummary,
    getWorkspaceAdmins,
    getMyAdminPool,
    assignToEmployee,
    unassignEmployee,
    getAssignableEmployees,
    getMyDID,
};
