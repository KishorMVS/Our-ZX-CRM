import { useState, useEffect } from "react";
import api from "../api/axios";
import { Loader2, Shield, Save, CheckCircle, XCircle, Search, User, CheckSquare, Square, Plus, X, Tag } from "lucide-react";

const resources = [
    "dashboard", "search-leads", "linkedin-leads", "kanban", "sprints",
    "leads", "team", "tasks", "campaigns", "call-logs", "reports",
    "leaderboard", "departments", "messages", "attendance", "leave",
    "invoices", "fasterq", "integrations", "settings"
];
const actions = ["view", "create", "edit", "delete"];

const PermissionManager = ({ initialMode = "role", initialUser = null }) => {
    const [mode, setMode] = useState(initialMode);
    const [selectedRole, setSelectedRole] = useState("");
    const [selectedUser, setSelectedUser] = useState(initialUser);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(false);

    const [roles, setRoles] = useState([]);
    const [customRoles, setCustomRoles] = useState([]);
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [creatingRole, setCreatingRole] = useState(false);

    // User's active custom role name (if any)
    const [userCustomRoleName, setUserCustomRoleName] = useState("");
    const [assigningCustomRole, setAssigningCustomRole] = useState(false);

    useEffect(() => {
        setMode(initialMode);
        setSelectedUser(initialUser);
    }, [initialMode, initialUser]);

    useEffect(() => {
        fetchRoles();
        if (mode === "user") fetchUsers();
    }, [mode]);

    const fetchRoles = async () => {
        try {
            const res = await api.get("/permissions/roles");
            const systemRoles = res.data.filter(r => !r.isCustom).map(r => r.name);
            const custom = res.data.filter(r => r.isCustom);
            setRoles(res.data.map(r => r.name));
            setCustomRoles(custom);
            if (!selectedRole && systemRoles.length > 0) setSelectedRole(systemRoles[0]);
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        }
    };

    useEffect(() => {
        if (mode === "role" && selectedRole) {
            fetchRolePermissions();
        } else if (mode === "user" && selectedUser) {
            fetchUserPermissions();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRole, selectedUser, mode]);

    const fetchUsers = async () => {
        try {
            const res = await api.get("/users");
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        }
    };

    const fetchRolePermissions = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/permissions/role/${selectedRole}`);
            setPermissions(res.data);
            setIsCustomMode(false);
        } catch (error) {
            console.error("Failed to fetch permissions:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserPermissions = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/permissions/user/${selectedUser.id}`);
            const data = res.data;
            setUserCustomRoleName(data.customRoleName || "");

            if (data.userOverrides) {
                setPermissions(data.userOverrides);
                setIsCustomMode(true);
            } else if (data.customRolePermissions) {
                setPermissions(data.customRolePermissions);
                setIsCustomMode(false);
            } else {
                setPermissions(data.rolePermissions);
                setIsCustomMode(false);
            }
        } catch (error) {
            console.error("Failed to fetch user permissions:", error);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (resource, action) => {
        if (mode === "user" && !isCustomMode) {
            if (!confirm("This will create custom permission overrides for this user. Proceed?")) return;
            setIsCustomMode(true);
        }
        const exists = permissions.find(p => p.resource === resource && p.action === action);
        if (exists) {
            setPermissions(permissions.filter(p => !(p.resource === resource && p.action === action)));
        } else {
            setPermissions([...permissions, { resource, action }]);
        }
    };

    const selectAllNone = (type) => {
        if (mode === "user" && !isCustomMode) setIsCustomMode(true);
        if (type === "all") {
            const all = [];
            resources.forEach(r => actions.forEach(a => all.push({ resource: r, action: a })));
            setPermissions(all);
        } else {
            setPermissions([]);
        }
    };

    const selectColumn = (action) => {
        if (mode === "user" && !isCustomMode) setIsCustomMode(true);
        const columnItems = permissions.filter(p => p.action === action);
        if (columnItems.length === resources.length) {
            setPermissions(permissions.filter(p => p.action !== action));
        } else {
            const otherItems = permissions.filter(p => p.action !== action);
            setPermissions([...otherItems, ...resources.map(r => ({ resource: r, action }))]);
        }
    };

    const selectRow = (resource) => {
        if (mode === "user" && !isCustomMode) setIsCustomMode(true);
        const rowItems = permissions.filter(p => p.resource === resource);
        if (rowItems.length === actions.length) {
            setPermissions(permissions.filter(p => p.resource !== resource));
        } else {
            const otherItems = permissions.filter(p => p.resource !== resource);
            setPermissions([...otherItems, ...actions.map(a => ({ resource, action: a }))]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (mode === "role") {
                await api.post(`/permissions/role/${selectedRole}`, {
                    permissions: permissions.map(p => ({ resource: p.resource, action: p.action })),
                });
            } else {
                // User mode: only save if we're in manual override mode
                if (!isCustomMode) {
                    alert("No changes to save. Toggle permissions to create manual overrides, or assign a custom role using the dropdown.");
                    return;
                }
                await api.post(`/permissions/user/${selectedUser.id}`, {
                    permissions: permissions.map(p => ({ resource: p.resource, action: p.action })),
                });
            }
            alert("Permissions updated successfully!");
        } catch (error) {
            console.error("Failed to save permissions:", error);
            alert("Failed to save permissions.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetToRole = async () => {
        if (!confirm("This will remove all custom overrides and reset this user to their role's default permissions. Continue?")) return;
        try {
            await api.post(`/permissions/user/${selectedUser.id}`, { clearOverrides: true });
            setIsCustomMode(false);
            setUserCustomRoleName("");
            await fetchUserPermissions();
        } catch (error) {
            console.error("Failed to reset permissions:", error);
            alert("Failed to reset permissions.");
        }
    };

    const handleAssignCustomRole = async (roleName) => {
        setAssigningCustomRole(true);
        try {
            await api.post(`/permissions/user/${selectedUser.id}`, {
                customRoleName: roleName || null,
            });
            setUserCustomRoleName(roleName);
            setIsCustomMode(false);
            await fetchUserPermissions();
        } catch (error) {
            console.error("Failed to assign custom role:", error);
            alert(error.response?.data?.message || "Failed to assign custom role.");
        } finally {
            setAssigningCustomRole(false);
        }
    };

    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        setCreatingRole(true);
        try {
            await api.post("/permissions/roles", { name: newRoleName.trim() });
            setNewRoleName("");
            setIsAddingRole(false);
            await fetchRoles();
            alert("Role added successfully!");
        } catch (error) {
            console.error("Failed to add role:", error);
            alert(error.response?.data?.message || "Failed to add role.");
        } finally {
            setCreatingRole(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const systemRoleNames = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "EMPLOYEE"];
    const systemRoles = roles.filter(r => systemRoleNames.includes(r));
    const customRoleNames = roles.filter(r => !systemRoleNames.includes(r));

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-indigo-600" />
                        Permissions Management
                    </h3>
                    <p className="text-sm text-gray-500">Configure access by Role or Individual User.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode("role")}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "role" ? "bg-white text-indigo-600 shadow" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        Roles
                    </button>
                    <button
                        onClick={() => setMode("user")}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "user" ? "bg-white text-indigo-600 shadow" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        Users
                    </button>
                </div>
            </div>

            <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                {mode === "role" ? (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Role</label>

                        {/* System roles */}
                        <div className="flex flex-wrap gap-2 items-center mb-2">
                            {systemRoles.map(role => (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRole(role)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${selectedRole === role ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"}`}
                                >
                                    {role.replace(/_/g, " ")}
                                </button>
                            ))}
                        </div>

                        {/* Custom roles */}
                        {customRoleNames.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center mb-2">
                                <span className="text-xs text-gray-400 font-medium mr-1">Custom:</span>
                                {customRoleNames.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setSelectedRole(role)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1 ${selectedRole === role ? "bg-indigo-600 text-white shadow-lg" : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-400"}`}
                                    >
                                        <Tag className="h-3 w-3" />
                                        {role.replace(/_/g, " ")}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Add role */}
                        <div className="flex flex-wrap gap-2 items-center mt-2">
                            {!isAddingRole ? (
                                <button
                                    onClick={() => setIsAddingRole(true)}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 border border-dashed border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-1"
                                >
                                    <Plus className="h-4 w-4" /> Add Role
                                </button>
                            ) : (
                                <form onSubmit={handleAddRole} className="flex items-center gap-2 bg-white p-1 rounded-lg border border-indigo-200 shadow-sm">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Role Name..."
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        className="px-3 py-1 text-sm border-none focus:ring-0 outline-none w-32"
                                    />
                                    <button type="submit" disabled={creatingRole} className="p-1 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50">
                                        {creatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </button>
                                    <button type="button" onClick={() => { setIsAddingRole(false); setNewRoleName(""); }} className="p-1 text-red-500 hover:bg-red-50 rounded-md">
                                        <X className="h-4 w-4" />
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Search User</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                                {filteredUsers.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => setSelectedUser(u)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${selectedUser?.id === u.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-100 text-gray-600"}`}
                                    >
                                        <User className="h-4 w-4" />
                                        <span className="truncate">{u.name} ({u.role})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedUser && (
                            <div className="flex flex-col justify-center p-4 bg-white rounded-lg border border-indigo-100 gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{selectedUser.name}</p>
                                    <p className="text-xs text-gray-500">System role: {selectedUser.role}</p>
                                </div>

                                {/* Status badge */}
                                {isCustomMode ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                                        Manual Overrides Active
                                    </span>
                                ) : userCustomRoleName ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 w-fit">
                                        <Tag className="h-3 w-3" />
                                        Custom Role: {userCustomRoleName.replace(/_/g, " ")}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                                        Using System Role Permissions
                                    </span>
                                )}

                                {/* Custom role dropdown */}
                                {customRoles.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            Assign Custom Role
                                            {assigningCustomRole && <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />}
                                        </label>
                                        <select
                                            value={userCustomRoleName}
                                            onChange={(e) => handleAssignCustomRole(e.target.value)}
                                            disabled={assigningCustomRole}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="">— None (use system role) —</option>
                                            {customRoles.map(r => (
                                                <option key={r.name} value={r.name}>{r.name.replace(/_/g, " ")}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(isCustomMode || userCustomRoleName) && (
                                    <button
                                        onClick={handleResetToRole}
                                        className="text-xs text-red-500 font-medium hover:underline w-fit"
                                    >
                                        Reset to system role default
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {(mode === "role" || selectedUser) && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-4 items-center">
                            <h4 className="text-sm font-semibold text-gray-700">
                                {mode === "user" && !isCustomMode
                                    ? userCustomRoleName
                                        ? `Permissions from: ${userCustomRoleName.replace(/_/g, " ")}`
                                        : "Effective Permissions (read-only — toggle to override)"
                                    : "Manage Permissions"}
                            </h4>
                            {(mode === "role" || (mode === "user" && isCustomMode)) && (
                                <>
                                    <div className="h-4 w-px bg-gray-300"></div>
                                    <button onClick={() => selectAllNone("all")} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                        <CheckSquare className="h-3 w-3" /> Select All
                                    </button>
                                    <button onClick={() => selectAllNone("none")} className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                        <Square className="h-3 w-3" /> Clear All
                                    </button>
                                </>
                            )}
                        </div>
                        {(mode === "role" || (mode === "user" && isCustomMode)) && (
                            <button
                                onClick={handleSave}
                                disabled={saving || loading}
                                className="inline-flex items-center px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 transition-all active:scale-95"
                            >
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Save {mode === "role" ? "Role" : "User"} Permissions
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource</th>
                                        {actions.map(action => {
                                            const isAllSelected = permissions.filter(p => p.action === action).length === resources.length;
                                            const canInteract = mode === "role" || isCustomMode;
                                            return (
                                                <th key={action} className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => canInteract && selectColumn(action)}
                                                        className={`text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 mx-auto transition-colors ${isAllSelected ? "text-indigo-600" : "text-gray-500 hover:text-indigo-600"} ${!canInteract ? "cursor-default" : ""}`}
                                                    >
                                                        {action}
                                                        {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                    </button>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {resources.map(resource => {
                                        const isRowSelected = permissions.filter(p => p.resource === resource).length === actions.length;
                                        const canInteract = mode === "role" || isCustomMode;
                                        return (
                                            <tr key={resource} className="hover:bg-indigo-50/10 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => canInteract && selectRow(resource)}
                                                        className={`text-sm font-medium flex items-center gap-2 transition-colors ${isRowSelected ? "text-indigo-700" : "text-gray-900 group-hover:text-indigo-600"} ${!canInteract ? "cursor-default" : ""}`}
                                                    >
                                                        {resource.replace(/-/g, " ")}
                                                        {canInteract && (
                                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {isRowSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>
                                                {actions.map(action => {
                                                    const isChecked = permissions.some(p => p.resource === resource && p.action === action);
                                                    const canInteract = mode === "role" || isCustomMode;
                                                    return (
                                                        <td key={action} className="px-6 py-4 whitespace-nowrap text-center">
                                                            <button
                                                                onClick={() => canInteract && togglePermission(resource, action)}
                                                                className={`transition-all ${canInteract ? "hover:scale-110 active:scale-90" : "cursor-default"} ${isChecked ? "text-indigo-600" : "text-gray-300 hover:text-gray-400"}`}
                                                            >
                                                                {isChecked ? <CheckCircle className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PermissionManager;
