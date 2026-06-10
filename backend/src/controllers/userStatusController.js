const prisma = require("../utils/prisma");
const { getWorkspaceFilter } = require("../utils/workspaceScope");

// Update current user's online status
const updateMyStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status } = req.body;

        if (!["ONLINE", "OFFLINE", "BREAK"].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be ONLINE, OFFLINE, or BREAK" });
        }

        const updateData = { 
            onlineStatus: status,
            lastSeen: new Date()
        };
        if (status === "BREAK") {
            updateData.breakStartedAt = new Date();
        } else {
            updateData.breakStartedAt = null;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                onlineStatus: true,
                breakStartedAt: true
            }
        });

        // Log the status change
        await prisma.userStatusLog.create({
            data: {
                userId,
                status,
                note: req.body.note || `Status changed to ${status}`
            }
        });

        res.json({ message: "Status updated", user });
    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({ message: "Failed to update status" });
    }
};

// Get all active users with their current online status
const getAllUsersStatus = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true, ...getWorkspaceFilter(req.user) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                jobTitle: true,
                profilePhoto: true,
                onlineStatus: true,
                lastSeen: true,
                breakStartedAt: true
            },
            orderBy: [
                { onlineStatus: "asc" },
                { name: "asc" }
            ]
        });
        res.json(users);
    } catch (error) {
        console.error("Get all users status error:", error);
        res.status(500).json({ message: "Failed to fetch users status" });
    }
};

// Get today's status logs for current user
const getMyTodayLogs = async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = new Date();
        const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const logs = await prisma.userStatusLog.findMany({
            where: {
                userId,
                changedAt: { gte: startOfDay, lt: endOfDay }
            },
            orderBy: { changedAt: "asc" }
        });

        res.json(logs);
    } catch (error) {
        console.error("Get today logs error:", error);
        res.status(500).json({ message: "Failed to fetch today's status logs" });
    }
};

// Get specific user's last seen time
const getLastSeen = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastSeen: true, onlineStatus: true }
        });

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        console.error("Get last seen error:", error);
        res.status(500).json({ message: "Failed to fetch last seen" });
    }
};

// Get summary of all users' status durations for a specific date
const getTeamStatusSummary = async (req, res) => {
    try {
        const { date } = req.query;
        // Use provided date or today's date
        const targetDate = date ? new Date(date) : new Date();
        
        // Start and end of the target day in UTC
        const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const wsFilter = getWorkspaceFilter(req.user);

        // 1. Get all active users (workspace-scoped)
        const users = await prisma.user.findMany({
            where: { isActive: true, ...wsFilter },
            select: {
                id: true,
                name: true,
                email: true,
                department: true,
                onlineStatus: true,
                lastSeen: true
            },
            orderBy: { name: "asc" }
        });

        // 2. Get today's attendance for users in this workspace
        const attendances = await prisma.attendance.findMany({
            where: { date: startOfDay, user: wsFilter }
        });

        // 3. Get today's status logs for users in this workspace
        const statusLogs = await prisma.userStatusLog.findMany({
            where: {
                changedAt: { gte: startOfDay, lt: endOfDay },
                user: wsFilter
            },
            orderBy: { changedAt: "asc" }
        });

        const now = new Date();
        const isToday = targetDate.toDateString() === now.toDateString();
        const calculationEnd = isToday ? now : endOfDay;

        const summary = users.map(user => {
            const userAtt = attendances.find(a => a.userId === user.id);
            const userLogs = statusLogs.filter(l => l.userId === user.id);
            
            let onlineMs = 0;
            let breakMs = 0;

            if (userLogs.length > 0) {
                // If user is currently in a state and it's today, we add a "virtual" log at 'now'
                // to calculate the duration of the current ongoing state.
                const augmentedLogs = [...userLogs];
                const lastLog = augmentedLogs[augmentedLogs.length - 1];
                
                if (isToday && (lastLog.status === "ONLINE" || lastLog.status === "BREAK")) {
                    augmentedLogs.push({
                        status: "VIRTUAL_END",
                        changedAt: calculationEnd
                    });
                } else if (!isToday && (lastLog.status === "ONLINE" || lastLog.status === "BREAK")) {
                    // For past dates, if the last log was ONLINE/BREAK, assume it ended at end of day
                    augmentedLogs.push({
                        status: "VIRTUAL_END",
                        changedAt: endOfDay
                    });
                }

                for (let i = 0; i < augmentedLogs.length - 1; i++) {
                    const current = augmentedLogs[i];
                    const next = augmentedLogs[i + 1];
                    const duration = next.changedAt - current.changedAt;

                    if (current.status === "ONLINE") onlineMs += duration;
                    else if (current.status === "BREAK") breakMs += duration;
                }
            }

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                department: user.department,
                currentStatus: user.onlineStatus,
                checkIn: userAtt?.checkIn || null,
                checkOut: userAtt?.checkOut || null,
                onlineHrs: (onlineMs / 3600000).toFixed(2),
                breakHrs: (breakMs / 3600000).toFixed(2),
                lastSeen: user.lastSeen
            };
        });

        res.json(summary);
    } catch (error) {
        console.error("Get team status summary error:", error);
        res.status(500).json({ message: "Failed to fetch team status summary" });
    }
};

module.exports = { updateMyStatus, getAllUsersStatus, getMyTodayLogs, getLastSeen, getTeamStatusSummary };
