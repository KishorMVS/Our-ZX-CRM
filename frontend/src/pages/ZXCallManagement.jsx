import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
    Loader2, PhoneCall, BarChart2, Users, AlertCircle,
    CheckCircle2, Clock, Phone, UserX, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const fmt12 = (h) => {
    const hour = ((h - 1) % 12) + 1;
    return `${hour}:00 ${h < 12 || h === 24 ? "AM" : "PM"}`;
};

const QuotaBadge = ({ quota }) => {
    if (!quota) return null;
    const pct = quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : 0;
    const color = pct >= 90 ? "text-red-600 bg-red-50 border-red-200" :
                  pct >= 60 ? "text-amber-600 bg-amber-50 border-amber-200" :
                              "text-green-600 bg-green-50 border-green-200";
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${color}`}>
            <Users className="h-3.5 w-3.5" />
            {quota.used} / {quota.limit} seats used
        </span>
    );
};

const ZXCallManagement = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [search, setSearch] = useState("");

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ["zxcall-telecmi-users"],
        queryFn: async () => {
            const res = await api.get("/zxcall/telecmi-users");
            return res.data;
        },
        retry: 1,
    });

    if (user?.role !== "SUPER_ADMIN") {
        return (
            <div className="text-center py-20">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-500 mt-2">Only Super Admins can view ZX Call management.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Failed to load TeleCMI users</h2>
                <p className="text-gray-500 mt-2">{error?.response?.data?.message || error?.message}</p>
                <button
                    onClick={() => refetch()}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                    <RefreshCw className="h-4 w-4" /> Retry
                </button>
            </div>
        );
    }

    const agents = (data?.agents || []).filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const name = `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase();
        return (
            name.includes(q) ||
            String(a.extension).includes(q) ||
            (a.crmUser?.name || "").toLowerCase().includes(q) ||
            (a.crmUser?.email || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <PhoneCall className="h-6 w-6 text-indigo-600" />
                        ZX Call Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        TeleCMI agents provisioned for this workspace
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <QuotaBadge quota={data?.quota} />
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Search */}
            <div>
                <input
                    type="text"
                    placeholder="Search by name, extension, or CRM user…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Extension</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRM User</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {agents.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    {search ? "No agents match your search." : "No TeleCMI agents found for this workspace."}
                                </td>
                            </tr>
                        )}
                        {agents.map((agent) => (
                            <tr key={agent.agent_id} className="hover:bg-gray-50 transition-colors">
                                {/* Agent name */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">
                                            {(agent.first_name || "?")[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {agent.first_name} {agent.last_name}
                                            </p>
                                            <p className="text-xs text-gray-400 font-mono">{agent.agent_id}</p>
                                        </div>
                                    </div>
                                </td>

                                {/* Extension */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-xs font-bold">
                                        <Phone className="h-3 w-3" />
                                        {agent.extension}
                                    </span>
                                </td>

                                {/* Phone */}
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-xs font-mono">
                                    {agent.phone || "—"}
                                </td>

                                {/* Shift hours */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {agent.start_time && agent.end_time ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            {fmt12(agent.start_time)} – {fmt12(agent.end_time)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs">—</span>
                                    )}
                                </td>

                                {/* CRM User */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {agent.crmUser ? (
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                {agent.crmUser.name}
                                            </p>
                                            <p className="text-xs text-gray-400">{agent.crmUser.email}</p>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                            <UserX className="h-3 w-3" />
                                            Unlinked
                                        </span>
                                    )}
                                </td>

                                {/* Actions */}
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="flex justify-end gap-2">
                                        {agent.crmUser && (
                                            <button
                                                onClick={() => navigate(`/team/call-analytics/${agent.crmUser.id}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                                                title="View Call Analytics"
                                            >
                                                <BarChart2 className="h-3.5 w-3.5" />
                                                Analytics
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate("/team")}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                                            title="Manage in Team"
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                            Team
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer summary */}
            <p className="text-xs text-gray-400 text-right">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} shown
                {search ? ` (filtered from ${data?.agents?.length || 0})` : ""}
            </p>
        </div>
    );
};

export default ZXCallManagement;
