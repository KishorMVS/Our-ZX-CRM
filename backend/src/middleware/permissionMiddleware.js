const prisma = require("../utils/prisma");

const checkPermission = (resource, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ message: "Unauthorized" });

            const { role, userId, workspaceId } = req.user;

            if (role === "SUPER_ADMIN" || role === "PLATFORM_OWNER") return next();

            // 1. Check system role permission
            const hasRolePermission = await prisma.permission.findFirst({
                where: { role, resource, action },
            });
            if (hasRolePermission) return next();

            // 2. Check user-level overrides and custom role assignment
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { preferences: true },
            });

            if (user?.preferences) {
                const overrides = user.preferences.permissionOverrides;
                if (Array.isArray(overrides)) {
                    if (overrides.some(p => p.resource === resource && p.action === action)) return next();
                }

                const customRoleName = user.preferences.customRoleName;
                if (customRoleName && workspaceId) {
                    const customRole = await prisma.customRole.findFirst({
                        where: { name: customRoleName, workspaceId },
                        include: { permissions: true },
                    });
                    if (customRole?.permissions.some(p => p.resource === resource && p.action === action)) {
                        return next();
                    }
                }
            }

            return res.status(403).json({ message: `Access denied: Missing ${action} permission for ${resource}` });
        } catch (error) {
            console.error("Permission Middleware Error:", error);
            res.status(500).json({ message: "Internal server error during permission check" });
        }
    };
};

module.exports = checkPermission;
