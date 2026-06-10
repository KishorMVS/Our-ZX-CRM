import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Download, TrendingUp, PieChart as PieIcon, Users, Shield,
    Loader2, BarChart3, Activity, Target, Clock, ArrowUpRight,
    CheckCircle2, AlertCircle, Zap, Phone,
} from "lucide-react";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import UserCallAnalytics from "./UserCallAnalytics";

const PIE_PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9"];

const AVATAR_GRADIENTS = [
    "from-indigo-500 to-violet-600",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-sky-500 to-blue-500",
    "from-fuchsia-500 to-purple-500",
];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-950 text-white px-3 py-2 rounded-xl shadow-2xl text-xs font-bold border border-white/10">
            {label && <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-widest">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color || "#a78bfa" }}>
                    {p.name}: <span className="text-white">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

export default function Reports() {
    const { user: currentUser } = useAuth();
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
            to:   now.toISOString().split("T")[0],
        };
    });
    const [selectedTeamLead, setSelectedTeamLead] = useState("all");
    const [activeTab, setActiveTab] = useState("general");

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    const { data: leadsBySource }    = useQuery({ queryKey: ["leads-by-source", dateRange],      queryFn: async () => (await api.get("/reports/leads-by-source", { params: dateRange })).data, enabled: isAdmin && activeTab === "general" });
    const { data: monthlyGrowth }    = useQuery({ queryKey: ["monthly-growth"],                  queryFn: async () => (await api.get("/reports/monthly-growth")).data,                          enabled: isAdmin && activeTab === "general" });
    const { data: conversionData }   = useQuery({ queryKey: ["conversion-rate", dateRange],      queryFn: async () => (await api.get("/reports/conversion-rate", { params: dateRange })).data,  enabled: isAdmin && activeTab === "general" });
    const { data: teamPerformance }  = useQuery({ queryKey: ["team-performance"],                queryFn: async () => (await api.get("/analytics/team-performance")).data,                       enabled: isAdmin && activeTab === "general" });
    const { data: salesPerformance, isLoading: salesLoading } = useQuery({ queryKey: ["sales-performance", dateRange.from], queryFn: async () => (await api.get("/analytics/sales-performance", { params: { from: dateRange.from } })).data, enabled: isAdmin && activeTab === "sales", refetchInterval: 60000 });
    const { data: teamLeadAssignments } = useQuery({ queryKey: ["team-lead-assignments"],        queryFn: async () => (await api.get("/reports/team-lead-assignments")).data,                    enabled: isAdmin });

    const handleExport = async (type, params = {}) => {
        try {
            const res = await api.get(`/export/${type}`, { params, responseType: "blob" });
            const url  = window.URL.createObjectURL(new Blob([res.data]));
            const a    = document.createElement("a");
            a.href     = url;
            a.setAttribute("download", `${type}_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Export failed");
        }
    };

    const fmtTime = (d) => d
        ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "—";

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Shield className="h-10 w-10 text-gray-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-black text-gray-900">Access Restricted</h2>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">Reports are available to Admins only.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: "general",  label: "General Analytics",  Icon: BarChart3  },
        { id: "sales",    label: "Sales Performance",   Icon: Activity   },
        { id: "teamlead", label: "Team Lead Report",    Icon: Users      },
        { id: "calls",    label: "Call Analytics",      Icon: Phone      },
    ];

    const convRate = parseFloat(conversionData?.conversionRate) || 0;
    const wonRatio = conversionData?.totalLeads > 0
        ? Math.round((conversionData.convertedLeads / conversionData.totalLeads) * 100)
        : 0;

    return (
        <div className="pb-16 space-y-7">

            {/* ─── Page Header ───────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Analytics Hub</p>
                    <h1 className="text-[1.85rem] font-black text-gray-950 tracking-tight leading-none">Reports</h1>
                    <p className="text-sm text-gray-400 mt-1.5 font-medium">Performance, growth & team insights.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            className="text-sm font-semibold text-gray-700 outline-none bg-transparent w-32"
                        />
                        <span className="text-gray-300 text-sm">→</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            className="text-sm font-semibold text-gray-700 outline-none bg-transparent w-32"
                        />
                    </div>
                    <button
                        onClick={() => handleExport("leads")}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm shadow-indigo-200"
                    >
                        <Download className="h-4 w-4" /> Export
                    </button>
                </div>
            </div>

            {/* ─── Tabs ───────────────────────────────────────────── */}
            <div className="flex border-b border-gray-200">
                {tabs.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all relative whitespace-nowrap ${
                            activeTab === id
                                ? "text-indigo-700"
                                : "text-gray-400 hover:text-gray-700"
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                        {activeTab === id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* ══════════════ GENERAL ANALYTICS ══════════════ */}
            {activeTab === "general" && (
                <div className="space-y-7">

                    {/* KPI strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            {
                                label: "Total Leads",
                                value: conversionData?.totalLeads ?? "—",
                                sub: "In selected period",
                                Icon: Users,
                                accent: "indigo",
                                bar: convRate,
                            },
                            {
                                label: "Conversion Rate",
                                value: conversionData?.conversionRate ?? "—",
                                sub: "Leads converted to deals",
                                Icon: TrendingUp,
                                accent: "emerald",
                                bar: convRate,
                            },
                            {
                                label: "Won Deals",
                                value: conversionData?.convertedLeads ?? "—",
                                sub: "Successfully closed",
                                Icon: Target,
                                accent: "amber",
                                bar: wonRatio,
                            },
                        ].map(({ label, value, sub, Icon, accent, bar }) => {
                            const colors = {
                                indigo: { ring: "bg-indigo-100", icon: "text-indigo-600", num: "text-indigo-700", bar: "bg-indigo-500", light: "bg-indigo-50" },
                                emerald:{ ring: "bg-emerald-100",icon: "text-emerald-600",num: "text-emerald-700",bar: "bg-emerald-500",light: "bg-emerald-50" },
                                amber:  { ring: "bg-amber-100",  icon: "text-amber-600",  num: "text-amber-700",  bar: "bg-amber-500",  light: "bg-amber-50"  },
                            }[accent];
                            return (
                                <div key={label} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-shadow group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-10 h-10 rounded-xl ${colors.ring} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <Icon className={`h-5 w-5 ${colors.icon}`} />
                                        </div>
                                        <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                                    <p className={`text-3xl font-black ${colors.num} leading-none`}>{value}</p>
                                    <p className="text-[11px] text-gray-400 font-medium mt-1.5">{sub}</p>
                                    <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
                                            style={{ width: `${Math.min(bar, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Pie chart - dark card */}
                        <div className="bg-[#0c0f1a] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                    <PieIcon className="h-4 w-4 text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">Leads by Source</h3>
                                    <p className="text-[10px] text-gray-500 font-medium">Channel distribution</p>
                                </div>
                            </div>
                            <div className="p-6 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={leadsBySource}
                                            cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={90}
                                            paddingAngle={4}
                                            dataKey="count"
                                            nameKey="source"
                                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
                                            labelLine={false}
                                        >
                                            {leadsBySource?.map((_, i) => (
                                                <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} stroke="transparent" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend */}
                            <div className="px-6 pb-5 flex flex-wrap gap-x-4 gap-y-2">
                                {leadsBySource?.map((item, i) => (
                                    <div key={item.source} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
                                        <span className="text-[10px] text-gray-500 font-semibold">{item.source}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Area chart - dark card */}
                        <div className="bg-[#0c0f1a] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">Monthly Growth</h3>
                                    <p className="text-[10px] text-gray-500 font-medium">Lead volume trend</p>
                                </div>
                            </div>
                            <div className="p-6 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: "#4b5563", fontSize: 10, fontWeight: 700 }}
                                            axisLine={false} tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fill: "#4b5563", fontSize: 10, fontWeight: 700 }}
                                            axisLine={false} tickLine={false}
                                        />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="leads"
                                            stroke="#6366f1"
                                            strokeWidth={2.5}
                                            fill="url(#leadGrad)"
                                            dot={{ fill: "#6366f1", strokeWidth: 0, r: 3 }}
                                            activeDot={{ r: 5, fill: "#a78bfa" }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Team Performance Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-sm font-black text-gray-900">Team Performance</h3>
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Individual conversion analytics</p>
                            </div>
                            <button
                                onClick={() => handleExport("team-performance")}
                                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Download className="h-3 w-3" /> Export
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="px-6 py-3 text-left text-[9.5px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                        <th className="px-6 py-3 text-left text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                        <th className="px-4 py-3 text-center text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Leads</th>
                                        <th className="px-4 py-3 text-center text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Won</th>
                                        <th className="px-6 py-3 text-left text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Win Rate</th>
                                        <th className="px-4 py-3 text-center text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Tasks</th>
                                        <th className="px-4 py-3 text-center text-[9.5px] font-black text-gray-400 uppercase tracking-widest">Avg Response</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamPerformance?.map((m, i) => {
                                        const rate  = parseInt(m.conversionRate) || 0;
                                        const isTop = rate >= 30;
                                        return (
                                            <tr key={m.userId} className="border-b border-gray-50 hover:bg-indigo-50/20 transition-colors group">
                                                <td className="px-6 py-4 text-xs font-black text-gray-300">{i + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white text-sm font-black shadow-sm`}>
                                                            {m.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{m.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-black text-gray-700">{m.totalLeads}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`text-sm font-black ${isTop ? "text-emerald-600" : "text-gray-600"}`}>{m.convertedLeads}</span>
                                                </td>
                                                <td className="px-6 py-4 min-w-[180px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${isTop ? "bg-emerald-500" : "bg-amber-400"}`}
                                                                style={{ width: `${Math.min(rate, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-black w-9 text-right ${isTop ? "text-emerald-600" : "text-amber-600"}`}>
                                                            {m.conversionRate}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {m.pendingTasks > 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100">
                                                            <AlertCircle className="h-2.5 w-2.5" /> {m.pendingTasks}
                                                        </span>
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-xs font-black text-gray-600">{m.avgResponseTimeHours}h</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!teamPerformance || teamPerformance.length === 0) && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-14 text-center text-sm text-gray-400 font-medium">
                                                No team performance data available.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ SALES PERFORMANCE ══════════════ */}
            {activeTab === "sales" && (
                <div className="space-y-5">

                    {/* Quick stats */}
                    {salesPerformance && salesPerformance.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                {
                                    label: "Total Calls",
                                    value: salesPerformance.reduce((s, m) => s + (m.totalCalls || 0), 0),
                                    Icon: Zap,
                                    color: "text-indigo-600",
                                    bg: "bg-indigo-50",
                                },
                                {
                                    label: "Speak Time",
                                    value: `${salesPerformance.reduce((s, m) => s + (m.totalSpeakTime || 0), 0)} min`,
                                    Icon: Clock,
                                    color: "text-violet-600",
                                    bg: "bg-violet-50",
                                },
                                {
                                    label: "Total Converted",
                                    value: salesPerformance.reduce((s, m) => s + (m.convertedLeads || 0), 0),
                                    Icon: Target,
                                    color: "text-emerald-600",
                                    bg: "bg-emerald-50",
                                },
                                {
                                    label: "Active Reps",
                                    value: salesPerformance.length,
                                    Icon: Users,
                                    color: "text-amber-600",
                                    bg: "bg-amber-50",
                                },
                            ].map(({ label, value, Icon, color, bg }) => (
                                <div key={label} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                                        <Icon className={`h-5 w-5 ${color}`} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{label}</p>
                                        <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-sm font-black text-gray-900">Sales Performance</h3>
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Live · auto-refreshes every 60s</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <button
                                    onClick={() => handleExport("sales-performance", { from: dateRange.from })}
                                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Download className="h-3 w-3" /> Export
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        {["Employee", "Check-In / Out", "Status Hours", "Call Activity", "Conversion"].map((h, idx) => (
                                            <th
                                                key={h}
                                                className={`px-6 py-3 text-[9.5px] font-black text-gray-400 uppercase tracking-widest ${idx === 4 ? "text-right" : "text-left"}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesPerformance?.map((m, i) => {
                                        const win    = parseFloat(m.winRate) || 0;
                                        const isHigh = win >= 50;
                                        return (
                                            <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white font-black text-sm shadow-sm`}>
                                                            {m.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{m.name}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.role?.replace(/_/g, " ")}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                            <span className="text-[11px] text-gray-400 font-bold w-6">IN</span>
                                                            <span className="text-[11px] text-gray-800 font-bold">{fmtTime(m.checkIn)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                            <span className="text-[11px] text-gray-400 font-bold w-6">OUT</span>
                                                            <span className="text-[11px] text-gray-800 font-bold">{fmtTime(m.checkOut)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="inline-flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                                        <div className="text-center">
                                                            <p className="text-xs font-black text-gray-800">{m.onlineHrs}h</p>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase">Online</p>
                                                        </div>
                                                        <div className="w-px h-5 bg-gray-200" />
                                                        <div className="text-center">
                                                            <p className="text-xs font-black text-amber-600">{m.breakHrs}h</p>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase">Break</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="inline-block bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-center">
                                                        <p className="text-sm font-black text-indigo-700">{m.totalCalls} calls</p>
                                                        <p className="text-[10px] font-bold text-indigo-400">{m.totalSpeakTime} min</p>
                                                        <p className="text-[9px] text-indigo-300 font-bold uppercase mt-0.5">
                                                            {m.callSourceBreakdown?.fasterq} FQ · {m.callSourceBreakdown?.internal} CRM
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="text-sm font-black text-gray-900">{m.convertedLeads} / {m.totalLeads}</p>
                                                    <div className="flex items-center justify-end gap-2 mt-1.5">
                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${isHigh ? "bg-emerald-500" : "bg-amber-400"}`}
                                                                style={{ width: `${Math.min(win, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-black w-10 ${isHigh ? "text-emerald-600" : "text-amber-600"}`}>
                                                            {m.winRate}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {salesLoading && (
                                        <tr>
                                            <td colSpan="5" className="py-14 text-center">
                                                <Loader2 className="h-7 w-7 animate-spin text-indigo-400 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400 font-medium">Fetching performance data...</p>
                                            </td>
                                        </tr>
                                    )}
                                    {!salesLoading && (!salesPerformance || salesPerformance.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="py-14 text-center text-sm text-gray-400 font-medium">
                                                No sales data for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ TEAM LEAD REPORT ══════════════ */}
            {activeTab === "teamlead" && (
                <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Team Lead Distribution</h3>
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Live lead assignments across leadership</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter</span>
                            <select
                                value={selectedTeamLead}
                                onChange={(e) => setSelectedTeamLead(e.target.value)}
                                className="text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 shadow-sm"
                            >
                                <option value="all">All Team Leads</option>
                                {teamLeadAssignments?.map(tl => (
                                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={`grid gap-5 ${selectedTeamLead === "all" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 max-w-3xl"}`}>
                        {teamLeadAssignments
                            ?.filter(tl => selectedTeamLead === "all" || tl.id === selectedTeamLead)
                            .map((tl, idx) => {
                                const stats = [
                                    { label: "Total",  value: tl.totalCount || 0,      color: "text-white",       bg: "bg-white/15" },
                                    { label: "Cold",   value: tl.stats?.cold || 0,     color: "text-sky-200",     bg: "bg-sky-500/20" },
                                    { label: "Warm",   value: tl.stats?.warm || 0,     color: "text-amber-200",   bg: "bg-amber-500/20" },
                                    { label: "Hot",    value: tl.stats?.hot || 0,      color: "text-rose-200",    bg: "bg-rose-500/20" },
                                    { label: "Won",    value: tl.stats?.converted || 0,color: "text-emerald-200", bg: "bg-emerald-500/20" },
                                ];
                                return (
                                    <div key={tl.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        {/* Header */}
                                        <div className="bg-[#0c0f1a] px-6 py-5">
                                            <div className="flex items-center gap-4 mb-5">
                                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white font-black text-xl shadow-lg`}>
                                                    {tl.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-black text-white">{tl.name}</h4>
                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">{tl.email}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-5 gap-2">
                                                {stats.map(({ label, value, color, bg }) => (
                                                    <div key={label} className={`${bg} rounded-xl px-2 py-2.5 text-center border border-white/5`}>
                                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                                                        <p className={`text-xl font-black ${color} leading-none`}>{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Lead rows */}
                                        <div className="p-4">
                                            {tl.leads.length > 0 ? (
                                                <div>
                                                    <div className="grid grid-cols-12 px-3 pb-2">
                                                        <div className="col-span-6 text-[9px] font-black text-gray-400 uppercase tracking-widest">Lead</div>
                                                        <div className="col-span-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</div>
                                                        <div className="col-span-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Role</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {tl.leads.map((lead) => (
                                                            <div
                                                                key={lead.id}
                                                                className="grid grid-cols-12 items-center px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                                                            >
                                                                <div className="col-span-6">
                                                                    <p className="text-xs font-bold text-gray-800 truncate">{lead.name}</p>
                                                                </div>
                                                                <div className="col-span-3 flex justify-center">
                                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-tight ${
                                                                        lead.status === "CONVERTED" ? "bg-emerald-50 text-emerald-700"
                                                                        : lead.status === "LOST"    ? "bg-rose-50 text-rose-700"
                                                                        : "bg-indigo-50 text-indigo-700"
                                                                    }`}>
                                                                        {lead.status?.replace(/_/g, " ")}
                                                                    </span>
                                                                </div>
                                                                <div className="col-span-3 text-right">
                                                                    <span className={`text-[10px] font-black ${
                                                                        lead.assignmentType === "Primary" ? "text-indigo-500" : "text-teal-500"
                                                                    }`}>
                                                                        {lead.assignmentType}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-10 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
                                                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-xs font-semibold text-gray-400">No lead assignments</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {activeTab === "calls" && (
                <UserCallAnalytics embedded />
            )}
        </div>
    );
}
