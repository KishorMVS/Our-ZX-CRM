import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Loader2, Trash2, Power, UserPlus, Shield, ToggleLeft, ToggleRight, Edit, Clock, BarChart2, PhoneCall, PhoneOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import AddUserForm from "../components/AddUserForm";
import EditUserForm from "../components/EditUserForm";
import PermissionManager from "../components/RolePermissionManager";
import { usePermissions } from "../context/PermissionContext";

const Team = () => {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
    const [activeTab, setActiveTab] = useState("members"); // 'members' or 'status'

    const { hasPermission } = usePermissions();

    // Permissions
    const canViewTeam = hasPermission("team", "view");
    const canCreateTeam = hasPermission("team", "create");
    const canEditTeam = hasPermission("team", "edit");
    const canDeleteTeam = hasPermission("team", "delete");
    // Only super admin or someone with specific permission should manage role permissions
    // Assuming 'settings' or 'role_permissions' handles it. We'll stick to SUPER_ADMIN for role config or team edit.
    const canManagePermissions = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";

    // Fetch Team Members
    const { data: team, isLoading: teamLoading } = useQuery({
        queryKey: ["team"],
        queryFn: async () => {
            const res = await api.get("/team");
            return res.data;
        },
        enabled: canViewTeam && activeTab === "members",
    });

    // Fetch Team Status Summary
    const { data: statusSummary, isLoading: statusLoading } = useQuery({
        queryKey: ["team-status-summary"],
        queryFn: async () => {
            const res = await api.get("/user-status/team-summary");
            return res.data;
        },
        enabled: canViewTeam && activeTab === "status",
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    // Toggle Access Mutation
    const toggleAccessMutation = useMutation({
        mutationFn: async (userId) => {
            return await api.patch(`/team/${userId}/toggle`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["team"]);
        },
    });

    // Delete User Mutation
    const deleteMutation = useMutation({
        mutationFn: async (userId) => {
            return await api.delete(`/team/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["team"]);
        },
    });

    // C2C Toggle Mutation
    const c2cMutation = useMutation({
        mutationFn: async (userId) => {
            const res = await api.patch(`/team/${userId}/c2c`);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(["team"]);
            if (data.tempPassword) {
                window.alert(`C2C access granted!\nTeleCMI Extension: ${data.telecmiUserId}\nTemp Password: ${data.tempPassword}\n\nPlease save this password — it won't be shown again.`);
            }
        },
    });

    const formatTime = (date) => {
        if (!date) return "—";
        return new Date(date).toLocaleTimeString("en-US", { 
            hour: "2-digit", 
            minute: "2-digit",
            hour12: true 
        });
    };

    if (teamLoading || statusLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!canViewTeam) {
        return (
            <div className="text-center py-20">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-500 mt-2">You do not have permission to view the team.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
                    <p className="text-sm text-gray-500">Manage access, roles, and real-time status</p>
                </div>
                <div className="flex gap-3">
                    {canManagePermissions && (
                        <button
                            onClick={() => navigate("/team/call-analytics")}
                            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95"
                        >
                            <BarChart2 className="h-4 w-4 mr-2 text-indigo-500" />
                            Call Analytics
                        </button>
                    )}
                    {canCreateTeam && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95"
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add User
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab("members")}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "members"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                >
                    Team Members
                </button>
                <button
                    onClick={() => setActiveTab("status")}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "status"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                >
                    Employee Status
                </button>
            </div>

            {activeTab === "members" ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Access</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {team?.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                                                {member.name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                                    {member.name}
                                                    {member.isC2C && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700"
                                                            title={member.telecmiUserId ? `C2C User ID ${member.telecmiUserId}` : "C2C user"}>
                                                            C2C{member.telecmiUserId ? ` · ${member.telecmiUserId}` : ""}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`capitalize font-medium ${member.role === 'ADMIN' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                            {member.role.toLowerCase().replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {member.department || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {member.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-3">
                                            {canManagePermissions && (
                                                <button
                                                    onClick={() => navigate(`/team/call-analytics/${member.id}`)}
                                                    className="text-gray-400 hover:text-indigo-600"
                                                    title="View Call Analytics"
                                                >
                                                    <BarChart2 className="h-4 w-4" />
                                                </button>
                                            )}
                                            {currentUser.role === "SUPER_ADMIN" && member.role !== "SUPER_ADMIN" && (
                                                <button
                                                    onClick={() => {
                                                        const action = member.isC2C ? "revoke" : "grant";
                                                        if (window.confirm(`${action === "grant" ? "Grant" : "Revoke"} C2C (ZX Call) access for ${member.name}?`)) {
                                                            c2cMutation.mutate(member.id);
                                                        }
                                                    }}
                                                    disabled={c2cMutation.isPending}
                                                    className={member.isC2C ? "text-sky-500 hover:text-red-500" : "text-gray-400 hover:text-sky-600"}
                                                    title={member.isC2C ? "Revoke C2C Access" : "Grant C2C Access"}
                                                >
                                                    {member.isC2C ? <PhoneCall className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                                                </button>
                                            )}
                                            {canEditTeam && (
                                                <button
                                                    onClick={() => setEditingUser(member)}
                                                    className="text-gray-400 hover:text-indigo-600"
                                                    title="Edit Details"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                            )}

                                            {canManagePermissions && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedUserForPermissions(member);
                                                        setIsPermissionModalOpen(true);
                                                    }}
                                                    className="text-gray-400 hover:text-indigo-600"
                                                    title="Manage Permissions"
                                                >
                                                    <Shield className="h-4 w-4" />
                                                </button>
                                            )}

                                            {member.role !== "SUPER_ADMIN" && (
                                                <>
                                                    {canEditTeam && (
                                                        <button
                                                            onClick={() => toggleAccessMutation.mutate(member.id)}
                                                            className={`text-gray-400 hover:text-gray-600 ${member.isActive ? 'text-green-600' : 'text-red-500'}`}
                                                            title={member.isActive ? "Deactivate" : "Activate"}
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canDeleteTeam && (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to delete this user?")) {
                                                                    deleteMutation.mutate(member.id)
                                                                }
                                                            }}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in / Check-out</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Online Duration</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Break Duration</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Live Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {statusSummary?.map((summary) => (
                                <tr key={summary.id} className="hover:bg-gray-50/80 transition-all duration-200">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                {summary.name[0]}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900 tracking-tight">{summary.name}</div>
                                                <div className="text-xs text-gray-500 font-medium">{summary.department || "General Operations"}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <div className="w-1 h-3 bg-green-500 rounded-full"></div>
                                                <span className="text-gray-400 font-bold uppercase tracking-tighter">Check-in</span>
                                                <span className="text-gray-900 font-semibold">{formatTime(summary.checkIn)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <div className="w-1 h-3 bg-red-400 rounded-full"></div>
                                                <span className="text-gray-400 font-bold uppercase tracking-tighter">Check-out</span>
                                                <span className="text-gray-900 font-semibold">{formatTime(summary.checkOut)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                                                parseFloat(summary.onlineHrs) > 0 
                                                ? "bg-green-50 text-green-700 border-green-100 shadow-sm" 
                                                : "bg-gray-50 text-gray-400 border-gray-100"
                                            }`}>
                                                <Clock className="h-3 w-3" />
                                                {summary.onlineHrs} hrs
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                                                parseFloat(summary.breakHrs) > 0 
                                                ? "bg-amber-50 text-amber-700 border-amber-100 shadow-sm" 
                                                : "bg-gray-50 text-gray-400 border-gray-100"
                                            }`}>
                                                <Power className="h-3 w-3" />
                                                {summary.breakHrs} hrs
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right">
                                        <span className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-[10px] leading-4 font-bold rounded-xl uppercase tracking-widest border shadow-sm transition-all
                                            ${summary.currentStatus === 'ONLINE' ? 'bg-green-50 text-green-700 border-green-200' : 
                                              summary.currentStatus === 'BREAK' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                              'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                                summary.currentStatus === 'ONLINE' ? 'bg-green-500' : 
                                                summary.currentStatus === 'BREAK' ? 'bg-amber-500' : 
                                                'bg-gray-400'
                                            }`}></div>
                                            {summary.currentStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {statusSummary?.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">No activity recorded for today.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Team Member"
            >
                <AddUserForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title="Edit Team Member"
            >
                {editingUser && (
                    <EditUserForm
                        user={editingUser}
                        onClose={() => setEditingUser(null)}
                    />
                )}
            </Modal>

            {/* Permissions Modal */}
            <Modal
                isOpen={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                title={selectedUserForPermissions ? `Permissions: ${selectedUserForPermissions.name}` : "Role & User Permissions"}
                maxWidth="max-w-6xl"
            >
                <div className="max-h-[80vh] overflow-y-auto">
                    <PermissionManager initialMode={selectedUserForPermissions ? "user" : "role"} initialUser={selectedUserForPermissions} />
                </div>
            </Modal>
        </div>
    );
};

export default Team;
