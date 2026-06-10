const prisma = require("../utils/prisma");

const checkPermission = (resource, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ message: "Unauthorized" });

            const { role, userId, workspaceId } = req.user;

            if (role === "SUPER_ADMIN" || role === "PLATFORM_OWNER") return next();

            const deny = () =>
                res.status(403).json({ message: `Access denied: Missing ${action} permission for ${resource}` });

            // Resolve effective permissions with the same priority the frontend uses
            // (manual overrides > custom role > system role), as a *replacement*:
            // a per-user override or custom role fully defines what the user can do,
            // so admins can both grant and revoke access by customizing a user.
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { preferences: true },
            });

            // 1. Manual per-user overrides fully replace the role.
            const overrides = user?.preferences?.permissionOverrides;
            if (Array.isArray(overrides)) {
                return overrides.some(p => p.resource === resource && p.action === action)
                    ? next()
                    : deny();
            }

            // 2. Assigned custom role fully replaces the system role.
            const customRoleName = user?.preferences?.customRoleName;
            if (customRoleName && workspaceId) {
                const customRole = await prisma.customRole.findFirst({
                    where: { name: customRoleName, workspaceId },
                    include: { permissions: true },
                });
                if (customRole) {
                    return customRole.permissions.some(p => p.resource === resource && p.action === action)
                        ? next()
                        : deny();
                }
            }

            // 3. Fall back to system role permissions.
            const hasRolePermission = await prisma.permission.findFirst({
                where: { role, resource, action },
            });
            if (hasRolePermission) return next();

            return deny();
        } catch (error) {
            console.error("Permission Middleware Error:", error);
            res.status(500).json({ message: "Internal server error during permission check" });
        }
    };
};

module.exports = checkPermission;
