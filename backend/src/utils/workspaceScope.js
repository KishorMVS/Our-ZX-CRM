// Centralised multi-tenant scoping helper.
//
// Every tenant-bound query must be confined to the requesting user's workspace.
// The PLATFORM_OWNER is the single cross-tenant account (its JWT carries no
// workspaceId) and is intentionally allowed to see all workspaces.
//
// Usage:
//   const where = { ...getWorkspaceFilter(req.user), status: "NEW" };
// For models without a direct workspaceId column, scope through the relation:
//   where: { lead: getWorkspaceFilter(req.user) }   // e.g. Note
//   where: { user: getWorkspaceFilter(req.user) }   // e.g. Attendance / Leave

const getWorkspaceFilter = (user) => {
    if (!user) return {};
    // Platform owner is global; everyone else is confined to their workspace.
    if (user.role === "PLATFORM_OWNER") return {};
    return user.workspaceId ? { workspaceId: user.workspaceId } : {};
};

// A "department-scoped admin" is an ADMIN who was assigned a department at
// creation. They get full (super-admin-like) access, but confined to that one
// department. An ADMIN with no department ("All Departments") is workspace-wide,
// exactly like the super admin within their workspace.
const isDeptScopedAdmin = (user) =>
    !!user && user.role === "ADMIN" && !!user.departmentId;

// Where-fragment for the User model. Confines a department-scoped admin (and a
// team lead) to their own department; everyone else only gets the workspace filter.
const getUserScopeFilter = (user) => {
    const base = getWorkspaceFilter(user);
    if (isDeptScopedAdmin(user)) return { ...base, departmentId: user.departmentId };
    return base;
};

module.exports = { getWorkspaceFilter, isDeptScopedAdmin, getUserScopeFilter };
