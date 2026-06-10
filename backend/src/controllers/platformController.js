const prisma = require("../utils/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Platform owner login (separate from company login)
const platformLogin = async (req, res) => {
    try {
        let { email, password } = req.body;
        email = email ? email.toLowerCase().trim() : "";

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.log("Platform login failed: User not found for email:", email);
            return res.status(401).json({ message: "Invalid credentials (user not found)" });
        }
        if (user.role !== "PLATFORM_OWNER") {
            console.log("Platform login failed: User role is not PLATFORM_OWNER. Role is:", user.role);
            return res.status(401).json({ message: "Invalid credentials (not owner)" });
        }

        if (!user.isActive) {
            console.log("Platform login failed: Account inactive");
            return res.status(403).json({ message: "Account is inactive" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Platform login failed: Password mismatch for email:", email);
            return res.status(401).json({ message: "Invalid credentials (password mismatch)" });
        }

        const token = jwt.sign(
            { userId: user.id, role: "PLATFORM_OWNER", workspaceId: null },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: "PLATFORM_OWNER"
            }
        });
    } catch (error) {
        console.error("Platform login error:", error);
        res.status(500).json({ message: "Login failed", error: error.message });
    }
};

// Overall platform stats — focused on company registrations
const getPlatformStats = async (req, res) => {
    try {
        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

        const [totalWorkspaces, activeWorkspaces, newThisMonth, newLastMonth] = await Promise.all([
            prisma.workspace.count(),
            prisma.workspace.count({ where: { status: "ACTIVE" } }),
            prisma.workspace.count({ where: { createdAt: { gte: thisMonthStart } } }),
            prisma.workspace.count({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
        ]);

        // Last 6 months registration trend
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const recentWorkspaces = await prisma.workspace.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" }
        });

        const monthlyGrowth = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString("default", { month: "short", year: "numeric" });
            monthlyGrowth[key] = 0;
        }
        recentWorkspaces.forEach(w => {
            const key = new Date(w.createdAt).toLocaleString("default", { month: "short", year: "numeric" });
            if (monthlyGrowth[key] !== undefined) monthlyGrowth[key]++;
        });

        // 5 most recently registered companies
        const recentRegistrations = await prisma.workspace.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                status: true,
                createdAt: true,
                _count: { select: { users: true } }
            }
        });

        const growthRate = newLastMonth > 0
            ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
            : newThisMonth > 0 ? 100 : 0;

        return res.json({
            totalWorkspaces,
            activeWorkspaces,
            suspendedWorkspaces: totalWorkspaces - activeWorkspaces,
            newThisMonth,
            growthRate,
            monthlyGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({ month, count })),
            recentRegistrations: recentRegistrations.map(w => ({
                id: w.id,
                name: w.name,
                slug: w.slug,
                plan: w.plan,
                status: w.status,
                createdAt: w.createdAt,
                userCount: w._count.users
            }))
        });
    } catch (error) {
        console.error("Platform stats error:", error);
        res.status(500).json({ message: "Failed to fetch stats", error: error.message });
    }
};

// List all workspaces with counts
const getWorkspaces = async (req, res) => {
    try {
        const { search = "", status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
            ...(status ? { status } : {})
        };

        const [workspaces, total] = await Promise.all([
            prisma.workspace.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: "desc" },
                include: {
                    _count: { select: { users: true, leads: true } },
                    companySettings: { select: { companyName: true, email: true, phone: true, website: true } }
                }
            }),
            prisma.workspace.count({ where })
        ]);

        const enriched = workspaces.map(ws => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            plan: ws.plan,
            status: ws.status,
            createdAt: ws.createdAt,
            userCount: ws._count.users,
            leadCount: ws._count.leads,
            companyEmail: ws.companySettings?.email || null,
            companyPhone: ws.companySettings?.phone || null,
            website: ws.companySettings?.website || null
        }));

        return res.json({ workspaces: enriched, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error("Get workspaces error:", error);
        res.status(500).json({ message: "Failed to fetch workspaces", error: error.message });
    }
};

// Single workspace detail with users
const getWorkspaceDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const workspace = await prisma.workspace.findUnique({
            where: { id },
            include: {
                companySettings: true,
                users: {
                    where: { role: { not: "PLATFORM_OWNER" } },
                    select: {
                        id: true, name: true, email: true, role: true,
                        isActive: true, onlineStatus: true, createdAt: true, jobTitle: true
                    },
                    orderBy: { createdAt: "asc" }
                },
                _count: { select: { users: true, leads: true } }
            }
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        const leadStats = await prisma.lead.groupBy({
            by: ["status"],
            where: { workspaceId: id },
            _count: true
        });

        return res.json({ workspace, leadStats });
    } catch (error) {
        console.error("Get workspace detail error:", error);
        res.status(500).json({ message: "Failed to fetch workspace", error: error.message });
    }
};

// Toggle workspace active/suspended
const toggleWorkspaceStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const workspace = await prisma.workspace.findUnique({ where: { id } });
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        const newStatus = workspace.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

        const updated = await prisma.workspace.update({
            where: { id },
            data: { status: newStatus }
        });

        if (newStatus === "SUSPENDED") {
            await prisma.user.updateMany({
                where: { workspaceId: id },
                data: { isActive: false }
            });
        } else {
            await prisma.user.updateMany({
                where: { workspaceId: id },
                data: { isActive: true }
            });
        }

        return res.json({ message: `Workspace ${newStatus.toLowerCase()}`, workspace: updated });
    } catch (error) {
        console.error("Toggle workspace error:", error);
        res.status(500).json({ message: "Failed to update workspace", error: error.message });
    }
};

// Permanently delete a workspace (company) and ALL of its data.
// The schema has very few onDelete: Cascade rules, so we delete every
// related record explicitly, in child-before-parent order, inside a
// single transaction so the whole thing rolls back on any failure.
const deleteWorkspace = async (req, res) => {
    try {
        const { id } = req.params;

        const workspace = await prisma.workspace.findUnique({ where: { id } });
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        // Gather the ids we need to fan out from.
        const [users, leads] = await Promise.all([
            prisma.user.findMany({ where: { workspaceId: id }, select: { id: true } }),
            prisma.lead.findMany({ where: { workspaceId: id }, select: { id: true } }),
        ]);
        const userIds = users.map((u) => u.id);
        const leadIds = leads.map((l) => l.id);

        // Tasks belonging to the workspace, its leads, or its users.
        const tasks = await prisma.task.findMany({
            where: {
                OR: [
                    { workspaceId: id },
                    ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
                    ...(userIds.length ? [{ assignedToId: { in: userIds } }] : []),
                ],
            },
            select: { id: true },
        });
        const taskIds = tasks.map((t) => t.id);

        await prisma.$transaction(async (tx) => {
            // ── Records that reference leads / users / tasks (no cascade) ──
            await tx.reminder.deleteMany({
                where: {
                    OR: [
                        { leadId: { in: leadIds } },
                        { userId: { in: userIds } },
                        { taskId: { in: taskIds } },
                    ],
                },
            });
            await tx.commission.deleteMany({
                where: { OR: [{ leadId: { in: leadIds } }, { userId: { in: userIds } }] },
            });
            await tx.activity.deleteMany({
                where: { OR: [{ leadId: { in: leadIds } }, { userId: { in: userIds } }] },
            });
            await tx.note.deleteMany({ where: { leadId: { in: leadIds } } });
            await tx.callLog.deleteMany({
                where: { OR: [{ leadId: { in: leadIds } }, { userId: { in: userIds } }] },
            });
            await tx.notification.deleteMany({ where: { userId: { in: userIds } } });

            // Task comments may reference users in other places — clear ours,
            // then delete the tasks (comments & files cascade off the task).
            await tx.taskComment.deleteMany({ where: { userId: { in: userIds } } });
            await tx.task.deleteMany({ where: { id: { in: taskIds } } });
            await tx.sprint.deleteMany({ where: { workspaceId: id } });

            // Invoices (items + payments cascade) and SLAs (signatures cascade).
            await tx.invoice.deleteMany({ where: { createdById: { in: userIds } } });
            await tx.sLA.deleteMany({ where: { createdById: { in: userIds } } });
            await tx.sLATemplate.deleteMany({ where: { workspaceId: id } });

            // Telephony / call infrastructure tied to this workspace's users.
            await tx.dIDNumber.updateMany({
                where: { allocatedToAdminId: { in: userIds } },
                data: { allocatedToAdminId: null },
            });
            await tx.dIDNumber.updateMany({
                where: { assignedToEmployeeId: { in: userIds } },
                data: { assignedToEmployeeId: null },
            });
            await tx.dIDNumber.deleteMany({ where: { superAdminId: { in: userIds } } });
            await tx.voiceLinkClient.deleteMany({
                where: { OR: [{ workspaceId: id }, { userId: { in: userIds } }] },
            });
            await tx.zenCallEvent.deleteMany({ where: { workspaceId: id } });
            await tx.zXCallRequest.deleteMany({ where: { workspaceId: id } });

            // Integrations (incl. Gmail / email connections).
            await tx.gmailIntegration.deleteMany({ where: { workspaceId: id } });
            await tx.integration.deleteMany({ where: { workspaceId: id } });
            await tx.campaign.deleteMany({ where: { workspaceId: id } });

            // Leads before users (Lead.assignedToId → User). Implicit
            // lead/rep assignment join rows cascade automatically.
            await tx.lead.deleteMany({ where: { workspaceId: id } });

            // Company settings (email/SMTP config etc.).
            await tx.companySettings.deleteMany({ where: { workspaceId: id } });

            // Users — sessions, attendance, leaves, leave approvals and
            // status logs all cascade off the user.
            await tx.user.deleteMany({ where: { workspaceId: id } });

            // Departments after users (User.departmentId → Department).
            await tx.department.deleteMany({ where: { workspaceId: id } });

            // Finally, the workspace itself.
            await tx.workspace.delete({ where: { id } });
        }, { timeout: 60000 });

        return res.json({
            message: "Company and all associated data deleted permanently",
            deleted: {
                workspaceId: id,
                name: workspace.name,
                users: userIds.length,
                leads: leadIds.length,
            },
        });
    } catch (error) {
        console.error("Delete workspace error:", error);
        res.status(500).json({ message: "Failed to delete company", error: error.message });
    }
};

module.exports = {
    platformLogin,
    getPlatformStats,
    getWorkspaces,
    getWorkspaceDetail,
    toggleWorkspaceStatus,
    deleteWorkspace
};
