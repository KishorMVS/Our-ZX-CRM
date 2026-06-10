import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useVoiceLink } from "../context/VoiceLinkContext";
import DashboardStats from "../components/DashboardStats";
import ConversionFunnel from "../components/ConversionFunnel";
import RevenueChart from "../components/RevenueChart";
import {
    Loader2, Users, Target, CheckSquare, TrendingUp,
    ChevronRight, AlertTriangle, ArrowUpRight,
    Flame, Thermometer, Snowflake, Clock, PhoneCall,
    BarChart2, CalendarDays, Zap, Trophy,
} from "lucide-react";

const STATUS_META = {
    NEW: { label: "New", color: "#38bdf8", bar: "bg-sky-400", chip: "bg-sky-50 text-sky-700" },
    CONTACTED: { label: "Contacted", color: "#60a5fa", bar: "bg-blue-400", chip: "bg-blue-50 text-blue-700" },
    FOLLOW_UP: { label: "Follow Up", color: "#a78bfa", bar: "bg-violet-400", chip: "bg-violet-50 text-violet-700" },
    IN_PROGRESS: { label: "In Progress", color: "#fbbf24", bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700" },
    CONVERTED: { label: "Won", color: "#34d399", bar: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-700" },
    LOST: { label: "Lost", color: "#f87171", bar: "bg-rose-400", chip: "bg-rose-50 text-rose-700" },
};

const CAT_META = {
    "Hot Lead": { Icon: Flame, border: "border-l-rose-500", dot: "bg-rose-500", text: "text-rose-600" },
    "Warm Lead": { Icon: Thermometer, border: "border-l-amber-400", dot: "bg-amber-400", text: "text-amber-600" },
    "Cold Lead": { Icon: Snowflake, border: "border-l-sky-400", dot: "bg-sky-400", text: "text-sky-600" },
};

const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};

// ── Small reusable presentational pieces (Team Lead dashboard) ──────────────
function StatCard({ label, value, sub, Icon, color, iconColor }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                {Icon && <Icon className={`h-4 w-4 ${iconColor || "text-gray-300"}`} />}
            </div>
            <p className={`text-4xl font-black ${color || "text-gray-800"} leading-none tabular-nums`}>{value}</p>
            <p className="text-xs text-gray-400 font-semibold mt-2">{sub}</p>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="text-center sm:text-left">
            <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
        </div>
    );
}

// Per-member drill-down report — shape adapts to whether the member is C2C
function MemberReportModal({ report, loading, onClose }) {
    const isC2C = !!report?.isC2C;
    const L = report?.leads || {};
    const C = report?.calls || {};
    const T = report?.tasks || {};
    const A = report?.attendance || {};
    const sprints = report?.sprints || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {loading || !report ? (
                    <div className="py-20 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">{report.member?.name}</h2>
                                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
                                    {report.member?.role}{report.member?.department ? ` · ${report.member.department}` : ""}
                                </p>
                                <span className={`inline-block mt-2 text-[10px] font-black px-2 py-0.5 rounded-full ${isC2C ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                                    {isC2C ? "C2C — Leads & Calls" : "Tasks & Sprints"}
                                </span>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                {isC2C ? (
                                    <>
                                        <MiniStat label="Total Leads" value={L.total ?? 0} />
                                        <MiniStat label="Converted" value={L.converted ?? 0} />
                                        <MiniStat label="Conversion" value={`${L.conversionRate ?? 0}%`} />
                                        <MiniStat label="Active Leads" value={L.active ?? 0} />
                                        <MiniStat label="Calls (month)" value={C.thisMonth ?? 0} />
                                        <MiniStat label="Connected" value={C.connected ?? 0} />
                                        <MiniStat label="Talk Time" value={`${C.talkTimeMinutes ?? 0}m`} />
                                    </>
                                ) : (
                                    <>
                                        <MiniStat label="Total Tasks" value={T.total ?? 0} />
                                        <MiniStat label="Done" value={T.done ?? 0} />
                                        <MiniStat label="Pending" value={T.pending ?? 0} />
                                        <MiniStat label="Overdue" value={T.overdue ?? 0} />
                                    </>
                                )}
                                <MiniStat label="Days Present (month)" value={A.daysThisMonth ?? 0} />
                                <MiniStat label="Today" value={A.presentToday ? "Present" : "Absent"} />
                            </div>

                            {!isC2C && sprints.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sprints</p>
                                    <div className="space-y-1.5">
                                        {sprints.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className="font-semibold text-gray-700 truncate">{s.name}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    s.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                                                    s.status === "COMPLETED" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                                                }`}>{s.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { hasClient, isKycComplete, checking: vlChecking } = useVoiceLink() || {};
    const isSuperAdmin    = user?.role === "SUPER_ADMIN";
    const isPlatformOwner = user?.role === "PLATFORM_OWNER";
    const isTeamLead      = user?.role === "TEAM_LEAD";
    const isEmployee      = user?.role === "EMPLOYEE";
    const isPersonalView  = isEmployee; // only pure employees get personal dashboard
    const [time, setTime] = useState(
        new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    );

    useEffect(() => {
        const id = setInterval(
            () => setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })),
            60000
        );
        return () => clearInterval(id);
    }, []);

    // Personal stats — only for pure EMPLOYEE role
    const { data: myStats, isLoading: myLoading } = useQuery({
        queryKey: ["my-dashboard"],
        queryFn: async () => (await api.get("/analytics/my-dashboard")).data,
        enabled: isPersonalView,
    });

    // Team lead dashboard — dept-scoped stats
    const { data: teamStats, isLoading: teamLoading } = useQuery({
        queryKey: ["team-dashboard"],
        queryFn: async () => (await api.get("/analytics/team-dashboard")).data,
        enabled: isTeamLead,
    });

    // Per-member drill-down report (opened from the team table)
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const { data: memberReport, isLoading: memberLoading } = useQuery({
        queryKey: ["team-member-report", selectedMemberId],
        queryFn: async () => (await api.get(`/analytics/team-dashboard/member/${selectedMemberId}`)).data,
        enabled: !!selectedMemberId,
    });

    // Workspace-wide stats — ADMIN and SUPER_ADMIN
    const isAdminView = isSuperAdmin || user?.role === "ADMIN";
    const { data: analytics, isLoading: al } = useQuery({
        queryKey: ["dashboard-analytics"],
        queryFn: async () => (await api.get("/analytics/dashboard")).data,
        enabled: isAdminView,
    });
    const { data: leads, isLoading: ll } = useQuery({
        queryKey: ["leads"],
        queryFn: async () => (await api.get("/leads")).data,
        enabled: isAdminView,
    });
    const { data: tasks, isLoading: tl } = useQuery({
        queryKey: ["tasks"],
        queryFn: async () => (await api.get("/tasks")).data,
        enabled: isAdminView,
    });
    const { data: zxCall } = useQuery({
        queryKey: ["zxcall-my"],
        queryFn: async () => (await api.get("/zxcall/my")).data,
        enabled: isAdminView,
        refetchInterval: (query) => {
            const st = query.state.data?.request?.status;
            return st && st !== "ACTIVE" ? 20000 : false;
        },
    });

    // ── Employee personal dashboard ───────────────────────────────────────
    if (isPersonalView) {
        if (myLoading) {
            return (
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                        <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Loading your dashboard</p>
                    </div>
                </div>
            );
        }

        const wp = myStats?.workProfile ?? "general";
        const L  = myStats?.leads   ?? {};
        const T  = myStats?.tasks   ?? {};
        const C  = myStats?.calls   ?? {};
        const A  = myStats?.attendance ?? {};
        const LV = myStats?.leave   ?? {};

        const taskDonePercent = T.totalTasks > 0 ? Math.round((T.doneTasks / T.totalTasks) * 100) : 0;
        const circum = 2 * Math.PI * 22;
        const taskDash = circum * (1 - taskDonePercent / 100);

        return (
            <div className="pb-16 space-y-7">
                {/* Header */}
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            <span className="ml-3 text-gray-300">·</span>
                            <span className="ml-3 text-indigo-500">{time}</span>
                        </p>
                        <h1 className="text-[2rem] font-black text-gray-950 tracking-tight leading-none">
                            {getGreeting()},{" "}
                            <span className="text-indigo-600">{user?.name?.split(" ")[0] || "there"}</span>
                        </h1>
                        <p className="text-sm text-gray-400 mt-1.5 font-medium">Here's your personal performance overview.</p>
                    </div>
                    {T.overdueTasks > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex-shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {T.overdueTasks} overdue tasks
                        </span>
                    )}
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(wp === "sales" || wp === "both") && (
                        <>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">My Leads</p>
                                    <Users className="h-4 w-4 text-sky-400/60" />
                                </div>
                                <p className="text-4xl font-black text-sky-500 leading-none tabular-nums">{L.totalLeads ?? 0}</p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{L.activeLeads ?? 0} active</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conversion</p>
                                    <Target className="h-4 w-4 text-emerald-400/60" />
                                </div>
                                <p className="text-4xl font-black text-emerald-500 leading-none tabular-nums">{L.conversionRate ?? 0}%</p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{L.convertedLeads ?? 0} won</p>
                            </div>
                        </>
                    )}
                    {(wp === "tasks" || wp === "both") && (
                        <>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">My Tasks</p>
                                    <CheckSquare className="h-4 w-4 text-indigo-400/60" />
                                </div>
                                <p className="text-4xl font-black text-indigo-500 leading-none tabular-nums">{T.totalTasks ?? 0}</p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{T.doneTasks ?? 0} done</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Sprints</p>
                                    <Zap className="h-4 w-4 text-amber-400/60" />
                                </div>
                                <p className="text-4xl font-black text-amber-500 leading-none tabular-nums">
                                    {(myStats?.sprints ?? []).filter(s => s.status === "ACTIVE").length}
                                </p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{(myStats?.sprints ?? []).length} total</p>
                            </div>
                        </>
                    )}
                    {wp === "general" && (
                        <>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">My Tasks</p>
                                    <CheckSquare className="h-4 w-4 text-indigo-400/60" />
                                </div>
                                <p className="text-4xl font-black text-indigo-500 leading-none tabular-nums">{T.totalTasks ?? 0}</p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{T.pendingTasks ?? 0} pending</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">My Leads</p>
                                    <Users className="h-4 w-4 text-sky-400/60" />
                                </div>
                                <p className="text-4xl font-black text-sky-500 leading-none tabular-nums">{L.totalLeads ?? 0}</p>
                                <p className="text-xs text-gray-400 font-semibold mt-2">{L.activeLeads ?? 0} active</p>
                            </div>
                        </>
                    )}
                    {/* Call analytics are specific to C2C members */}
                    {(wp === "sales" || wp === "both") && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-start justify-between mb-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Calls (month)</p>
                                <PhoneCall className="h-4 w-4 text-violet-400/60" />
                            </div>
                            <p className="text-4xl font-black text-violet-500 leading-none tabular-nums">{C.thisMonth ?? 0}</p>
                            <p className="text-xs text-gray-400 font-semibold mt-2">this month</p>
                        </div>
                    )}
                    {/* Attendance is shown for everyone */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-start justify-between mb-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance</p>
                            <CalendarDays className="h-4 w-4 text-teal-400/60" />
                        </div>
                        <p className="text-4xl font-black text-teal-500 leading-none tabular-nums">{A.daysThisMonth ?? 0}</p>
                        <p className="text-xs text-gray-400 font-semibold mt-2">days this month</p>
                    </div>
                </div>

                {/* Detail panels */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Task progress */}
                    {(wp === "tasks" || wp === "both" || wp === "general") && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h2 className="text-sm font-black text-gray-900">Task Progress</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Your open vs completed tasks</p>
                            </div>
                            <div className="px-6 py-5 flex items-center gap-6">
                                <div className="relative w-[60px] h-[60px] flex-shrink-0">
                                    <svg className="w-[60px] h-[60px] -rotate-90" viewBox="0 0 52 52">
                                        <circle cx="26" cy="26" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                                        <circle cx="26" cy="26" r="22" fill="none"
                                            stroke={T.overdueTasks > 0 ? "#f87171" : "#34d399"}
                                            strokeWidth="5" strokeLinecap="round"
                                            strokeDasharray={circum} strokeDashoffset={taskDash}
                                            style={{ transition: "stroke-dashoffset 0.5s ease" }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-black text-gray-800">{taskDonePercent}%</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 flex-1">
                                    {[
                                        { label: "Done", val: T.doneTasks ?? 0, color: "text-emerald-600" },
                                        { label: "Pending", val: T.pendingTasks ?? 0, color: "text-amber-600" },
                                        { label: "Overdue", val: T.overdueTasks ?? 0, color: "text-rose-600" },
                                        { label: "Total", val: T.totalTasks ?? 0, color: "text-gray-700" },
                                    ].map(({ label, val, color }) => (
                                        <div key={label}>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                                            <p className={`text-xl font-black ${color} tabular-nums`}>{val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="px-6 pb-4">
                                <button onClick={() => navigate("/tasks")}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2.5 rounded-xl transition-colors">
                                    View My Tasks <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sales pipeline or sprints */}
                    {(wp === "sales" || wp === "both") && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h2 className="text-sm font-black text-gray-900">My Pipeline</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Personal lead pipeline value</p>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                {[
                                    { label: "Total Leads", val: L.totalLeads ?? 0, color: "bg-sky-500" },
                                    { label: "Active", val: L.activeLeads ?? 0, color: "bg-indigo-500" },
                                    { label: "Converted", val: L.convertedLeads ?? 0, color: "bg-emerald-500" },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                                        <span className="text-xs font-semibold text-gray-600 flex-1">{label}</span>
                                        <span className="text-sm font-black text-gray-900 tabular-nums">{val}</span>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-500">Pipeline Value</span>
                                        <span className="text-sm font-black text-indigo-700">
                                            ₹{(L.pipelineValue ?? 0).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 pb-4">
                                <button onClick={() => navigate("/leads")}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2.5 rounded-xl transition-colors">
                                    View My Leads <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sprints for tasks profile */}
                    {(wp === "tasks" || wp === "both") && myStats?.sprints?.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h2 className="text-sm font-black text-gray-900">My Sprints</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Recent sprint activity</p>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {myStats.sprints.map(s => (
                                    <div key={s.name} className="px-6 py-3.5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{s.name}</p>
                                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                                                {s.startDate ? new Date(s.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                                {" → "}
                                                {s.endDate ? new Date(s.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                            s.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                                            s.status === "COMPLETED" ? "bg-gray-100 text-gray-500" :
                                            "bg-amber-100 text-amber-700"
                                        }`}>{s.status}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="px-6 pb-4 pt-2">
                                <button onClick={() => navigate("/sprints")}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2.5 rounded-xl transition-colors">
                                    View Sprints <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Leave balance */}
                    {(LV.annualBalance !== null || LV.sickBalance !== null) && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h2 className="text-sm font-black text-gray-900">Leave Balance</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Remaining leave days</p>
                            </div>
                            <div className="px-6 py-5 grid grid-cols-3 gap-4">
                                {[
                                    { label: "Annual", val: LV.annualBalance },
                                    { label: "Sick", val: LV.sickBalance },
                                    { label: "Casual", val: LV.casualBalance },
                                ].filter(({ val }) => val !== null).map(({ label, val }) => (
                                    <div key={label} className="text-center">
                                        <p className="text-2xl font-black text-gray-900 tabular-nums">{val ?? "—"}</p>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-1">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    // ── End employee dashboard ────────────────────────────────────────────

    // ── Team Lead department dashboard ────────────────────────────────────
    if (isTeamLead) {
        if (teamLoading) {
            return (
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                        <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Loading team dashboard</p>
                    </div>
                </div>
            );
        }

        const TL = teamStats || {};
        const isC2CTeam = !!TL.isC2C;
        const TLLeads = TL.leads || {};
        const TLTasks = TL.tasks || {};
        const TLCalls = TL.calls || {};
        const TLAtt   = TL.attendance || {};
        const TLMembers = TL.members || [];
        const ME = TL.me || {};
        const meTasks = ME.tasks || {};
        const meLeads = ME.leads || {};
        const meCalls = ME.calls || {};

        // Quick links differ by team type
        const quickLinks = isC2CTeam
            ? [
                { label: "Leads", path: "/leads", color: "bg-sky-50 text-sky-700 border-sky-100" },
                { label: "Call Logs", path: "/call-logs", color: "bg-violet-50 text-violet-700 border-violet-100" },
                { label: "Attendance", path: "/attendance", color: "bg-teal-50 text-teal-700 border-teal-100" },
            ]
            : [
                { label: "Tasks", path: "/tasks", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
                { label: "Sprints", path: "/sprints", color: "bg-amber-50 text-amber-700 border-amber-100" },
                { label: "Kanban", path: "/kanban", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100" },
                { label: "Attendance", path: "/attendance", color: "bg-teal-50 text-teal-700 border-teal-100" },
            ];

        return (
            <div className="pb-16 space-y-7">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            <span className="ml-3 text-gray-300">·</span>
                            <span className="ml-3 text-indigo-500">{time}</span>
                        </p>
                        <h1 className="text-[2rem] font-black text-gray-950 tracking-tight leading-none">
                            {getGreeting()}, <span className="text-indigo-600">{user?.name?.split(" ")[0] || "there"}</span>
                        </h1>
                        <p className="text-sm text-gray-400 mt-1.5 font-medium">
                            {TL.departmentName || "Your Team"} — {TL.memberCount || 0} members
                            <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full ${isC2CTeam ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                                {isC2CTeam ? "C2C TEAM" : "TASK TEAM"}
                            </span>
                        </p>
                    </div>
                    {!isC2CTeam && TLTasks.overdue > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex-shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {TLTasks.overdue} overdue tasks
                        </span>
                    )}
                </div>

                {/* Summary stat cards — C2C: leads + calls; non-C2C: tasks + sprints */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {isC2CTeam ? (
                        <>
                            <StatCard label="Team Leads" value={TLLeads.total ?? 0} sub={`${TLLeads.active ?? 0} active`} Icon={Users} color="text-sky-500" iconColor="text-sky-400/60" />
                            <StatCard label="Conversion" value={`${TLLeads.conversionRate ?? 0}%`} sub={`${TLLeads.converted ?? 0} won`} Icon={Target} color="text-emerald-500" iconColor="text-emerald-400/60" />
                            <StatCard label="Calls (month)" value={TLCalls.thisMonth ?? 0} sub={`${TLCalls.connected ?? 0} connected`} Icon={PhoneCall} color="text-violet-500" iconColor="text-violet-400/60" />
                            <StatCard label="Present Today" value={TLAtt.presentToday ?? 0} sub={`of ${TLAtt.totalMembers ?? 0} members`} Icon={CalendarDays} color="text-teal-500" iconColor="text-teal-400/60" />
                        </>
                    ) : (
                        <>
                            <StatCard label="Team Tasks" value={TLTasks.total ?? 0} sub={`${TLTasks.done ?? 0} done`} Icon={CheckSquare} color="text-indigo-500" iconColor="text-indigo-400/60" />
                            <StatCard label="Overdue" value={TLTasks.overdue ?? 0} sub="past due date" Icon={AlertTriangle} color={TLTasks.overdue > 0 ? "text-rose-500" : "text-gray-400"} iconColor="text-rose-400/60" />
                            <StatCard label="Active Sprints" value={TL.activeSprints ?? 0} sub="running now" Icon={Zap} color="text-amber-500" iconColor="text-amber-400/60" />
                            <StatCard label="Present Today" value={TLAtt.presentToday ?? 0} sub={`of ${TLAtt.totalMembers ?? 0} members`} Icon={CalendarDays} color="text-teal-500" iconColor="text-teal-400/60" />
                        </>
                    )}
                </div>

                {/* My own data — separate panel for the team lead */}
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-indigo-500" />
                            <h2 className="text-sm font-black text-gray-900">My Performance</h2>
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Just you</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {isC2CTeam ? (
                            <>
                                <MiniStat label="My Leads" value={meLeads.total ?? 0} />
                                <MiniStat label="My Conversion" value={`${meLeads.conversionRate ?? 0}%`} />
                                <MiniStat label="My Calls" value={meCalls.thisMonth ?? 0} />
                                <MiniStat label="Talk Time" value={`${meCalls.talkTimeMinutes ?? 0}m`} />
                            </>
                        ) : (
                            <>
                                <MiniStat label="My Tasks" value={meTasks.total ?? 0} />
                                <MiniStat label="Done" value={meTasks.done ?? 0} />
                                <MiniStat label="Pending" value={meTasks.pending ?? 0} />
                                <MiniStat label="Overdue" value={meTasks.overdue ?? 0} />
                            </>
                        )}
                    </div>
                </div>

                {/* Member breakdown table — click a member to drill into their report */}
                {TLMembers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black text-gray-900">Team Performance</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                                    {isC2CTeam ? "Leads and calls per member" : "Tasks per member"} · click a member for full report
                                </p>
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                                {TLMembers.length} members
                            </span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {TLMembers.map(m => (
                                <button key={m.id} onClick={() => setSelectedMemberId(m.id)}
                                    className="w-full px-6 py-3.5 flex items-center gap-4 text-left hover:bg-indigo-50/40 transition-colors">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 flex-shrink-0">
                                        {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                                            {m.name}
                                            {m.id === user?.id && <span className="text-[9px] font-black text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded">YOU</span>}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">{m.role}</p>
                                    </div>
                                    <div className="flex items-center gap-6 text-right flex-shrink-0">
                                        {isC2CTeam ? (
                                            <>
                                                <div>
                                                    <p className="text-base font-black text-sky-600 tabular-nums">{m.leads ?? 0}</p>
                                                    <p className="text-[9px] text-gray-400 font-semibold uppercase">Leads</p>
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-emerald-600 tabular-nums">{m.converted ?? 0}</p>
                                                    <p className="text-[9px] text-gray-400 font-semibold uppercase">Won</p>
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-violet-600 tabular-nums">{m.calls ?? 0}</p>
                                                    <p className="text-[9px] text-gray-400 font-semibold uppercase">Calls</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                <p className="text-base font-black text-indigo-600 tabular-nums">{m.tasksDone ?? 0}/{m.tasks ?? 0}</p>
                                                <p className="text-[9px] text-gray-400 font-semibold uppercase">Tasks</p>
                                            </div>
                                        )}
                                        <ChevronRight className="h-4 w-4 text-gray-300" />
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="px-6 py-4">
                            <button onClick={() => navigate("/team")}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2.5 rounded-xl transition-colors">
                                View Full Team <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick links */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {quickLinks.map(({ label, path, color }) => (
                        <button key={path} onClick={() => navigate(path)}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors hover:opacity-80 ${color}`}>
                            {label} <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>

                {/* Member report drawer/modal */}
                {selectedMemberId && (
                    <MemberReportModal
                        report={memberReport}
                        loading={memberLoading}
                        onClose={() => setSelectedMemberId(null)}
                    />
                )}
            </div>
        );
    }
    // ── End team lead dashboard ───────────────────────────────────────────

    if (al || ll || tl) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                    <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Loading dashboard</p>
                </div>
            </div>
        );
    }

    const { summary, funnel, revenueTrend } = analytics || {};
    const allTasks = tasks || [];
    const pending = allTasks.filter(t => t.status === "PENDING");
    const completed = allTasks.filter(t => t.status === "COMPLETED");
    const overdue = pending.filter(t => new Date(t.dueDate) < new Date());
    const totalLeads = leads?.length || 0;
    const recentLeads = [...(leads || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8);

    const statusCounts = (leads || []).reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
    }, {});

    const donePercent = allTasks.length > 0
        ? Math.round((completed.length / allTasks.length) * 100)
        : 0;

    const winRate = totalLeads > 0
        ? Math.round(((statusCounts.CONVERTED || 0) / totalLeads) * 100)
        : 0;

    const circumference = 2 * Math.PI * 22;
    const dashOffset = circumference * (1 - donePercent / 100);

    // ZenCall status card — shown at top for SUPER_ADMIN and PLATFORM_OWNER
    const zenCard = (() => {
        if (isSuperAdmin) {
            if (vlChecking) return null;
            if (!hasClient) return {
                title: "ZenVoice — Activate AI Voice Agent",
                desc: "Deploy an AI voice agent to automate calls and engage your leads directly from the CRM.",
                btnLabel: "Voice",
                btnPath: "/zenvoice/purchase",
                status: "inactive",
            };
            if (!isKycComplete) return {
                title: "ZenVoice KYC Pending",
                desc: "Complete KYC verification to activate your ZenVoice AI voice agent.",
                btnLabel: "Complete KYC",
                btnPath: "/zenvoice?tab=kyc",
                status: "pending",
            };
            return {
                title: "ZenVoice Active",
                desc: "Your AI voice agent is active. Manage your numbers and call workflows.",
                btnLabel: "Open ZenVoice",
                btnPath: "/zenvoice",
                status: "active",
            };
        }
        if (isPlatformOwner) return {
            title: "ZenVoice Reseller",
            desc: "Manage client accounts, deploy AI voice agents, and monitor ZenVoice usage.",
            btnLabel: "Open ZenVoice",
            btnPath: "/zenvoice",
            status: "active",
        };
        return null;
    })();

    const statusColors = {
        active: { bg: "bg-green-50", iconColor: "text-green-600", dot: "bg-green-500", badge: "bg-green-100 text-green-700" },
        pending: { bg: "bg-amber-50", iconColor: "text-amber-600", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
        inactive: { bg: "bg-gray-50", iconColor: "text-gray-400", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-500" },
    };

    return (
        <div className="pb-16 space-y-7">

            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        <span className="ml-3 text-gray-300">·</span>
                        <span className="ml-3 text-indigo-500">{time}</span>
                    </p>
                    <h1 className="text-[2rem] font-black text-gray-950 tracking-tight leading-none">
                        {getGreeting()},{" "}
                        <span className="text-indigo-600">{user?.name?.split(" ")[0] || "there"}</span>
                    </h1>
                    <p className="text-sm text-gray-400 mt-1.5 font-medium">
                        Here's your pipeline overview for today.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    {overdue.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {overdue.length} overdue
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {summary?.newLeadsToday || 0} new today
                    </span>
                </div>
            </div>

            {/* ─── ZenCall Status Card ─────────────────────────────── */}
            {zenCard && (() => {
                const sc = statusColors[zenCard.status];
                return (
                    <div className={`${sc.bg} rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-2.5 h-2.5 rounded-full ${sc.dot} flex-shrink-0 animate-pulse`} />
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-sm font-black text-gray-900">{zenCard.title}</h3>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sc.badge}`}>
                                        {zenCard.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-medium">{zenCard.desc}</p>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <button
                                onClick={() => navigate(zenCard.btnPath)}
                                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                            >
                                {zenCard.btnLabel} <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Super Admin Billing Card ────────────────────────── */}
            {isSuperAdmin && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-indigo-100 p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <BarChart2 className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Subscription & Billing</h3>
                            <p className="text-xs text-gray-500 font-medium">Manage your plan, seats, and payment history</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/subscription")}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex-shrink-0"
                    >
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ─── ZX Call Card ────────────────────────────────────── */}
            {(() => {
                const zxStatus = zxCall?.request?.status;
                // Once activated, the card is no longer needed — hide it.
                if (zxStatus === "ACTIVE") return null;
                const zxPaidAt = zxCall?.request?.paidAt;
                const hoursLeft = zxPaidAt
                    ? Math.max(0, Math.ceil((48 * 3600 * 1000 - (Date.now() - new Date(zxPaidAt).getTime())) / (3600 * 1000)))
                    : 48;
                const meta = {
                    PAID: {
                        badge: "UNLOCKING", badgeCls: "bg-amber-100 text-amber-700",
                        desc: hoursLeft > 0
                            ? `Payment received — your account will be unlocked within ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`
                            : "Payment received — your account will be unlocked very shortly.",
                        btn: "View status",
                    },
                }[zxStatus] || {
                    badge: null,
                    desc: "Enable browser-based click-to-call for your agents. Complete onboarding to get started.",
                    btn: "ZX Call",
                };
                return (
                    <div className="bg-sky-50 rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center flex-shrink-0">
                                <PhoneCall className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-sm font-black text-gray-900">ZX Call — Click-to-Call</h3>
                                    {meta.badge && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${meta.badgeCls}`}>
                                            {meta.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 font-medium">{meta.desc}</p>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <button
                                onClick={() => navigate("/zxcall/onboard")}
                                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 px-4 py-2 rounded-lg transition-colors"
                            >
                                {meta.btn} <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Dark Command Panel ──────────────────────────────── */}
            <div className="bg-[#0c0f1a] rounded-2xl overflow-hidden">
                {/* Top metrics row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5 border-b border-white/5">
                    {[
                        {
                            label: "Total Leads",
                            value: totalLeads,
                            sub: `${summary?.newLeadsToday || 0} added today`,
                            Icon: Users,
                            valueColor: "text-sky-400",
                            iconColor: "text-sky-400/50",
                        },
                        {
                            label: "Converted",
                            value: statusCounts.CONVERTED || 0,
                            sub: `${winRate}% win rate`,
                            Icon: Target,
                            valueColor: "text-emerald-400",
                            iconColor: "text-emerald-400/50",
                        },
                        {
                            label: "Pending Tasks",
                            value: pending.length,
                            sub: overdue.length > 0 ? `${overdue.length} overdue` : "All on schedule",
                            Icon: Clock,
                            valueColor: overdue.length > 0 ? "text-rose-400" : "text-amber-400",
                            iconColor: overdue.length > 0 ? "text-rose-400/50" : "text-amber-400/50",
                        },
                        {
                            label: "In Progress",
                            value: statusCounts.IN_PROGRESS || 0,
                            sub: "Active pipeline",
                            Icon: TrendingUp,
                            valueColor: "text-violet-400",
                            iconColor: "text-violet-400/50",
                        },
                    ].map(({ label, value, sub, Icon, valueColor, iconColor }) => (
                        <div key={label} className="px-6 py-6">
                            <div className="flex items-start justify-between mb-4">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
                                <Icon className={`h-4 w-4 ${iconColor}`} />
                            </div>
                            <p className={`text-[2.5rem] font-black ${valueColor} leading-none tabular-nums`}>{value}</p>
                            <p className="text-xs text-gray-600 font-semibold mt-2">{sub}</p>
                        </div>
                    ))}
                </div>

                {/* Pipeline bar */}
                <div className="px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pipeline Breakdown</p>
                        <p className="text-[10px] font-bold text-gray-600">{totalLeads} total</p>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-white/5">
                        {Object.entries(STATUS_META).map(([status, meta]) => {
                            const pct = totalLeads > 0 ? ((statusCounts[status] || 0) / totalLeads) * 100 : 0;
                            return pct > 0 ? (
                                <div
                                    key={status}
                                    className={`${meta.bar} rounded-full transition-all`}
                                    style={{ width: `${pct}%` }}
                                    title={`${meta.label}: ${statusCounts[status]}`}
                                />
                            ) : null;
                        })}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
                        {Object.entries(STATUS_META).map(([status, meta]) => (
                            <div key={status} className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${meta.bar}`} />
                                <span className="text-[10px] text-gray-500 font-semibold">
                                    {meta.label} <span className="text-gray-700 font-black">{statusCounts[status] || 0}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── DashboardStats ──────────────────────────────────── */}
            <DashboardStats leads={leads} tasks={tasks} analytics={summary} />

            {/* ─── Main Grid: Lead Table + Task Panel ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Lead table (2/3) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-sm font-black text-gray-900">Recent Leads</h2>
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                                {recentLeads.length} latest opportunities
                            </p>
                        </div>
                        <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                            View all <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Table head */}
                    <div className="grid grid-cols-12 px-6 py-2 bg-gray-50/80 border-b border-gray-100">
                        {[
                            { label: "Lead", cols: "col-span-5" },
                            { label: "Category", cols: "col-span-3" },
                            { label: "Status", cols: "col-span-2 text-center" },
                            { label: "Date", cols: "col-span-2 text-right" },
                        ].map(({ label, cols }) => (
                            <div key={label} className={`${cols} text-[9.5px] font-black text-gray-400 uppercase tracking-widest`}>
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 divide-y divide-gray-50">
                        {recentLeads.map((lead) => {
                            const cat = CAT_META[lead.category] || CAT_META["Cold Lead"];
                            const st = STATUS_META[lead.status] || STATUS_META.NEW;
                            return (
                                <div
                                    key={lead.id}
                                    className={`grid grid-cols-12 items-center px-0 py-0 border-l-[3px] ${cat.border} hover:bg-indigo-50/30 transition-colors group cursor-pointer`}
                                >
                                    <div className="col-span-5 flex items-center gap-3 px-6 py-3.5 min-w-0">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm"
                                            style={{ backgroundColor: st.color + "cc" }}
                                        >
                                            {lead.name?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors leading-tight">
                                                {lead.name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-medium truncate">
                                                {lead.source || "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="col-span-3 px-2 py-3.5">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${cat.text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                                            {lead.category || "Cold Lead"}
                                        </span>
                                    </div>

                                    <div className="col-span-2 px-2 py-3.5 flex justify-center">
                                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${st.chip}`}>
                                            {st.label}
                                        </span>
                                    </div>

                                    <div className="col-span-2 px-6 py-3.5 text-right">
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {recentLeads.length === 0 && (
                            <div className="py-16 text-center">
                                <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                                <p className="text-sm text-gray-400 font-medium">No leads yet</p>
                                <p className="text-[11px] text-gray-300 mt-0.5">Leads will appear here once added</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Task panel (1/3) */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="text-sm font-black text-gray-900">Task Queue</h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${overdue.length > 0 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"
                            }`}>
                            {pending.length} open
                        </span>
                    </div>

                    {/* Circular progress */}
                    <div className="flex items-center gap-5 px-5 py-5 border-b border-gray-100">
                        <div className="relative w-[52px] h-[52px] flex-shrink-0">
                            <svg className="w-[52px] h-[52px] -rotate-90" viewBox="0 0 52 52">
                                <circle cx="26" cy="26" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                                <circle
                                    cx="26" cy="26" r="22"
                                    fill="none"
                                    stroke={overdue.length > 0 ? "#f87171" : "#34d399"}
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-black text-gray-800">{donePercent}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900">
                                {completed.length} / {allTasks.length}
                                <span className="text-gray-400 font-semibold text-xs"> done</span>
                            </p>
                            {overdue.length > 0 ? (
                                <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {overdue.length} past due date
                                </p>
                            ) : (
                                <p className="text-[11px] text-emerald-600 font-bold mt-1">All on schedule</p>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 divide-y divide-gray-50 overflow-y-auto max-h-80">
                        {pending.slice(0, 6).map((task) => {
                            const isOverdue = new Date(task.dueDate) < new Date();
                            const isHigh = task.priority === "HIGH" || task.priority === "URGENT";
                            return (
                                <div
                                    key={task.id}
                                    className={`px-5 py-3.5 flex items-start gap-3 transition-colors hover:bg-gray-50 ${isOverdue ? "bg-rose-50/50" : ""}`}
                                >
                                    <div className={`mt-0.5 w-[14px] h-[14px] rounded border-[1.5px] flex-shrink-0 ${isOverdue ? "border-rose-400" : "border-gray-300"}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold truncate ${isOverdue ? "text-rose-700" : "text-gray-800"}`}>
                                            {task.title}
                                        </p>
                                        <p className={`text-[10px] font-semibold mt-0.5 ${isOverdue ? "text-rose-500" : "text-gray-400"}`}>
                                            {isOverdue ? "⚠ Overdue · " : "Due · "}
                                            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                        </p>
                                    </div>
                                    {isHigh && (
                                        <span className="flex-shrink-0 text-[8px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded tracking-wide">
                                            {task.priority}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {pending.length === 0 && (
                            <div className="py-12 text-center">
                                <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <CheckSquare className="h-5 w-5 text-emerald-500" />
                                </div>
                                <p className="text-xs font-bold text-emerald-600">All tasks complete</p>
                                <p className="text-[10px] text-gray-300 mt-0.5">Nothing pending right now</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Charts ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-black text-gray-900">Conversion Funnel</h2>
                            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Lead stage progression</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    </div>
                    <div className="p-6">
                        <ConversionFunnel data={funnel} />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-black text-gray-900">Revenue Trajectory</h2>
                            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Monthly revenue trend</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="p-6">
                        <RevenueChart data={revenueTrend} />
                    </div>
                </div>
            </div>
        </div>
    );
}
