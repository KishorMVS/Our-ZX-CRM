const prisma = require("../utils/prisma");

const exportTasks = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const tasks = await prisma.task.findMany({
            where:   { lead: { workspaceId } },
            include: {
                lead:       { select: { name: true } },
                assignedTo: { select: { name: true } },
            },
        });

        const fields = ["Title", "Status", "Due Date", "Lead", "Assigned To"];
        const csv = [
            fields.join(","),
            ...tasks.map(t => [
                t.title,
                t.status,
                t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A",
                t.lead?.name       || "N/A",
                t.assignedTo?.name || "Unassigned",
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("tasks.csv");
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting tasks", error: error.message });
    }
};

const exportTeamPerformance = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const users = await prisma.user.findMany({
            where:   { role: "EMPLOYEE", workspaceId },
            include: {
                assignedLeads: { where: { workspaceId }, select: { status: true } },
                tasks:         { where: { lead: { workspaceId } }, select: { status: true } },
            },
        });

        const fields = ["Employee", "Total Leads", "Converted", "Conversion Rate", "Pending Tasks"];
        const csv = [
            fields.join(","),
            ...users.map(u => {
                const total     = u.assignedLeads.length;
                const converted = u.assignedLeads.filter(l => l.status === "CONVERTED").length;
                const rate      = total > 0 ? ((converted / total) * 100).toFixed(1) + "%" : "0%";
                return [
                    u.name, total, converted, rate,
                    u.tasks.filter(t => t.status === "PENDING").length,
                ].map(v => `"${v}"`).join(",");
            }),
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("team_performance.csv");
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting team performance", error: error.message });
    }
};

const exportSalesPerformance = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { from } = req.query;

        const targetDate = from ? new Date(from) : new Date();
        if (isNaN(targetDate.getTime()))
            return res.status(400).json({ message: "Invalid date format" });

        const dateStr    = targetDate.toISOString().split("T")[0];
        const startOfDay = new Date(dateStr);
        const endOfDay   = new Date(startOfDay.getTime() + 86400000);

        const users = await prisma.user.findMany({
            where:   { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true, workspaceId },
            include: {
                attendances:   { where: { date: { gte: startOfDay, lt: endOfDay } } },
                callLogs:      { where: { createdAt: { gte: startOfDay, lt: endOfDay } } },
                assignedLeads: { where: { workspaceId }, select: { status: true } },
            },
        });

        const fields = ["Employee", "Role", "Check-In", "Check-Out", "Total Calls", "Speak Time (min)", "Converted", "Total Leads", "Win Rate"];
        const csv = [
            fields.join(","),
            ...users.map(u => {
                const total     = u.assignedLeads.length;
                const converted = u.assignedLeads.filter(l => l.status === "CONVERTED").length;
                const att       = u.attendances[0];
                return [
                    u.name,
                    u.role,
                    att?.checkIn  ? new Date(att.checkIn).toLocaleTimeString()  : "N/A",
                    att?.checkOut ? new Date(att.checkOut).toLocaleTimeString() : "N/A",
                    u.callLogs.length,
                    Math.round(u.callLogs.reduce((s, c) => s + (c.duration || 0), 0) / 60),
                    converted,
                    total,
                    total > 0 ? ((converted / total) * 100).toFixed(1) + "%" : "0%",
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
            }),
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment(`sales_performance_${dateStr}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting sales performance", error: error.message });
    }
};

module.exports = { exportTasks, exportTeamPerformance, exportSalesPerformance };
