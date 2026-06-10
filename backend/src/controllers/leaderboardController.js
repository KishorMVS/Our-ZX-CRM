const prisma = require("../utils/prisma");

const getLeaderboard = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = parseInt(month) || (now.getMonth() + 1);
        const targetYear  = parseInt(year)  || now.getFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
        const endDate   = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

        const [employees, allAttendance, allTasks] = await Promise.all([
            prisma.user.findMany({
                where: { role: { in: ["EMPLOYEE", "ADMIN"] }, isActive: true, workspaceId },
                select: { id: true, name: true, email: true, department: true, jobTitle: true, profilePhoto: true },
            }),
            prisma.attendance.findMany({
                where: { date: { gte: startDate, lte: endDate }, user: { workspaceId } },
            }),
            prisma.task.findMany({
                where: {
                    status:      "COMPLETED",
                    completedAt: { gte: startDate, lte: endDate },
                    assignedTo:  { workspaceId },
                },
            }),
        ]);

        const leaderboard = employees.map(emp => {
            const empAtt   = allAttendance.filter(a => a.userId === emp.id);
            const empTasks = allTasks.filter(t => t.assignedToId === emp.id);

            let attendancePoints = 0, punctualityBonus = 0, taskPoints = 0, timingBonus = 0;

            empAtt.forEach(att => {
                if (att.status === "PRESENT") {
                    attendancePoints += 10;
                    if (att.checkIn) {
                        const ci = new Date(att.checkIn);
                        if (ci.getHours() * 60 + ci.getMinutes() <= 600) punctualityBonus += 5;
                    }
                }
            });

            empTasks.forEach(task => {
                taskPoints += 20;
                if (task.completedAt && task.dueDate &&
                    new Date(task.completedAt) <= new Date(task.dueDate)) {
                    timingBonus += 10;
                }
            });

            return {
                user: emp,
                stats: {
                    presentDays:    empAtt.filter(a => a.status === "PRESENT").length,
                    tasksCompleted: empTasks.length,
                    onTimeTasks:    empTasks.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)).length,
                },
                points: { attendance: attendancePoints, punctuality: punctualityBonus, tasks: taskPoints, timing: timingBonus },
                totalScore: attendancePoints + punctualityBonus + taskPoints + timingBonus,
            };
        });

        leaderboard.sort((a, b) => b.totalScore - a.totalScore);
        res.json(leaderboard);
    } catch (error) {
        console.error("Leaderboard error:", error);
        res.status(500).json({ message: "Failed to fetch leaderboard", error: error.message });
    }
};

module.exports = { getLeaderboard };
