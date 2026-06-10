const prisma = require("../utils/prisma");

const getDateFilter = (from, to) => {
    if (!from || !to) return {};
    const start = new Date(from);
    const end   = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { createdAt: { gte: start, lte: end } };
};

const getLeadsBySource = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const groupBySource = await prisma.lead.groupBy({
            by:    ["source"],
            where: { workspaceId, ...dateFilter },
            _count: { id: true },
        });

        const allSources = [
            "FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL",
            "LINKEDIN", "CALENDLY", "GOOGLE_ADS", "GOOGLE_SHEETS", "WEB_FORM", "WEBHOOK",
        ];
        const result = allSources.map(source => {
            const found = groupBySource.find(i => i.source === source);
            return { source, count: found ? found._count.id : 0 };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching leads by source", error: error.message });
    }
};

const getLeadsByEmployee = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const leads = await prisma.lead.findMany({
            where:  { workspaceId, ...dateFilter },
            select: { assignedToId: true },
        });

        const counts = {};
        leads.forEach(l => {
            const id = l.assignedToId || "Unassigned";
            counts[id] = (counts[id] || 0) + 1;
        });

        const userIds = Object.keys(counts).filter(id => id !== "Unassigned");
        const users   = await prisma.user.findMany({
            where:  { id: { in: userIds }, workspaceId },
            select: { id: true, name: true },
        });
        const nameMap = Object.fromEntries(users.map(u => [u.id, u.name]));

        const result = Object.entries(counts).map(([id, count]) => ({
            name:  id === "Unassigned" ? "Unassigned" : (nameMap[id] || "Unknown"),
            count,
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching leads by employee", error: error.message });
    }
};

const getConversionRate = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { from, to } = req.query;
        const dateFilter = getDateFilter(from, to);

        const [totalLeads, convertedLeads] = await Promise.all([
            prisma.lead.count({ where: { workspaceId, ...dateFilter } }),
            prisma.lead.count({ where: { workspaceId, ...dateFilter, status: "CONVERTED" } }),
        ]);

        const rate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;
        res.json({ totalLeads, convertedLeads, conversionRate: `${rate}%` });
    } catch (error) {
        res.status(500).json({ message: "Error fetching conversion rate", error: error.message });
    }
};

const getMonthlyGrowth = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const now = new Date();
        const result = [];

        for (let i = 5; i >= 0; i--) {
            const date      = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const count     = await prisma.lead.count({
                where: { workspaceId, createdAt: { gte: date, lt: nextMonth } },
            });
            result.push({
                month: date.toLocaleString("default", { month: "short", year: "numeric" }),
                leads: count,
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching monthly growth", error: error.message });
    }
};

const getTeamLeadAssignments = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const teamLeads = await prisma.user.findMany({
            where: { role: "TEAM_LEAD", workspaceId },
            include: {
                assignedLeads: {
                    where:  { workspaceId },
                    select: { id: true, name: true, status: true, category: true },
                },
                collaboratingLeads: {
                    where:  { workspaceId },
                    select: { id: true, name: true, status: true, category: true },
                },
            },
        });

        const formatted = teamLeads.map(tl => {
            const allLeads = [
                ...tl.assignedLeads.map(l     => ({ ...l, assignmentType: "Primary" })),
                ...tl.collaboratingLeads.map(l => ({ ...l, assignmentType: "Collaborator" })),
            ];
            return {
                id:                tl.id,
                name:              tl.name,
                email:             tl.email,
                primaryCount:      tl.assignedLeads.length,
                collaboratorCount: tl.collaboratingLeads.length,
                totalCount:        allLeads.length,
                stats: {
                    cold:      allLeads.filter(l => l.category?.toLowerCase().includes("cold")).length,
                    warm:      allLeads.filter(l => l.category?.toLowerCase().includes("warm")).length,
                    hot:       allLeads.filter(l => l.category?.toLowerCase().includes("hot")).length,
                    converted: allLeads.filter(l => l.status === "CONVERTED").length,
                },
                leads: allLeads,
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team lead assignments", error: error.message });
    }
};

module.exports = {
    getLeadsBySource, getLeadsByEmployee, getConversionRate,
    getMonthlyGrowth, getTeamLeadAssignments,
};
