const prisma = require("../utils/prisma");

const getAuditLogs = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const logs = await prisma.activity.findMany({
            where: { lead: { workspaceId } },
            include: {
                user: { select: { name: true, email: true } },
                lead: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching audit logs", error: error.message });
    }
};

module.exports = { getAuditLogs };
