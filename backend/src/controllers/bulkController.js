const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");

const bulkUpdateLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, status } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Invalid lead IDs" });
        }

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { status }
        });

        // Log batch activity
        // Ideally we generate one log per lead or a batch log. 
        // For performance, we'll just log a generic batch action or loop async.
        // Let's loop async for better audit trails.
        for (const id of leadIds) {
            await logActivity({
                leadId: id,
                userId,
                action: "LEAD_BULK_UPDATE",
                metadata: { newStatus: status }
            });
        }

        res.json({ message: `Updated ${result.count} leads successfully`, count: result.count });
    } catch (error) {
        res.status(500).json({ message: "Error bulk updating leads", error: error.message });
    }
};

const bulkAssignLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, assignedToId } = req.body;

        if (!leadIds || !assignedToId) {
            return res.status(400).json({ message: "Lead IDs and Assignee ID are required" });
        }

        // Check if any leads are unqualified
        const unqualified = await prisma.lead.findMany({
            where: { id: { in: leadIds }, score: { lt: 25 } }
        });
        if (unqualified.length > 0) {
            return res.status(400).json({ message: `${unqualified.length} leads are unqualified (Score < 25) and cannot be assigned to sales.` });
        }

        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee) return res.status(404).json({ message: "User not found" });

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { assignedToId }
        });

        for (const id of leadIds) {
            await logActivity({
                leadId: id,
                userId,
                action: "LEAD_BULK_ASSIGN",
                metadata: { assignedTo: assignee.name }
            });
        }

        res.json({ message: `Assigned ${result.count} leads to ${assignee.name}`, count: result.count });
    } catch (error) {
        res.status(500).json({ message: "Error bulk assigning leads", error: error.message });
    }
};

const bulkDistributeLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, userIds, distributions } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Invalid lead IDs" });
        }

        // Check if any leads are unqualified
        const unqualified = await prisma.lead.findMany({
            where: { id: { in: leadIds }, score: { lt: 25 } }
        });
        if (unqualified.length > 0) {
            return res.status(400).json({ message: "Some selected leads have a score below 25. Only leads with 25+ score can be assigned to sales." });
        }

        let results = [];

        if (distributions && Array.isArray(distributions) && distributions.length > 0) {
            // Specific distribution
            let currentLeadIndex = 0;
            for (const dist of distributions) {
                const { userId: targetUserId, count } = dist;
                const numToAssign = parseInt(count);
                if (isNaN(numToAssign) || numToAssign <= 0) continue;

                const leadsToAssign = leadIds.slice(currentLeadIndex, currentLeadIndex + numToAssign);
                currentLeadIndex += numToAssign;

                if (leadsToAssign.length === 0) break;

                const assignee = await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } });

                const batchPromises = leadsToAssign.map(async (leadId) => {
                    const updatedLead = await prisma.lead.update({
                        where: { id: leadId },
                        data: { assignedToId: targetUserId }
                    });

                    await logActivity({
                        leadId,
                        userId,
                        action: "LEAD_BULK_DISTRIBUTE",
                        metadata: { assignedTo: assignee?.name || "Unknown User" }
                    });

                    return updatedLead;
                });

                const batchResults = await Promise.all(batchPromises);
                results = [...results, ...batchResults];
            }
        } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
            // Round-robin distribution
            const updatePromises = leadIds.map(async (leadId, index) => {
                const assignedToId = userIds[index % userIds.length];

                // Get assignee name for logging
                const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { name: true } });

                const updatedLead = await prisma.lead.update({
                    where: { id: leadId },
                    data: { assignedToId }
                });

                await logActivity({
                    leadId,
                    userId,
                    action: "LEAD_BULK_DISTRIBUTE",
                    metadata: { assignedTo: assignee?.name || "Unknown User" }
                });

                return updatedLead;
            });

            results = await Promise.all(updatePromises);
        } else {
            return res.status(400).json({ message: "Invalid distribution parameters" });
        }

        res.json({ message: `Distributed ${results.length} leads successfully`, count: results.length });
    } catch (error) {
        res.status(500).json({ message: "Error distributing leads", error: error.message });
    }
};

const bulkAutoRouteLeads = async (req, res) => {
    try {
        const { leadIds } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Invalid lead IDs" });
        }

        const { bulkRouteLeads } = require("../utils/leadRouter");
        await bulkRouteLeads(leadIds);

        res.json({ message: `Successfully routed ${leadIds.length} leads.` });
    } catch (error) {
        res.status(500).json({ message: "Error bulk routing leads", error: error.message });
    }
};

// Distribute leads evenly across all active members of a department (round-robin)
const bulkDistributeByDepartment = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadIds, departmentId } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Invalid lead IDs" });
        }
        if (!departmentId) {
            return res.status(400).json({ message: "Department ID is required" });
        }

        // Validate department belongs to caller's workspace
        const { workspaceId } = req.user;
        const dept = await prisma.department.findFirst({
            where: { id: departmentId, ...(workspaceId ? { workspaceId } : {}) },
        });
        if (!dept) {
            return res.status(404).json({ message: "Department not found" });
        }

        const members = await prisma.user.findMany({
            where: { departmentId, isActive: true },
            select: { id: true, name: true },
        });

        if (members.length === 0) {
            return res.status(400).json({ message: "No active members in this department" });
        }

        const unqualified = await prisma.lead.findMany({
            where: { id: { in: leadIds }, score: { lt: 25 } },
        });
        if (unqualified.length > 0) {
            return res.status(400).json({
                message: `${unqualified.length} leads are unqualified (score < 25) and cannot be assigned.`,
            });
        }

        const results = await Promise.all(
            leadIds.map(async (leadId, index) => {
                const assignee = members[index % members.length];
                const updated = await prisma.lead.update({
                    where: { id: leadId },
                    data: { assignedToId: assignee.id },
                });
                await logActivity({
                    leadId,
                    userId,
                    action: "LEAD_BULK_DISTRIBUTE",
                    metadata: { assignedTo: assignee.name, method: "department" },
                });
                return updated;
            })
        );

        res.json({ message: `Distributed ${results.length} leads across ${members.length} members`, count: results.length });
    } catch (error) {
        res.status(500).json({ message: "Error distributing leads by department", error: error.message });
    }
};

module.exports = { bulkUpdateLeads, bulkAssignLeads, bulkDistributeLeads, bulkAutoRouteLeads, bulkDistributeByDepartment };
