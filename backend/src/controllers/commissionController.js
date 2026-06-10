const prisma = require("../utils/prisma");

const getCommissions = async (req, res) => {
    try {
        const { userId, role, workspaceId } = req.user;

        // Commission has no `user` relation (scalar userId only), so we scope
        // by the set of userIds in this workspace instead of a relation filter.
        let where;
        if (role === "EMPLOYEE") {
            where = { userId };
        } else {
            const wsUsers = await prisma.user.findMany({
                where: { workspaceId },
                select: { id: true },
            });
            where = { userId: { in: wsUsers.map((u) => u.id) } };
        }

        const commissions = await prisma.commission.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        // Attach user names without a relation include.
        const ids = [...new Set(commissions.map((c) => c.userId))];
        const named = ids.length
            ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
            : [];
        const nameById = Object.fromEntries(named.map((u) => [u.id, u.name]));
        const enriched = commissions.map((c) => ({ ...c, user: { name: nameById[c.userId] || null } }));

        const totalAmount = enriched.reduce((sum, c) => sum + c.amount, 0);

        res.json({ totalAmount, commissions: enriched });
    } catch (error) {
        res.status(500).json({ message: "Error fetching commissions", error: error.message });
    }
};

module.exports = { getCommissions };
