import { useEffect, useState } from "react";
import { getPlatformStats } from "../../api/platform";
import { useNavigate } from "react-router-dom";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
    Building2, TrendingUp, TrendingDown, CheckCircle2, Calendar, ChevronRight, Users
} from "lucide-react";

const StatCard = ({ label, value, sub, icon: Icon, iconBg, trend }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
            <p className="text-slate-400 text-sm font-medium">{label}</p>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
        <div>
            <p className="text-4xl font-bold text-white tracking-tight">{value ?? "—"}</p>
            {sub && (
                <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
                    {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                    {trend === "down" && <TrendingDown className="h-3 w-3 text-red-400" />}
                    <span className={trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : ""}>
                        {sub}
                    </span>
                </p>
            )}
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">
            <p className="text-slate-400 text-xs mb-1">{label}</p>
            <p className="text-white font-bold text-lg">{payload[0].value}</p>
            <p className="text-slate-500 text-xs">
                {payload[0].value === 1 ? "company" : "companies"} registered
            </p>
        </div>
    );
};

const PlatformDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        getPlatformStats()
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const growthIsPositive = (stats?.growthRate ?? 0) >= 0;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="Total Companies"
                    value={stats?.totalWorkspaces}
                    sub={`${stats?.activeWorkspaces ?? 0} active · ${stats?.suspendedWorkspaces ?? 0} suspended`}
                    icon={Building2}
                    iconBg="bg-indigo-600"
                />
                <StatCard
                    label="New This Month"
                    value={stats?.newThisMonth}
                    sub={
                        stats?.growthRate !== undefined
                            ? `${growthIsPositive ? "+" : ""}${stats.growthRate}% vs last month`
                            : "registrations this month"
                    }
                    trend={growthIsPositive ? "up" : "down"}
                    icon={TrendingUp}
                    iconBg="bg-emerald-600"
                />
                <StatCard
                    label="Active Workspaces"
                    value={stats?.activeWorkspaces}
                    sub={
                        stats?.totalWorkspaces > 0
                            ? `${Math.round((stats.activeWorkspaces / stats.totalWorkspaces) * 100)}% of total`
                            : "No companies yet"
                    }
                    icon={CheckCircle2}
                    iconBg="bg-violet-600"
                />
            </div>

            {/* Registration chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="mb-6">
                    <h2 className="text-white font-semibold text-base">Company Registration Trend</h2>
                    <p className="text-slate-500 text-xs mt-1">Monthly registrations over the last 6 months</p>
                </div>

                {stats?.monthlyGrowth?.some(m => m.count > 0) ? (
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={stats.monthlyGrowth} barSize={32} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: "#475569", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: "#475569", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)", radius: 6 }} />
                            <Bar dataKey="count" name="Companies" fill="#6366f1" radius={[5, 5, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[240px] flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-slate-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-500 text-sm font-medium">No registrations yet</p>
                            <p className="text-slate-600 text-xs mt-1">
                                Companies will appear here once they sign up at <span className="text-indigo-500">/register</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent registrations */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-white font-semibold text-base">Recent Registrations</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Latest companies that joined the platform</p>
                    </div>
                    <button
                        onClick={() => navigate("/platform/companies")}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                        View all <ChevronRight className="h-3 w-3" />
                    </button>
                </div>

                {!stats?.recentRegistrations?.length ? (
                    <div className="py-14 text-center">
                        <Calendar className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">No companies registered yet</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800/60">
                                <th className="text-left px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Company</th>
                                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Users</th>
                                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Plan</th>
                                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Registered</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {stats.recentRegistrations.map(ws => (
                                <tr
                                    key={ws.id}
                                    onClick={() => navigate(`/platform/companies/${ws.id}`)}
                                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                                                <span className="text-indigo-400 text-xs font-bold">
                                                    {ws.name?.[0]?.toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">
                                                {ws.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                            <Users className="h-3.5 w-3.5" />
                                            {ws.userCount}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-slate-400 text-sm capitalize">{ws.plan?.toLowerCase()}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            ws.status === "ACTIVE"
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-red-500/10 text-red-400"
                                        }`}>
                                            {ws.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-slate-500 text-sm">
                                        {new Date(ws.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PlatformDashboard;
