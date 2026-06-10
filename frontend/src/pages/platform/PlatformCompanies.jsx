import { useEffect, useState, useCallback } from "react";
import { getWorkspaces, toggleWorkspaceStatus } from "../../api/platform";
import { useNavigate } from "react-router-dom";
import {
    Search, Building2, Users, ChevronRight, Loader2, RefreshCw,
    CheckCircle2, XCircle, Filter
} from "lucide-react";

const StatusBadge = ({ status }) => {
    const styles = {
        ACTIVE: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
        SUSPENDED: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-slate-700 text-slate-400"}`}>
            {status}
        </span>
    );
};

const PlanBadge = ({ plan }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-xs font-medium capitalize">
        {plan?.toLowerCase() || "free"}
    </span>
);

const PlatformCompanies = () => {
    const [data, setData] = useState({ workspaces: [], total: 0 });
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null);
    const navigate = useNavigate();
    const LIMIT = 15;

    const load = useCallback(() => {
        setLoading(true);
        getWorkspaces({ search, status: statusFilter || undefined, page, limit: LIMIT })
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [search, statusFilter, page]);

    useEffect(() => {
        const t = setTimeout(load, search ? 300 : 0);
        return () => clearTimeout(t);
    }, [load]);

    const handleToggle = async (e, id) => {
        e.stopPropagation();
        setToggling(id);
        try {
            await toggleWorkspaceStatus(id);
            load();
        } catch (err) {
            console.error(err);
        } finally {
            setToggling(null);
        }
    };

    const totalPages = Math.ceil(data.total / LIMIT);
    const from = (page - 1) * LIMIT + 1;
    const to = Math.min(page * LIMIT, data.total);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Companies</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {data.total} {data.total === 1 ? "company" : "companies"} registered on the platform
                    </p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 text-sm transition-colors"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by company name..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                        <option value="">All status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                            <p className="text-slate-500 text-sm">Loading companies...</p>
                        </div>
                    </div>
                ) : data.workspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-slate-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-400 font-medium text-sm">
                                {search || statusFilter ? "No matching companies" : "No companies yet"}
                            </p>
                            <p className="text-slate-600 text-xs mt-1">
                                {search || statusFilter
                                    ? "Try adjusting your search or filters"
                                    : "Companies will appear here once they register at /register"}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left px-6 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Company</th>
                                    <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Users</th>
                                    <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Plan</th>
                                    <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3.5 text-slate-500 text-xs font-medium uppercase tracking-wider">Registered</th>
                                    <th className="px-4 py-3.5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {data.workspaces.map(ws => (
                                    <tr
                                        key={ws.id}
                                        onClick={() => navigate(`/platform/companies/${ws.id}`)}
                                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0 ring-1 ring-indigo-500/20">
                                                    <span className="text-indigo-400 text-sm font-bold">
                                                        {ws.name?.[0]?.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">
                                                        {ws.name}
                                                    </p>
                                                    {ws.companyEmail && (
                                                        <p className="text-slate-500 text-xs mt-0.5">{ws.companyEmail}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-slate-500" />
                                                <span className="text-slate-300 text-sm font-medium">{ws.userCount}</span>
                                                <span className="text-slate-600 text-xs">
                                                    {ws.userCount === 1 ? "user" : "users"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <PlanBadge plan={ws.plan} />
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge status={ws.status} />
                                        </td>
                                        <td className="px-4 py-4 text-slate-500 text-sm">
                                            {new Date(ws.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button
                                                    onClick={e => handleToggle(e, ws.id)}
                                                    disabled={toggling === ws.id}
                                                    title={ws.status === "ACTIVE" ? "Suspend company" : "Activate company"}
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        ws.status === "ACTIVE"
                                                            ? "text-slate-600 hover:text-red-400 hover:bg-red-500/8"
                                                            : "text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/8"
                                                    }`}
                                                >
                                                    {toggling === ws.id
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : ws.status === "ACTIVE"
                                                            ? <XCircle className="h-4 w-4" />
                                                            : <CheckCircle2 className="h-4 w-4" />
                                                    }
                                                </button>
                                                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
                                <p className="text-slate-500 text-sm">
                                    Showing {from}–{to} of {data.total}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3.5 py-1.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-slate-700"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3.5 py-1.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-slate-700"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PlatformCompanies;
