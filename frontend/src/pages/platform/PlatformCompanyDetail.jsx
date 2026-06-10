import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorkspaceDetail, toggleWorkspaceStatus, deleteWorkspace } from "../../api/platform";
import {
    ArrowLeft, Users, Mail, Phone, Globe, CheckCircle2, XCircle,
    Loader2, Calendar, Shield, Crown, UserCheck, User, Trash2, AlertTriangle
} from "lucide-react";

const ROLE_CONFIG = {
    SUPER_ADMIN: { label: "Super Admin", icon: Crown, style: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20" },
    ADMIN: { label: "Admin", icon: Shield, style: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20" },
    TEAM_LEAD: { label: "Team Lead", icon: UserCheck, style: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20" },
    EMPLOYEE: { label: "Employee", icon: User, style: "bg-slate-700/60 text-slate-400 ring-1 ring-slate-600" },
};

const RoleBadge = ({ role }) => {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.style}`}>
            <cfg.icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
};

const PlatformCompanyDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const load = () => {
        setLoading(true);
        getWorkspaceDetail(id)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            await toggleWorkspaceStatus(id);
            load();
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError("");
        try {
            await deleteWorkspace(id);
            navigate("/platform/companies");
        } catch (err) {
            setDeleteError(err.response?.data?.message || "Failed to delete company. Please try again.");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                    <p className="text-slate-500 text-sm">Loading company...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { workspace: ws } = data;
    const isActive = ws.status === "ACTIVE";

    // Group users by role for summary
    const roleCounts = (ws.users || []).reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            {/* Back */}
            <button
                onClick={() => navigate("/platform/companies")}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors group"
            >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to Companies
            </button>

            {/* Company header card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/25 flex items-center justify-center text-2xl font-bold text-indigo-400 shrink-0">
                            {ws.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{ws.name}</h1>
                            <p className="text-slate-500 text-sm mt-0.5">/{ws.slug}</p>
                            <div className="flex items-center gap-2.5 mt-2.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isActive
                                        ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                                        : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                                }`}>
                                    {ws.status}
                                </span>
                                <span className="text-slate-600 text-xs capitalize">
                                    {ws.plan?.toLowerCase()} plan
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={handleToggle}
                            disabled={toggling}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                                isActive
                                    ? "bg-red-500/8 text-red-400 hover:bg-red-500/15 border-red-500/20"
                                    : "bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/20"
                            }`}
                        >
                            {toggling
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
                            }
                            {isActive ? "Suspend Company" : "Activate Company"}
                        </button>

                        <button
                            onClick={() => { setShowDelete(true); setConfirmText(""); setDeleteError(""); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border bg-red-600/10 text-red-400 hover:bg-red-600/20 border-red-600/30"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Company
                        </button>
                    </div>
                </div>

                {/* Contact & meta info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
                    {ws.companySettings?.email && (
                        <div className="flex items-center gap-2.5 text-sm">
                            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="text-slate-300 truncate text-xs">{ws.companySettings.email}</span>
                        </div>
                    )}
                    {ws.companySettings?.phone && (
                        <div className="flex items-center gap-2.5 text-sm">
                            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="text-slate-300 text-xs">{ws.companySettings.phone}</span>
                        </div>
                    )}
                    {ws.companySettings?.website && (
                        <div className="flex items-center gap-2.5 text-sm">
                            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Globe className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="text-slate-300 text-xs truncate">{ws.companySettings.website}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm">
                        <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <span className="text-slate-400 text-xs">
                            {new Date(ws.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </span>
                    </div>
                </div>
            </div>

            {/* User stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                        <Users className="h-3.5 w-3.5" />
                        TOTAL USERS
                    </div>
                    <p className="text-3xl font-bold text-white">{ws._count?.users ?? 0}</p>
                    <p className="text-slate-600 text-xs mt-1">team members</p>
                </div>

                {Object.entries(roleCounts).map(([role, count]) => {
                    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE;
                    return (
                        <div key={role} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                                <cfg.icon className="h-3.5 w-3.5" />
                                {cfg.label.toUpperCase()}
                            </div>
                            <p className="text-3xl font-bold text-white">{count}</p>
                            <p className="text-slate-600 text-xs mt-1">{count === 1 ? "person" : "people"}</p>
                        </div>
                    );
                })}
            </div>

            {/* Users table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-white font-semibold">Team Members</h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                            {ws.users?.length ?? 0} {(ws.users?.length ?? 0) === 1 ? "member" : "members"} in this workspace
                        </p>
                    </div>
                </div>

                {!ws.users?.length ? (
                    <div className="py-14 flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <Users className="h-6 w-6 text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm">No team members yet</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800/60">
                                <th className="text-left px-6 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Member</th>
                                <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Role</th>
                                <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {ws.users?.map(u => (
                                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                                <span className="text-slate-300 text-xs font-semibold">
                                                    {u.name?.[0]?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-medium">{u.name}</p>
                                                <p className="text-slate-500 text-xs">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <RoleBadge role={u.role} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
                                            <span className={`text-xs ${u.isActive ? "text-emerald-400" : "text-slate-500"}`}>
                                                {u.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-slate-500 text-sm">
                                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Delete confirmation modal */}
            {showDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-xl bg-red-500/10 ring-1 ring-red-500/25 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Delete Company</h3>
                                    <p className="text-slate-500 text-xs mt-0.5">This action cannot be undone</p>
                                </div>
                            </div>

                            <p className="text-slate-400 text-sm mt-4 leading-relaxed">
                                This will <span className="text-red-400 font-medium">permanently delete</span> <span className="text-white font-medium">{ws.name}</span> and
                                {" "}all of its data — every user, lead, task, invoice, SLA, call log, email/integration
                                and setting. This cannot be recovered.
                            </p>

                            <div className="mt-5">
                                <label className="block text-slate-400 text-xs mb-2">
                                    Type <span className="text-white font-semibold">{ws.name}</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    autoFocus
                                    placeholder={ws.name}
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>

                            {deleteError && (
                                <p className="text-red-400 text-xs mt-3">{deleteError}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-950/50 border-t border-slate-800">
                            <button
                                onClick={() => setShowDelete(false)}
                                disabled={deleting}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting || confirmText !== ws.name}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                {deleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformCompanyDetail;
