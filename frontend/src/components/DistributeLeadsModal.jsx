import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Users, Check, Search, Shield, User as UserIcon, Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const DistributeLeadsModal = ({ leadIds, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [tab, setTab] = useState("members"); // "members" | "department"
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [distributionCounts, setDistributionCounts] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [selectedDeptId, setSelectedDeptId] = useState("");

    const { data: team, isLoading } = useQuery({
        queryKey: ["team"],
        queryFn: async () => (await api.get("/team")).data,
    });

    const { data: roles } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => (await api.get("/permissions/roles")).data,
    });

    const { data: departments } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get("/departments")).data,
        enabled: tab === "department",
    });

    const distributeMutation = useMutation({
        mutationFn: async () => {
            const distributions = Object.entries(distributionCounts)
                .filter(([, count]) => count > 0)
                .map(([userId, count]) => ({ userId, count }));
            return await api.patch("/leads/bulk-distribute", {
                leadIds,
                distributions: distributions.length > 0 ? distributions : null,
                userIds: distributions.length === 0 ? selectedUserIds : null,
            });
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); onSuccess(); onClose(); },
        onError: (err) => alert(`⚠️ Distribution Blocked: ${err.response?.data?.message || "Failed. Check lead scores (25+)."}`),
    });

    const deptDistributeMutation = useMutation({
        mutationFn: async () => api.patch("/leads/bulk-distribute-dept", { leadIds, departmentId: selectedDeptId }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); onSuccess(); onClose(); },
        onError: (err) => alert(`⚠️ Distribution Blocked: ${err.response?.data?.message || "Failed to distribute."}`),
    });

    const toggleUser = (id) => setSelectedUserIds(prev =>
        prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );

    const handleSelectByRole = (role) => {
        const ids = availableUsers.filter(u => u.role === role).map(u => u.id);
        const allSelected = ids.every(id => selectedUserIds.includes(id));
        setSelectedUserIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
    };

    const handleCountChange = (userId, value) => {
        const count = parseInt(value) || 0;
        if (count > 0 && !selectedUserIds.includes(userId)) setSelectedUserIds(prev => [...prev, userId]);
        setDistributionCounts(prev => ({ ...prev, [userId]: count }));
    };

    const totalAssigned = useMemo(() =>
        Object.values(distributionCounts).reduce((sum, c) => sum + c, 0), [distributionCounts]);

    const balanceLeads = leadIds.length - totalAssigned;

    const handleAutoSplit = () => {
        if (selectedUserIds.length === 0) { alert("Select team members first."); return; }
        const perPerson = Math.floor(leadIds.length / selectedUserIds.length);
        const extra = leadIds.length % selectedUserIds.length;
        const newCounts = {};
        selectedUserIds.forEach((id, i) => { newCounts[id] = perPerson + (i < extra ? 1 : 0); });
        setDistributionCounts(newCounts);
    };

    const handleDistribute = () => {
        if (selectedUserIds.length === 0 && totalAssigned === 0) { alert("Select at least one team member."); return; }
        if (totalAssigned > leadIds.length) { alert(`Total assigned (${totalAssigned}) exceeds selected leads (${leadIds.length}).`); return; }
        distributeMutation.mutate();
    };

    const availableUsers = useMemo(() => team?.filter(u => {
        if (!u.isActive) return false;
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
        if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") return u.role === "TEAM_LEAD";
        if (user?.role === "TEAM_LEAD") return u.role === "EMPLOYEE";
        return u.role === "EMPLOYEE" || u.role === "TEAM_LEAD";
    }) || [], [team, searchQuery, roleFilter, user]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-gray-500">Loading team members...</p>
            </div>
        );
    }

    return (
        <div className="p-0">
            {/* Header + tabs */}
            <div className="p-6 pb-4">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-indigo-50 p-3 rounded-2xl">
                        <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Distribute Leads</h2>
                        <p className="text-sm font-medium text-gray-500">
                            Assign <span className="text-indigo-600 font-bold">{leadIds.length}</span> qualified leads to your team
                        </p>
                        <p className="text-[10px] text-amber-600 font-bold uppercase mt-1 flex items-center gap-1">
                            <Shield className="h-2.5 w-2.5" /> Only leads with score 25+ are eligible
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
                    {[
                        { id: "members", Icon: Users, label: "Select Members" },
                        { id: "department", Icon: Building2, label: "By Department" },
                    ].map(({ id, Icon, label }) => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                                tab === id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── By Department tab ─────────────────────────────── */}
            {tab === "department" && (
                <div className="px-6 pb-6 space-y-3">
                    <p className="text-xs text-gray-500 font-medium">
                        Select a department — leads are split equally via round-robin across all active members.
                    </p>
                    {departments && departments.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                            {departments.map(dept => (
                                <div key={dept.id} onClick={() => setSelectedDeptId(dept.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                                        selectedDeptId === dept.id
                                            ? "bg-indigo-50/50 border-indigo-200 shadow-sm"
                                            : "bg-white border-gray-100 hover:border-gray-200"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                            selectedDeptId === dept.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"
                                        }`}>
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{dept.name}</p>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                {dept._count?.users || 0} members
                                                {dept.c2c && <span className="ml-2 text-green-600">· C2C</span>}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedDeptId === dept.id && (
                                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                                            <Check className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-sm text-gray-400 font-medium">No departments found.</div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-4 border-2 border-gray-100 rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">
                            Cancel
                        </button>
                        <button onClick={() => deptDistributeMutation.mutate()}
                            disabled={!selectedDeptId || deptDistributeMutation.isPending}
                            className="flex-[2] px-4 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            {deptDistributeMutation.isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Distributing...</>
                                : "Distribute to Department"
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* ── Select Members tab ────────────────────────────── */}
            {tab === "members" && (
                <div>
                    {/* Filters */}
                    <div className="px-6 pb-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input type="text" placeholder="Search by name or email..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => setRoleFilter("ALL")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${roleFilter === "ALL" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                                All
                            </button>
                            {roles?.filter(r => {
                                if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") return r.name === "TEAM_LEAD";
                                if (user?.role === "TEAM_LEAD") return r.name === "EMPLOYEE";
                                return r.name === "EMPLOYEE" || r.name === "TEAM_LEAD";
                            }).map(role => (
                                <button key={role.name} onClick={() => setRoleFilter(role.name)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${roleFilter === role.name ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                                    {role.name.replace(/_/g, " ")}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between">
                            {roleFilter !== "ALL" && (
                                <button onClick={() => handleSelectByRole(roleFilter)}
                                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors">
                                    <Shield className="h-3 w-3" /> Select all {roleFilter.replace(/_/g, " ")}s
                                </button>
                            )}
                            {selectedUserIds.length > 0 && (
                                <button onClick={handleAutoSplit}
                                    className="ml-auto text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                                    <Users className="h-3 w-3" /> Smart Split Equally
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Team list */}
                    <div className="px-6">
                        <div className="max-h-72 overflow-y-auto pr-1 space-y-2 mb-6 custom-scrollbar">
                            {availableUsers.length > 0 ? availableUsers.map((member) => (
                                <div key={member.id} onClick={() => toggleUser(member.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                                        selectedUserIds.includes(member.id) ? "bg-indigo-50/50 border-indigo-200 shadow-sm" : "bg-white border-gray-100 hover:border-gray-200"
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${selectedUserIds.includes(member.id) ? "bg-indigo-600 text-white rotate-6" : "bg-gray-100 text-gray-500"}`}>
                                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-none mb-1">{member.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1">
                                                {member.role === "ADMIN" && <Shield className="h-2.5 w-2.5 text-indigo-500" />}
                                                {member.role === "TEAM_LEAD" && <Users className="h-2.5 w-2.5 text-amber-500" />}
                                                {member.role === "EMPLOYEE" && <UserIcon className="h-2.5 w-2.5 text-gray-400" />}
                                                {member.role}
                                                <span className="mx-1 opacity-30">•</span>
                                                <span className="text-indigo-600 font-bold">{member.leadCount || 0} Leads</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            <p className="text-[9px] font-black text-indigo-600 uppercase">Leads</p>
                                            <input type="number" min="0" max={leadIds.length}
                                                value={distributionCounts[member.id] || ""} placeholder="0"
                                                onChange={(e) => handleCountChange(member.id, e.target.value)}
                                                className="w-16 px-2 py-1.5 bg-white border-2 border-indigo-100 rounded-xl text-xs font-bold text-indigo-600 focus:border-indigo-500 focus:ring-0 outline-none text-center transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedUserIds.includes(member.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-200"}`}>
                                            {selectedUserIds.includes(member.id) && <Check className="h-4 w-4 text-white" />}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-10 text-center">
                                    <p className="text-sm text-gray-400 font-medium">No team members found.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 pt-0 bg-white">
                        {(selectedUserIds.length > 0 || totalAssigned > 0) && (
                            <div className="mb-6 p-5 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] text-white shadow-2xl shadow-indigo-900/40 animate-in zoom-in-95 duration-300 relative overflow-hidden border border-white/10">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Users className="h-20 w-20" />
                                </div>
                                <div className="flex justify-between items-center relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-1">Distribution Summary</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold">{selectedUserIds.length} Team Members</span>
                                            {totalAssigned > 0 && (
                                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-tighter rounded-md border border-emerald-500/30">
                                                    Split Active
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-white/50 font-medium">Total leads to distribute: {leadIds.length}</p>
                                        {totalAssigned > 0 && (
                                            <div className="mt-4 space-y-1 pt-3 border-t border-white/10 max-h-24 overflow-y-auto custom-scrollbar">
                                                {Object.entries(distributionCounts).map(([uid, count]) => {
                                                    if (count <= 0) return null;
                                                    const m = team?.find(u => u.id === uid);
                                                    return (
                                                        <div key={uid} className="flex justify-between items-center text-[10px] font-bold">
                                                            <span className="text-indigo-200 uppercase tracking-wider truncate max-w-[120px]">{m?.name}</span>
                                                            <span className="bg-white/10 px-2 py-0.5 rounded text-white">{count} Leads</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-8 text-right">
                                        <div>
                                            <p className="text-3xl font-black text-white">{totalAssigned}</p>
                                            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Assigned</p>
                                        </div>
                                        <div className="w-px h-10 bg-white/10 self-center" />
                                        <div>
                                            <p className={`text-3xl font-black ${balanceLeads < 0 ? "text-red-400" : balanceLeads === 0 ? "text-emerald-400" : "text-amber-400"}`}>{balanceLeads}</p>
                                            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Remaining</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={onClose}
                                className="flex-1 px-4 py-4 border-2 border-gray-100 rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-50 hover:border-gray-200 transition-all uppercase tracking-widest">
                                Cancel
                            </button>
                            <button onClick={handleDistribute}
                                disabled={selectedUserIds.length === 0 || distributeMutation.isPending}
                                className="flex-[2] px-4 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                {distributeMutation.isPending
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Distributing...</>
                                    : "Confirm Distribution"
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistributeLeadsModal;
