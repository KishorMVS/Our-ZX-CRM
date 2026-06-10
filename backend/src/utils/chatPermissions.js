// Effective chat-privilege resolution.
//
// Privileges are server-authoritative: ADMIN / SUPER_ADMIN always have them;
// a TEAM_LEAD has them only when the per-user `canCreateGroup` flag is set;
// everyone else never does. Callers should pass a FRESH user row from the DB
// (not the JWT payload) so a just-toggled flag takes effect without re-login.

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "PLATFORM_OWNER"];

const canCreateGroup = (user) =>
    !!user && (ADMIN_ROLES.includes(user.role) || !!user.canCreateGroup);

module.exports = { canCreateGroup };
