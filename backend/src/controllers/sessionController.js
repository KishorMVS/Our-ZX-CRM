const prisma = require("../utils/prisma");
const { getWorkspaceFilter } = require("../utils/workspaceScope");

// In real app, this would be called on login
const createSession = async (userId, device) => {
    try {
        await prisma.session.create({
            data: { userId, device: device || "Unknown" }
        });
    } catch (error) {
        console.error("Session creation error:", error);
    }
};

const getActiveSessions = async (req, res) => {
    try {
        const { role } = req.user;
        if (role !== "SUPER_ADMIN") return res.status(403).json({ message: "Forbidden" });

        // Session has no workspaceId column — scope through the user relation.
        const sessions = await prisma.session.findMany({
            where: { user: getWorkspaceFilter(req.user) },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" }
        });

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching sessions", error: error.message });
    }
};

const logoutAllSessions = async (req, res) => {
    try {
        const { userId } = req.body; // Target user to force logout
        if (!userId) return res.status(400).json({ message: "User ID required" });

        // Only allow targeting a user inside the caller's workspace.
        const target = await prisma.user.findFirst({
            where: { id: userId, ...getWorkspaceFilter(req.user) },
            select: { id: true }
        });
        if (!target) return res.status(404).json({ message: "User not found" });

        await prisma.session.deleteMany({
            where: { userId }
        });

        res.json({ message: "Logged out all sessions for user" });
    } catch (error) {
        res.status(500).json({ message: "Error logging out sessions", error: error.message });
    }
};

module.exports = { createSession, getActiveSessions, logoutAllSessions };
