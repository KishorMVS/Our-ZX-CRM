import { useState, useEffect, useCallback } from "react";
import {
    Phone, Loader2, AlertCircle, RefreshCw, UserCheck,
    UserX, Hash, X, CheckCircle,
} from "lucide-react";
import api from "../api/axios";

const statusBadge = (status) => {
    if (status === "ALLOCATED_TO_ADMIN") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-tight">Available</span>;
    if (status === "ASSIGNED_TO_EMPLOYEE") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-tight">Assigned</span>;
    return null;
};

const ErrBanner = ({ msg }) => (
    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
);

const OkBanner = ({ msg }) => (
    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex gap-2 items-start">
        <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
);

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

const AdminDIDPage = () => {
    const [pool, setPool]             = useState([]);
    const [employees, setEmployees]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState("");
    const [assignModal, setAssignModal]   = useState(null); // { didId, number } | null
    const [assignTarget, setAssignTarget] = useState("");
    const [assigning, setAssigning]       = useState(false);
    const [assignError, setAssignError]   = useState("");
    const [assignOk, setAssignOk]         = useState("");
    const [unassigning, setUnassigning]   = useState(null); // didId being unassigned

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [poolRes, empRes] = await Promise.all([
                api.get("/dids/my-pool"),
                api.get("/dids/assignable-employees"),
            ]);
            setPool(poolRes.data || []);
            setEmployees(empRes.data || []);
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to load DID data.");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAssign = async () => {
        if (!assignTarget || !assignModal) return;
        setAssigning(true); setAssignError(""); setAssignOk("");
        try {
            await api.post("/dids/assign-to-employee", { didId: assignModal.didId, employeeId: assignTarget });
            setAssignOk(`DID ${assignModal.number} assigned successfully.`);
            setAssignModal(null);
            setAssignTarget("");
            await load();
        } catch (err) {
            setAssignError(err?.response?.data?.message || "Failed to assign DID.");
        } finally { setAssigning(false); }
    };

    const handleUnassign = async (didId, number) => {
        if (!confirm(`Remove DID ${number} from this employee?`)) return;
        setUnassigning(didId);
        try {
            await api.delete(`/dids/${didId}/unassign-employee`);
            await load();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to unassign DID.");
        } finally { setUnassigning(null); }
    };

    const availablePool  = pool.filter(d => d.status === "ALLOCATED_TO_ADMIN");
    const assignedPool   = pool.filter(d => d.status === "ASSIGNED_TO_EMPLOYEE");
    const unassignedEmps = employees.filter(e => !e.assignedDID);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">DID Management</h1>
                    <p className="text-sm text-gray-500">Assign phone numbers to your telecallers</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {error && <ErrBanner msg={error} />}
            {assignOk && <OkBanner msg={assignOk} />}

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Total DIDs", value: pool.length, color: "indigo" },
                    { label: "Available", value: availablePool.length, color: "green" },
                    { label: "Assigned", value: assignedPool.length, color: "purple" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
                        <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {pool.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                        <Phone className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">No DIDs allocated to you</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                        Contact your Super Admin to allocate DID numbers to your account.
                    </p>
                </div>
            ) : (
                <>
                    {/* Available DID pool */}
                    {availablePool.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-green-600" />
                                    <h2 className="text-sm font-semibold text-gray-900">Available Numbers</h2>
                                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{availablePool.length}</span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {availablePool.map(did => (
                                    <div key={did.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                        <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 border border-green-100">
                                            <Hash className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 font-mono">{did.number}</p>
                                            <p className="text-[11px] text-gray-400">Not yet assigned to any telecaller</p>
                                        </div>
                                        {statusBadge(did.status)}
                                        <button
                                            onClick={() => { setAssignModal({ didId: did.id, number: did.number }); setAssignTarget(""); setAssignError(""); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex-shrink-0">
                                            <UserCheck className="h-3.5 w-3.5" /> Assign
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Assigned numbers */}
                    {assignedPool.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <Phone className="h-4 w-4 text-purple-600" />
                                <h2 className="text-sm font-semibold text-gray-900">Assigned Numbers</h2>
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">{assignedPool.length}</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {assignedPool.map(did => (
                                    <div key={did.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                        <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 border border-purple-100">
                                            <Hash className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 font-mono">{did.number}</p>
                                            {did.assignedToEmployee && (
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Assigned to: <span className="font-semibold text-gray-700">{did.assignedToEmployee.name}</span>
                                                    <span className="text-gray-400"> · {did.assignedToEmployee.email}</span>
                                                </p>
                                            )}
                                        </div>
                                        {statusBadge(did.status)}
                                        <button
                                            onClick={() => handleUnassign(did.id, did.number)}
                                            disabled={unassigning === did.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors flex-shrink-0">
                                            {unassigning === did.id
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <UserX className="h-3.5 w-3.5" />
                                            }
                                            Unassign
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Telecallers without a DID */}
                    {unassignedEmps.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                <h2 className="text-sm font-semibold text-gray-900">Telecallers Without a DID</h2>
                                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">{unassignedEmps.length}</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {unassignedEmps.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                        <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500 uppercase">
                                            {emp.name?.[0] || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                                            <p className="text-[11px] text-gray-400">{emp.email}</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-tight">No DID</span>
                                        {availablePool.length > 0 && (
                                            <button
                                                onClick={() => { setAssignModal({ didId: availablePool[0].id, number: availablePool[0].number }); setAssignTarget(emp.id); setAssignError(""); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex-shrink-0">
                                                <UserCheck className="h-3.5 w-3.5" /> Assign DID
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Assign modal */}
            {assignModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">Assign DID to Telecaller</h3>
                            <button onClick={() => setAssignModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">DID Number</p>
                            <p className="text-sm font-bold font-mono text-gray-900">{assignModal.number}</p>
                        </div>
                        {assignError && <ErrBanner msg={assignError} />}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Select Telecaller</label>
                            <select value={assignTarget} onChange={e => setAssignTarget(e.target.value)} className={inputCls}>
                                <option value="">— Choose a telecaller —</option>
                                {employees.filter(e => !e.assignedDID).map(e => (
                                    <option key={e.id} value={e.id}>{e.name} · {e.email}</option>
                                ))}
                            </select>
                            {employees.filter(e => !e.assignedDID).length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">All telecallers already have a DID assigned.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button onClick={() => setAssignModal(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleAssign} disabled={!assignTarget || assigning}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                                {assigning ? "Assigning…" : "Assign"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDIDPage;
