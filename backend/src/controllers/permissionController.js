const prisma = require("../utils/prisma");
const { randomUUID: uuidv4 } = require("crypto");

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "EMPLOYEE"];

// Get permissions for a specific role (system or custom)
const getPermissionsByRole = async (req, res) => {
    try {
        const { role: roleName } = req.params;
        const { workspaceId } = req.user;

        if (VALID_ROLES.includes(roleName)) {
            const permissions = await prisma.permission.findMany({ where: { role: roleName } });
            return res.json(permissions);
        }

        // Custom role
        const customRole = await prisma.customRole.findFirst({
            where: { name: roleName, workspaceId },
            include: { permissions: true },
        });
        if (!customRole) return res.status(404).json({ message: "Role not found" });
        return res.json(customRole.permissions.map(p => ({ resource: p.resource, action: p.action })));
    } catch (error) {
        res.status(500).json({ message: "Error fetching permissions", error: error.message });
    }
};

// Update permissions for a role (system or custom)
const updateRolePermissions = async (req, res) => {
    try {
        const { role: roleName } = req.params;
        const { permissions } = req.body;
        const { workspaceId } = req.user;

        if (VALID_ROLES.includes(roleName)) {
            await prisma.permission.deleteMany({ where: { role: roleName } });
            if (permissions?.length > 0) {
                await prisma.permission.createMany({
                    data: permissions.map(p => ({ role: roleName, resource: p.resource, action: p.action })),
                    skipDuplicates: true,
                });
            }
            return res.json({ message: "Permissions updated successfully" });
        }

        // Custom role
        const customRole = await prisma.customRole.findFirst({ where: { name: roleName, workspaceId } });
        if (!customRole) return res.status(404).json({ message: "Role not found" });

        await prisma.customPermission.deleteMany({ where: { customRoleId: customRole.id } });
        if (permissions?.length > 0) {
            await prisma.customPermission.createMany({
                data: permissions.map(p => ({
                    id: uuidv4(),
                    customRoleId: customRole.id,
                    resource: p.resource,
                    action: p.action,
                })),
                skipDuplicates: true,
            });
        }
        return res.json({ message: "Permissions updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating permissions", error: error.message });
    }
};

// Get permissions for a specific user (role defaults + any overrides)
const getUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { workspaceId } = req.user;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const rolePermissions = await prisma.permission.findMany({ where: { role: user.role } });
        const userOverrides = user.preferences?.permissionOverrides || null;
        const customRoleName = user.preferences?.customRoleName || null;

        let customRolePermissions = null;
        if (customRoleName && workspaceId) {
            const customRole = await prisma.customRole.findFirst({
                where: { name: customRoleName, workspaceId },
                include: { permissions: true },
            });
            if (customRole) {
                customRolePermissions = customRole.permissions.map(p => ({ resource: p.resource, action: p.action }));
            }
        }

        return res.json({ role: user.role, customRoleName, rolePermissions, customRolePermissions, userOverrides });
    } catch (error) {
        res.status(500).json({ message: "Error fetching user permissions", error: error.message });
    }
};

// Save per-user permission overrides or assign a custom role
const updateUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permissions, customRoleName, clearOverrides } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const updatedPrefs = { ...(user.preferences || {}) };

        if (clearOverrides) {
            updatedPrefs.permissionOverrides = null;
            updatedPrefs.customRoleName = null;
        } else if (customRoleName !== undefined) {
            // Assign a custom role — clears manual overrides
            updatedPrefs.customRoleName = customRoleName || null;
            if (customRoleName) updatedPrefs.permissionOverrides = null;
        } else if (permissions !== undefined) {
            // Set manual overrides — clears custom role assignment
            updatedPrefs.permissionOverrides = permissions || null;
            if (permissions) updatedPrefs.customRoleName = null;
        }

        await prisma.user.update({ where: { id: userId }, data: { preferences: updatedPrefs } });
        return res.json({ message: "User permissions updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating user permissions", error: error.message });
    }
};

// Get permissions for the currently logged-in user
// Priority: manual overrides > custom role > system role
const getMyPermissions = async (req, res) => {
    try {
        const userId = req.user.userId;
        const workspaceId = req.user.workspaceId;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. Manual overrides take highest priority
        const overrides = user.preferences?.permissionOverrides;
        if (overrides) return res.json(overrides);

        // 2. Custom role
        const customRoleName = user.preferences?.customRoleName;
        if (customRoleName && workspaceId) {
            const customRole = await prisma.customRole.findFirst({
                where: { name: customRoleName, workspaceId },
                include: { permissions: true },
            });
            if (customRole) {
                return res.json(customRole.permissions.map(p => ({ resource: p.resource, action: p.action })));
            }
        }

        // 3. System role permissions
        const permissions = await prisma.permission.findMany({ where: { role: user.role } });
        return res.json(permissions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching your permissions", error: error.message });
    }
};

// Seed default permissions
const seedDefaultPermissions = async (req, res) => {
    try {
        const resources = [
            "dashboard", "search-leads", "linkedin-leads", "kanban", "sprints",
            "leads", "team", "tasks", "campaigns", "call-logs", "reports",
            "leaderboard", "departments", "messages", "attendance", "leave",
            "invoices", "fasterq", "integrations", "settings"
        ];
        const actions = ["view", "create", "edit", "delete"];

        await prisma.permission.deleteMany({});
        const allData = [];

        for (const roleName of ["SUPER_ADMIN", "ADMIN"]) {
            for (const resource of resources) {
                for (const action of actions) {
                    allData.push({ role: roleName, resource, action });
                }
            }
        }

        const teamLeadResources = ["dashboard", "leads", "tasks", "attendance", "leave", "team", "reports"];
        for (const resource of teamLeadResources) {
            for (const action of actions) {
                allData.push({ role: "TEAM_LEAD", resource, action });
            }
        }

        const employeeResources = ["dashboard", "leads", "tasks", "attendance", "leave"];
        for (const resource of employeeResources) {
            for (const action of ["view", "create", "edit"]) {
                allData.push({ role: "EMPLOYEE", resource, action });
            }
        }

        await prisma.permission.createMany({ data: allData, skipDuplicates: true });
        res.json({ message: "Default permissions seeded successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error seeding permissions", error: error.message });
    }
};

// Get all roles — system roles + workspace custom roles
const getRoles = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const customRoles = workspaceId
            ? await prisma.customRole.findMany({ where: { workspaceId } })
            : [];
        const allRoles = [
            ...VALID_ROLES.map(name => ({ name, description: `${name} role`, isCustom: false })),
            ...customRoles.map(r => ({ name: r.name, id: r.id, description: "Custom role", isCustom: true })),
        ];
        return res.json(allRoles);
    } catch (error) {
        res.status(500).json({ message: "Error fetching roles", error: error.message });
    }
};

// Create a new custom role (workspace-scoped)
const createRole = async (req, res) => {
    try {
        const { name } = req.body;
        const { workspaceId } = req.user;

        if (!name?.trim()) return res.status(400).json({ message: "Role name is required." });
        const normalized = name.trim().toUpperCase().replace(/\s+/g, "_");

        if (VALID_ROLES.includes(normalized)) {
            return res.status(400).json({ message: "This role name is reserved by the system." });
        }
        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace context required to create custom roles." });
        }

        const existing = await prisma.customRole.findFirst({ where: { name: normalized, workspaceId } });
        if (existing) return res.status(409).json({ message: "A role with this name already exists." });

        const customRole = await prisma.customRole.create({
            data: { id: uuidv4(), name: normalized, workspaceId },
        });
        return res.status(201).json({ name: customRole.name, id: customRole.id, isCustom: true });
    } catch (error) {
        res.status(500).json({ message: "Error creating role", error: error.message });
    }
};

module.exports = {
    getPermissionsByRole,
    updateRolePermissions,
    getUserPermissions,
    updateUserPermissions,
    getMyPermissions,
    seedDefaultPermissions,
    getRoles,
    createRole,
};
