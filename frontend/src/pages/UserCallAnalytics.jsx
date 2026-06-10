import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts";
import {
    Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, TrendingUp,
    Users, BarChart2, ArrowLeft, Loader2, ChevronDown, CheckCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
    answered:  "#6366f1",
    noAnswer:  "#f59e0b",
    busy:      "#3b82f6",
    failed:    "#ef4444",
};

const SENTIMENT_COLORS = {
    positive: "#10b981",
    neutral:  "#6366f1",
    negative: "#ef4444",
};

function fmt(sec) {
    if (!sec) return "0s";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }) {
    const colorMap = {
        indigo: "bg-indigo-50 text-indigo-600",
        green:  "bg-green-50  text-green-600",
        amber:  "bg-amber-50  text-amber-600",
        red:    "bg-red-50    text-red-600",
        sky:    "bg-sky-50    text-sky-600",
    };
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function UserCallAnalytics({ embedded = false }) {
    const { userId: paramUserId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const isEmployee = ["EMPLOYEE"].includes(currentUser?.role);

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [from, setFrom] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
    const [to, setTo]     = useState(today.toISOString().slice(0, 10));
    // Employees always see their own analytics; others can pick a user
    const [selectedUserId, setSelectedUserId] = useState(
        isEmployee ? currentUser?.id : (paramUserId || "")
    );

    // Fetch all users for the selector (not needed for employees)
    const { data: allUsers = [] } = useQuery({
        queryKey: ["team"],
        queryFn: async () => {
            const res = await api.get("/team");
            return res.data;
        },
        enabled: !isEmployee,
    });

    const activeUserId = isEmployee ? currentUser?.id : (selectedUserId || allUsers[0]?.id || "");

    // Fetch analytics for selected user
    const { data, isLoading, isError } = useQuery({
        queryKey: ["user-call-analytics", activeUserId, from, to],
        queryFn: async () => {
            const res = await api.get(`/analytics/user-calls/${activeUserId}?from=${from}&to=${to}`);
            return res.data;
        },
        enabled: !!activeUserId,
    });

    const s = data?.summary;

    // Pie data for call status
    const statusPieData = data ? [
        { name: "Answered",  value: s.answered  },
        { name: "No Answer", value: s.noAnswer  },
        { name: "Busy",      value: s.busy      },
        { name: "Failed",    value: s.failed    },
    ].filter(d => d.value > 0) : [];

    // Sentiment pie
    const sentimentPieData = data
        ? Object.entries(data.breakdowns.sentiment).map(([k, v]) => ({ name: k, value: v }))
        : [];

    // Tone bar chart
    const toneBars = data
        ? Object.entries(data.breakdowns.tone).map(([k, v]) => ({ tone: k, count: v }))
        : [];

    return (
        <div className={`max-w-7xl mx-auto space-y-6 ${embedded ? "" : "py-6 px-4 md:px-6"}`}>

            {/* Header — hidden when embedded in Reports */}
            {!embedded && (
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/team")}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BarChart2 className="h-6 w-6 text-indigo-600" />
                            Call Analytics
                        </h1>
                        <p className="text-sm text-gray-500">Detailed call performance report per agent</p>
                    </div>
                </div>
            </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                    {/* User selector — hidden for employees (always their own) */}
                    {!isEmployee && (
                    <div className="relative">
                        <select
                            value={activeUserId}
                            onChange={e => setSelectedUserId(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {allUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    )}

                    {/* Date range */}
                    <input
                        type="date" value={from}
                        onChange={e => setFrom(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                        type="date" value={to}
                        onChange={e => setTo(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
            </div>

            {isLoading && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {isError && (
                <div className="text-center py-16 text-gray-400">Failed to load analytics.</div>
            )}

            {data && !isLoading && (
                <>
                    {/* Agent Info */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                            {data.user.name[0]}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 text-lg">{data.user.name}</p>
                            <p className="text-sm text-gray-500">{data.user.email} · {data.user.role.toLowerCase().replace("_", " ")}</p>
                            {data.user.telecmiAgentId && (
                                <p className="text-xs text-sky-600 mt-0.5 font-medium">TeleCMI Agent: {data.user.telecmiAgentId}</p>
                            )}
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={Phone}        label="Total Calls"    value={s.total}              color="indigo" />
                        <StatCard icon={CheckCircle}  label="Answer Rate"    value={`${s.answerRate}%`}   color="green"  sub={`${s.answered} answered`} />
                        <StatCard icon={Clock}        label="Total Talk Time" value={fmt(s.totalTalkSec)} color="sky"    sub={`Avg ${fmt(s.avgDuration)} / call`} />
                        <StatCard icon={TrendingUp}   label="Conversion Rate" value={`${s.conversionRate}%`} color="amber" sub={`${s.convertedLeads} of ${s.uniqueLeadsContacted} leads`} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={PhoneOutgoing} label="Outbound"    value={s.outbound}    color="indigo" />
                        <StatCard icon={PhoneIncoming} label="Inbound"     value={s.inbound}     color="sky"    />
                        <StatCard icon={PhoneMissed}   label="No Answer"   value={s.noAnswer}    color="amber"  />
                        <StatCard icon={Users}         label="Leads Called" value={s.uniqueLeadsContacted} color="green" sub={`${s.transcribed} transcribed`} />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Daily Trend */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Call Trend</h3>
                            {data.dailyTrend.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 text-sm">No calls in this period</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={data.dailyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            formatter={(v, n) => [v, n === "total" ? "Total" : "Answered"]}
                                            labelFormatter={l => `Date: ${l}`}
                                        />
                                        <Bar dataKey="total"    fill="#e0e7ff" radius={[3,3,0,0]} name="total" />
                                        <Bar dataKey="answered" fill="#6366f1" radius={[3,3,0,0]} name="answered" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Status Pie */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Call Status Breakdown</h3>
                            {statusPieData.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 text-sm">No calls in this period</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {statusPieData.map((entry, i) => {
                                                const colors = ["#6366f1","#f59e0b","#3b82f6","#ef4444"];
                                                return <Cell key={i} fill={colors[i % colors.length]} />;
                                            })}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Charts Row 2 — only if transcribed calls exist */}
                    {(sentimentPieData.length > 0 || toneBars.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Sentiment Pie */}
                            {sentimentPieData.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Sentiment Breakdown</h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={sentimentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                                {sentimentPieData.map((entry, i) => {
                                                    const c = SENTIMENT_COLORS[entry.name.toLowerCase()] || "#94a3b8";
                                                    return <Cell key={i} fill={c} />;
                                                })}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Tone Bar */}
                            {toneBars.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Tone Distribution</h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={toneBars} layout="vertical" margin={{ top: 0, right: 16, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <YAxis type="category" dataKey="tone" tick={{ fontSize: 11 }} width={70} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#6366f1" radius={[0,3,3,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Top Leads */}
                    {data.topLeads.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Leads Contacted</h3>
                            <div className="divide-y divide-gray-100">
                                {data.topLeads.map(({ lead, count }) => (
                                    <div key={lead.id} className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                {lead.name?.[0] || "?"}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{lead.name || "Unknown"}</p>
                                                <p className="text-xs text-gray-400">{lead.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                                ${lead.status === "CONVERTED" ? "bg-green-100 text-green-700" :
                                                  lead.status === "FOLLOW_UP" ? "bg-amber-100 text-amber-700" :
                                                  "bg-gray-100 text-gray-600"}`}>
                                                {lead.status}
                                            </span>
                                            <span className="text-sm font-bold text-indigo-600">{count} calls</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Call Logs Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700">All Calls ({data.calls.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["Date","Lead","Number","Type","Status","Duration","Sentiment","Recording"].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.calls.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-400">No calls found in this period</td>
                                        </tr>
                                    ) : data.calls.map(call => (
                                        <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                                {new Date(call.callDate || call.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                                {call.lead?.name || "—"}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                                {call.toNumber || call.lead?.phone || "—"}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                                                    ${call.callType === "INBOUND" ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"}`}>
                                                    {call.callType === "INBOUND"
                                                        ? <PhoneIncoming className="h-3 w-3" />
                                                        : <PhoneOutgoing className="h-3 w-3" />}
                                                    {call.callType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                                                    ${call.callStatus === "COMPLETED" ? "bg-green-100 text-green-700" :
                                                      call.callStatus === "NO_ANSWER" ? "bg-amber-100 text-amber-700" :
                                                      call.callStatus === "BUSY"      ? "bg-blue-100 text-blue-700" :
                                                      "bg-red-100 text-red-700"}`}>
                                                    {call.callStatus || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                                {fmt(call.duration)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {call.sentiment ? (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                                                        ${call.sentiment.toLowerCase() === "positive" ? "bg-green-100 text-green-700" :
                                                          call.sentiment.toLowerCase() === "negative" ? "bg-red-100 text-red-700" :
                                                          "bg-gray-100 text-gray-600"}`}>
                                                        {call.sentiment}
                                                    </span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {call.recordingUrl
                                                    ? <span className="text-xs text-indigo-600 font-medium">Available</span>
                                                    : <span className="text-gray-300 text-xs">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
