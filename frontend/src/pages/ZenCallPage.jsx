import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import {
    Building2, Users, Loader2, AlertCircle, RefreshCw, Pencil,
    CheckCircle, X, Phone, ToggleLeft, ToggleRight, Plus,
    PhoneIncoming, User, Shield, Hash, ChevronRight,
    Info, Trash2, ExternalLink, PhoneCall, Clock, Download,
    UserPlus, Radio, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import ZenDialer from "../components/ZenDialer";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useVoiceLink } from "../context/VoiceLinkContext";

const CHANNEL_PRICE = 1000;
const DID_PRICE     = 250;

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Root: route to correct view based on role
// ─────────────────────────────────────────────────────────────────────────────
const ZenCallPage = () => {
    const { user } = useAuth();
    if (user?.role === "PLATFORM_OWNER") return <ZenCallResellerView />;
    if (user?.role === "SUPER_ADMIN")    return <ZenCallClientView />;
    return <Navigate to="/dashboard" replace />;
};

// ═════════════════════════════════════════════════════════════════════════════
// PLATFORM_OWNER VIEW
// ═════════════════════════════════════════════════════════════════════════════
const ZenCallResellerView = () => {
    const [tab, setTab]               = useState("clients"); // "profile" | "clients"
    const [profile, setProfile]       = useState(null);
    const [profLoad, setProfLoad]     = useState(false);
    const [profErr, setProfErr]       = useState("");
    const [clients, setClients]       = useState([]);
    const [clLoad, setClLoad]         = useState(true);
    const [clErr, setClErr]           = useState("");
    const [superAdmins, setSuperAdmins] = useState([]);
    const [view, setView]             = useState(null); // null | "detail" | "edit" | "create"
    const [selected, setSelected]     = useState(null);
    const [form, setForm]             = useState({});
    const [saving, setSaving]         = useState(false);
    const [saveErr, setSaveErr]       = useState("");
    const [saveOk, setSaveOk]         = useState("");
    const [toggling, setToggling]     = useState(new Set());
    const [removing, setRemoving]     = useState(new Set());
    const [confirmRemove, setConfirmRemove] = useState(null);

    const EMPTY_CREATE = {
        first_name: "", last_name: "", username: "", password: "",
        channel_count: "", plan_type: "", targetUserId: "",
    };
    const EMPTY_EDIT = {
        first_name: "", last_name: "", username: "", email: "",
        phone: "", password: "", is_active: 1,
        channel_count: "", plan_type: "",
        pulse_seconds: "", inbound_rate: "", outbound_rate: "", wallet_balance: "",
        targetUserId: "",
    };

    const loadProfile = useCallback(async () => {
        setProfLoad(true); setProfErr("");
        try {
            const res = await api.get("/voicelink/reseller/profile");
            setProfile(res.data?.data || res.data);
        } catch (err) {
            setProfErr(err?.response?.data?.message || "Failed to load reseller profile.");
        } finally { setProfLoad(false); }
    }, []);

    const loadClients = useCallback(async () => {
        setClLoad(true); setClErr("");
        try {
            const res = await api.get("/voicelink/reseller/clients");
            const raw = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.clients || []);
            setClients(Array.isArray(raw) ? raw : []);
        } catch (err) {
            setClErr(err?.response?.data?.message || "Failed to load clients.");
            setClients([]);
        } finally { setClLoad(false); }
    }, []);

    const loadSuperAdmins = useCallback(async () => {
        try {
            const res = await api.get("/voicelink/reseller/super-admins");
            setSuperAdmins(res.data || []);
        } catch { setSuperAdmins([]); }
    }, []);

    useEffect(() => {
        loadClients();
        loadSuperAdmins();
    }, [loadClients, loadSuperAdmins]);

    useEffect(() => {
        if (tab === "profile" && !profile && !profLoad) loadProfile();
    }, [tab, profile, profLoad, loadProfile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
    };

    const openDetail = (c) => { setSelected(c); setView("detail"); setSaveErr(""); setSaveOk(""); };
    const openEdit   = (c) => {
        setSelected(c);
        setForm({
            ...EMPTY_EDIT,
            first_name:    c.first_name   || "",
            last_name:     c.last_name    || "",
            username:      c.username     || "",
            email:         c.email        || "",
            phone:         c.phone        || "",
            channel_count: c.channel_count ?? "",
            is_active:     c.is_active    ?? 1,
            plan_type:     c.plan_type    || "",
            targetUserId:  c.assignedUserId || "",
        });
        setView("edit"); setSaveErr(""); setSaveOk("");
    };
    const openCreate = () => { setForm(EMPTY_CREATE); setView("create"); setSaveErr(""); setSaveOk(""); };
    const closeView  = () => { setView(null); setSelected(null); };

    const handleCreate = async (e) => {
        e.preventDefault(); setSaveErr(""); setSaveOk(""); setSaving(true);
        try {
            await api.post("/voicelink/client/create", {
                first_name:    form.first_name,
                last_name:     form.last_name,
                username:      form.username,
                password:      form.password,
                channel_count: Number(form.channel_count),
                plan_type:     form.plan_type,
                targetUserId:  form.targetUserId || undefined,
            });
            setSaveOk("Client created successfully.");
            setForm(EMPTY_CREATE);
            await loadClients();
            await loadSuperAdmins();
        } catch (err) {
            setSaveErr(err?.response?.data?.message || "Failed to create client.");
        } finally { setSaving(false); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault(); setSaveErr(""); setSaveOk(""); setSaving(true);
        try {
            const payload = {
                first_name:  form.first_name,
                last_name:   form.last_name,
                username:    form.username,
                email:       form.email,
                is_active:   Number(form.is_active),
                targetUserId: form.targetUserId || null,
            };
            if (form.channel_count)  payload.channel_count  = Number(form.channel_count);
            if (form.phone)          payload.phone          = form.phone;
            if (form.password)       payload.password       = form.password;
            if (form.plan_type)      payload.plan_type      = form.plan_type;
            if (form.pulse_seconds)  payload.pulse_seconds  = Number(form.pulse_seconds);
            if (form.inbound_rate)   payload.inbound_rate   = Number(form.inbound_rate);
            if (form.outbound_rate)  payload.outbound_rate  = Number(form.outbound_rate);
            if (form.wallet_balance) payload.wallet_balance = Number(form.wallet_balance);

            await api.put(`/voicelink/reseller/client/${selected._id}`, payload);
            setSaveOk("Client updated successfully.");
            await loadClients();
            await loadSuperAdmins();
        } catch (err) {
            setSaveErr(err?.response?.data?.message || "Failed to update client.");
        } finally { setSaving(false); }
    };

    const handleToggle = async (c) => {
        const newStatus = (c.is_active === 1 || c.is_active === true) ? 0 : 1;
        setToggling(prev => new Set(prev).add(c._id));
        try {
            await api.put(`/voicelink/reseller/client/${c._id}`, {
                first_name: c.first_name || "", last_name: c.last_name || "",
                username: c.username || "", email: c.email || "", is_active: newStatus,
            });
            await loadClients();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to update client status.");
        } finally {
            setToggling(prev => { const s = new Set(prev); s.delete(c._id); return s; });
        }
    };

    const handleRemove = async (c) => {
        setRemoving(prev => new Set(prev).add(c._id));
        setConfirmRemove(null);
        try {
            await api.delete(`/voicelink/reseller/client/${c._id}`);
            await loadClients();
            await loadSuperAdmins();
            if (selected?._id === c._id) closeView();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to remove client.");
        } finally {
            setRemoving(prev => { const s = new Set(prev); s.delete(c._id); return s; });
        }
    };

    const channelCount    = Number(form.channel_count) || 0;
    const createTotal     = channelCount * CHANNEL_PRICE + channelCount * DID_PRICE;
    const profileEntries  = profile
        ? Object.entries(profile).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
        : [];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">ZenVoice</h1>
                    <p className="text-sm text-gray-500">Reseller management</p>
                </div>
                <button onClick={() => { loadClients(); loadSuperAdmins(); if (tab === "profile") loadProfile(); }}
                    disabled={clLoad || profLoad}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    <RefreshCw className={`h-4 w-4 ${(clLoad || profLoad) ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {[["clients", Users, "Clients"], ["profile", Building2, "Reseller Profile"]].map(([key, Icon, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                        <Icon className="h-4 w-4" />{label}
                    </button>
                ))}
            </div>

            {/* ── Reseller Profile tab ── */}
            {tab === "profile" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Reseller Profile</h2>
                    </div>
                    <div className="p-6">
                        {profLoad && <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 text-indigo-600 animate-spin" /></div>}
                        {profErr && !profLoad && (
                            <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{profErr}</span>
                            </div>
                        )}
                        {!profLoad && !profErr && profileEntries.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-6">No profile data available.</p>
                        )}
                        {!profLoad && profileEntries.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {profileEntries.map(([key, value]) => (
                                    <div key={key} className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                            {key.replace(/_/g, " ")}
                                        </p>
                                        <p className="text-sm font-medium text-gray-900 truncate">{String(value)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Clients tab ── */}
            {tab === "clients" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-semibold text-gray-900">Client Management</h2>
                            {clients.length > 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                    {clients.length}
                                </span>
                            )}
                        </div>
                        {view === null && (
                            <button onClick={openCreate}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                                <Plus className="h-3.5 w-3.5" /> Create Client
                            </button>
                        )}
                        {view !== null && (
                            <button onClick={closeView}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                <X className="h-4 w-4" /> Close
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-4">
                        {clLoad && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 text-indigo-600 animate-spin" /></div>}
                        {!clLoad && clErr && (
                            <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{clErr}</span>
                            </div>
                        )}

                        {/* ── Client list ── */}
                        {!clLoad && !clErr && view === null && (
                            <>
                                {clients.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-6">No clients found on VoiceLink.</p>
                                )}
                                <div className="space-y-3">
                                    {clients.map((c) => {
                                        const isActive   = c.is_active === 1 || c.is_active === true;
                                        const isToggling = toggling.has(c._id);
                                        const isRemoving = removing.has(c._id);
                                        const displayName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username;
                                        return (
                                            <div key={c._id ?? c.username}
                                                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 gap-4">
                                                <button onClick={() => openDetail(c)}
                                                    className="min-w-0 text-left flex-1 space-y-0.5 hover:opacity-80 transition-opacity">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                                            ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                                            {isActive ? "Active" : "Inactive"}
                                                        </span>
                                                        {c.assignedUser && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                                                                {c.assignedUser.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        <span className="font-mono">@{c.username}</span>
                                                        {" · "}ID: <span className="font-mono">{c._id}</span>
                                                        {c.channel_count != null && ` · ${c.channel_count} ch`}
                                                    </p>
                                                </button>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button onClick={() => openEdit(c)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                                        <Pencil className="h-3 w-3" /> Edit
                                                    </button>
                                                    <button onClick={() => handleToggle(c)} disabled={isToggling}
                                                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50
                                                            ${isActive ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                                                       : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"}`}>
                                                        {isToggling ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : isActive ? <><ToggleLeft className="h-3 w-3" /> Deactivate</>
                                                                       : <><ToggleRight className="h-3 w-3" /> Activate</>}
                                                    </button>
                                                    {confirmRemove === c._id ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-red-600 font-medium">Remove?</span>
                                                            <button onClick={() => handleRemove(c)} disabled={isRemoving}
                                                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50">
                                                                {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                                                            </button>
                                                            <button onClick={() => setConfirmRemove(null)}
                                                                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setConfirmRemove(c._id)} disabled={isRemoving}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                                                            <Trash2 className="h-3 w-3" /> Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span>
                                        "Remove" deactivates the client on VoiceLink and unlinks them from this CRM.
                                        To fully delete, use the{" "}
                                        <a href="https://app.voicelink.co.in/admin/clients" target="_blank" rel="noopener noreferrer"
                                            className="font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 hover:text-blue-900">
                                            VoiceLink admin panel <ExternalLink className="h-3 w-3" />
                                        </a>.
                                    </span>
                                </div>
                            </>
                        )}

                        {/* ── Client detail panel ── */}
                        {view === "detail" && selected && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        Client Details — {[selected.first_name, selected.last_name].filter(Boolean).join(" ") || selected.username}
                                    </h3>
                                    <button onClick={() => openEdit(selected)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                        <Pencil className="h-3.5 w-3.5" /> Edit Client
                                    </button>
                                </div>
                                {selected.assignedUser && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs">
                                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span>Assigned to: <strong>{selected.assignedUser.name}</strong> ({selected.assignedUser.email})</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(selected)
                                        .filter(([k, v]) =>
                                            !["_id", "assignedUserId", "assignedUser"].includes(k) &&
                                            v !== null && v !== undefined && typeof v !== "object"
                                        )
                                        .map(([key, value]) => (
                                            <div key={key} className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                                    {key.replace(/_/g, " ")}
                                                </p>
                                                <p className="text-sm font-medium text-gray-900 break-all">{String(value)}</p>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* ── Create form ── */}
                        {view === "create" && (
                            <form onSubmit={handleCreate} className="space-y-5">
                                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-indigo-600" /> Create New Client
                                </h3>
                                {saveErr && <ErrBanner msg={saveErr} />}
                                {saveOk  && <OkBanner  msg={saveOk}  />}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="First Name" required>
                                        <input name="first_name" value={form.first_name} onChange={handleChange} required className={inputCls} />
                                    </Field>
                                    <Field label="Last Name" required>
                                        <input name="last_name" value={form.last_name} onChange={handleChange} required className={inputCls} />
                                    </Field>
                                    <Field label="Username" required>
                                        <input name="username" value={form.username} onChange={handleChange} required className={inputCls} />
                                    </Field>
                                    <Field label="Password" required>
                                        <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} className={inputCls} />
                                    </Field>
                                    <Field label="Channel Count" required>
                                        <input name="channel_count" type="number" min={1} value={form.channel_count} onChange={handleChange} required placeholder="e.g. 5" className={inputCls} />
                                    </Field>
                                    <Field label="Plan Type" required>
                                        <select name="plan_type" value={form.plan_type} onChange={handleChange} required className={`${inputCls} bg-white`}>
                                            <option value="">Select plan</option>
                                            <option value="unlimited">Unlimited</option>
                                            <option value="prepaid">Prepaid</option>
                                        </select>
                                    </Field>
                                    <Field label="Assign to Super Admin">
                                        <select name="targetUserId" value={form.targetUserId} onChange={handleChange} className={`${inputCls} bg-white`}>
                                            <option value="">— Unassigned —</option>
                                            {superAdmins.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({u.email}){u.hasClient ? " — already assigned" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>

                                {channelCount > 0 && (
                                    <div className="rounded-lg border border-gray-200 overflow-hidden text-sm">
                                        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Pricing Summary</div>
                                        <div className="divide-y divide-gray-100">
                                            <div className="flex justify-between px-4 py-2.5"><span className="text-gray-700">Channels ({channelCount} × ₹{CHANNEL_PRICE})</span><span className="font-medium">₹{(channelCount * CHANNEL_PRICE).toLocaleString("en-IN")}</span></div>
                                            <div className="flex justify-between px-4 py-2.5"><span className="text-gray-700">Numbers ({channelCount} × ₹{DID_PRICE})</span><span className="font-medium">₹{(channelCount * DID_PRICE).toLocaleString("en-IN")}</span></div>
                                            <div className="flex justify-between px-4 py-2.5 bg-indigo-50 font-bold text-indigo-800"><span>Total</span><span>₹{createTotal.toLocaleString("en-IN")}</span></div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                                    <button type="button" onClick={closeView} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {saving ? "Creating..." : "Create Client"}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ── Edit form ── */}
                        {view === "edit" && selected && (
                            <form onSubmit={handleUpdate} className="space-y-5">
                                <h3 className="text-sm font-semibold text-gray-800">
                                    Edit Client — {selected.username} (ID {selected._id})
                                </h3>
                                {saveErr && <ErrBanner msg={saveErr} />}
                                {saveOk  && <OkBanner  msg={saveOk}  />}

                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Required</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="First Name" required>
                                            <input name="first_name" value={form.first_name} onChange={handleChange} required className={inputCls} />
                                        </Field>
                                        <Field label="Last Name" required>
                                            <input name="last_name" value={form.last_name} onChange={handleChange} required className={inputCls} />
                                        </Field>
                                        <Field label="Username" required>
                                            <input name="username" value={form.username} onChange={handleChange} required className={inputCls} />
                                        </Field>
                                        <Field label="Status">
                                            <button type="button"
                                                onClick={() => setForm(p => ({ ...p, is_active: p.is_active === 1 ? 0 : 1 }))}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                                                    ${form.is_active === 1 ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                                                {form.is_active === 1 ? <><ToggleRight className="h-4 w-4" /> Active</> : <><ToggleLeft className="h-4 w-4" /> Inactive</>}
                                            </button>
                                        </Field>
                                        <Field label="Assign to Super Admin">
                                            <select name="targetUserId" value={form.targetUserId} onChange={handleChange} className={`${inputCls} bg-white`}>
                                                <option value="">— Unassigned —</option>
                                                {superAdmins.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name} ({u.email}){u.hasClient && u.clientInfo?.username !== selected.username ? " — already assigned" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Optional</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Channel Count">
                                            <input name="channel_count" type="number" min={1} value={form.channel_count} onChange={handleChange} placeholder="e.g. 5" className={inputCls} />
                                        </Field>
                                        <Field label="Phone">
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91XXXXXXXXXX" className={`${inputCls} pl-9`} />
                                            </div>
                                        </Field>
                                        <Field label="New Password (blank = unchanged)">
                                            <input name="password" type="password" value={form.password} onChange={handleChange} minLength={8} placeholder="Min 8 chars" className={inputCls} />
                                        </Field>
                                        <Field label="Plan Type">
                                            <select name="plan_type" value={form.plan_type} onChange={handleChange} className={`${inputCls} bg-white`}>
                                                <option value="">— unchanged —</option>
                                                <option value="unlimited">Unlimited</option>
                                                <option value="limited">Limited</option>
                                            </select>
                                        </Field>
                                        <Field label="Wallet Balance">
                                            <input name="wallet_balance" type="number" min={0} value={form.wallet_balance} onChange={handleChange} placeholder="Amount" className={inputCls} />
                                        </Field>
                                        <Field label="Pulse Seconds">
                                            <input name="pulse_seconds" type="number" min={1} value={form.pulse_seconds} onChange={handleChange} placeholder="e.g. 60" className={inputCls} />
                                        </Field>
                                        <Field label="Inbound Rate">
                                            <input name="inbound_rate" type="number" step="0.01" min={0} value={form.inbound_rate} onChange={handleChange} placeholder="e.g. 0.50" className={inputCls} />
                                        </Field>
                                        <Field label="Outbound Rate">
                                            <input name="outbound_rate" type="number" step="0.01" min={0} value={form.outbound_rate} onChange={handleChange} placeholder="e.g. 0.80" className={inputCls} />
                                        </Field>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <button type="button" onClick={closeView} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// SUPER_ADMIN VIEW
// ═════════════════════════════════════════════════════════════════════════════
const KYC_STORAGE_PREFIX = "zencall_kyc_";

const getKycSteps = (accountType) =>
    accountType === "business"
        ? ["Register", "PAN", "Aadhaar", "GST", "Final Submit"]
        : ["Register", "PAN", "Aadhaar", "Final Submit"];

const toVisualIdx = (kycStep, accountType) =>
    accountType === "business" ? kycStep : kycStep > 2 ? kycStep - 1 : kycStep;

const ZenCallClientView = () => {
    const [searchParams] = useSearchParams();
    const { refresh: refreshCtx, isKycSubmitted, markKycAsSubmitted } = useVoiceLink() || {};

    const [tab, setTab]               = useState("account"); // "account" | "kyc" | "numbers"
    const [pageLoad, setPageLoad]     = useState(true);
    const [pageErr, setPageErr]       = useState("");
    const [client, setClient]         = useState(null);
    const [kycStatus, setKycStatus]   = useState(null);
    const [availableDids, setAvailableDids] = useState([]);
    const [assignedDids, setAssignedDids]   = useState([]);
    const [selectedDids, setSelectedDids]   = useState([]);
    const [mapping, setMapping]       = useState(false);
    const [mapped, setMapped]         = useState(false);
    const [mapErr, setMapErr]         = useState("");

    // KYC wizard
    const [kycStep, setKycStep]           = useState(0);
    const [kycLoading, setKycLoading]     = useState(false);
    const [kycError, setKycError]         = useState("");
    const [accountType, setAccountType]   = useState("individual");
    const [aadhaarUrl, setAadhaarUrl]     = useState("");
    const [checkingAadhaar, setCheckingAadhaar] = useState(false);
    const [regForm, setRegForm] = useState({
        account_type: "individual", full_name: "", email: "",
        phone: "", billing_address: "", business_name: "", term_and_condition: false,
    });
    const [panForm, setPanForm] = useState({ pan_number: "", pan_holder_name: "" });
    const [gstForm, setGstForm] = useState({ gst_number: "" });

    // VoiceLink profile
    const [vlProfile, setVlProfile]     = useState(null);
    const [vlProfLoad, setVlProfLoad]   = useState(false);
    const [vlProfErr, setVlProfErr]     = useState("");

    // Team numbers (cloud dialer)
    const [teamNumbers, setTeamNumbers]     = useState([]);
    const [tnLoading, setTnLoading]         = useState(false);
    const [tnError, setTnError]             = useState("");
    const [sipTrunks, setSipTrunks]         = useState([]);
    const [workspaceUsers, setWorkspaceUsers] = useState([]);
    const [importForm, setImportForm]       = useState({
        phone_number: "", address: "", auth_username: "",
        auth_password: "", inbound_enabled: true, outbound_enabled: true,
    });
    const [importing, setImporting]         = useState(false);
    const [importErr, setImportErr]         = useState("");
    const [importOk, setImportOk]           = useState("");
    const [assigningId, setAssigningId]     = useState(null);

    const [routingLoading, setRoutingLoading] = useState(null);
    const [manualTrunkId, setManualTrunkId]  = useState("");

    // Call history
    const [callHistory, setCallHistory]     = useState([]);
    const [chLoading, setChLoading]         = useState(false);
    const [chError, setChError]             = useState("");


    const kycStorageKey = client ? `${KYC_STORAGE_PREFIX}${client.clientId}` : null;

    const isKycComplete = !!(
        kycStatus?.data?.is_complete || kycStatus?.is_complete ||
        kycStatus?.data?.is_kyc_complete || kycStatus?.is_kyc_complete ||
        kycStatus?.data?.kyc_status === 1 || kycStatus?.kyc_status === 1 ||
        kycStatus?.data?.kyc_status_label === "Verified" ||
        vlProfile?.is_verified || vlProfile?.is_kyc_verified || vlProfile?.kyc_verified ||
        vlProfile?.kyc === "Verified" || vlProfile?.kyc === "verified"
    );
    const maxDids       = client?.channelCount || 0;
    const kycSteps      = getKycSteps(accountType);
    const visualIdx     = toVisualIdx(kycStep, accountType);
    const isFinalStep   = (accountType === "individual" && kycStep === 3) || (accountType === "business" && kycStep === 4);

    // Restore KYC wizard from localStorage
    useEffect(() => {
        if (!kycStorageKey) return;
        try {
            const saved = localStorage.getItem(kycStorageKey);
            if (!saved) return;
            const d = JSON.parse(saved);
            if (d.kycStep    !== undefined) setKycStep(d.kycStep);
            if (d.accountType)              setAccountType(d.accountType);
            if (d.aadhaarUrl)               setAadhaarUrl(d.aadhaarUrl);
            if (d.regForm)                  setRegForm(d.regForm);
            if (d.panForm)                  setPanForm(d.panForm);
            if (d.gstForm)                  setGstForm(d.gstForm);
        } catch { /* ignore */ }
    }, [kycStorageKey]);

    // Persist KYC wizard to localStorage
    useEffect(() => {
        if (!kycStorageKey) return;
        localStorage.setItem(kycStorageKey, JSON.stringify({
            kycStep, accountType, aadhaarUrl, regForm, panForm, gstForm,
        }));
    }, [kycStorageKey, kycStep, accountType, aadhaarUrl, regForm, panForm, gstForm]);

    const loadVlProfile = useCallback(async () => {
        setVlProfLoad(true); setVlProfErr("");
        try {
            const res = await api.get("/voicelink/my-profile");
            const data = res.data?.data || res.data;
            setVlProfile(typeof data === "object" && data !== null ? data : null);
        } catch (err) {
            setVlProfErr(err?.response?.data?.message || "Could not load VoiceLink profile.");
        } finally { setVlProfLoad(false); }
    }, []);

    const loadTeamNumbers = useCallback(async () => {
        setTnLoading(true); setTnError("");
        try {
            const [numsRes, trunksRes, usersRes] = await Promise.allSettled([
                api.get("/voicelink/numbers/my-list"),
                api.get("/voicelink/sip-trunks"),
                api.get("/team"),
            ]);
            setTeamNumbers(numsRes.status    === "fulfilled" ? (numsRes.value.data?.data    || []) : []);
            const rawTrunks = trunksRes.status === "fulfilled"
                ? (trunksRes.value.data?.data || trunksRes.value.data || []) : [];
            setSipTrunks(Array.isArray(rawTrunks) ? rawTrunks : []);
            setWorkspaceUsers(usersRes.status === "fulfilled" ? (usersRes.value.data || []) : []);
        } catch (err) {
            setTnError(err?.response?.data?.message || "Failed to load team numbers.");
        } finally { setTnLoading(false); }
    }, []);

    const loadCallHistory = useCallback(async () => {
        setChLoading(true); setChError("");
        try {
            const res = await api.get("/voicelink/call-history?limit=100");
            setCallHistory(res.data?.data || []);
        } catch (err) {
            setChError(err?.response?.data?.message || "Failed to load call history.");
        } finally { setChLoading(false); }
    }, []);

    const handleImportDID = async (e) => {
        e.preventDefault();
        setImportErr(""); setImportOk(""); setImporting(true);
        try {
            await api.post("/voicelink/numbers/import", {
                ...importForm,
                inbound_enabled:  importForm.inbound_enabled  ? 1 : 0,
                outbound_enabled: importForm.outbound_enabled ? 1 : 0,
            });
            setImportOk("DID imported successfully.");
            setImportForm({ phone_number: "", address: "", auth_username: "", auth_password: "", inbound_enabled: true, outbound_enabled: true });
            loadTeamNumbers();
        } catch (err) {
            setImportErr(err?.response?.data?.message || "Failed to import DID.");
        } finally { setImporting(false); }
    };

    const handleAssignDID = async (didId, userId) => {
        setAssigningId(didId);
        try {
            await api.patch(`/voicelink/numbers/${didId}/assign`, { userId: userId || null });
            loadTeamNumbers();
        } catch (err) {
            setTnError(err?.response?.data?.message || "Failed to assign DID.");
        } finally { setAssigningId(null); }
    };

    const handleSetupRouting = async (did) => {
        let trunkName = null;
        if (sipTrunks.length) {
            const trunk = sipTrunks[0];
            trunkName = trunk?.name ?? trunk?.sip_trunk_name ?? trunk?.trunk_name ?? trunk?.id ?? trunk?.sip_trunk_id;
        } else {
            trunkName = manualTrunkId.trim() || null;
        }
        if (!trunkName) { setTnError("Enter your SIP Trunk Name below to configure routing."); return; }
        setRoutingLoading(did.id);
        try {
            await api.post("/voicelink/call-routing/setup", {
                did_id: did.voicelinkDIDId || did.id,
                sip_trunk_name: trunkName,
            });
            loadTeamNumbers();
        } catch (err) {
            setTnError(err?.response?.data?.message || "Failed to configure routing.");
        } finally { setRoutingLoading(null); }
    };

    const load = useCallback(async () => {
        setPageLoad(true); setPageErr("");
        try {
            const res = await api.get("/voicelink/my-account");
            const c = res.data?.client;
            setClient(c);
            if (!c) return;
            const kycRes = await api.get(`/voicelink/kyc/status?client_id=${c.clientId}`);
            setKycStatus(kycRes.data);
            const kData = kycRes.data?.data || kycRes.data || {};
            const kycDone = !!(
                kData.is_complete || 
                kData.is_kyc_complete || 
                kData.kyc_status === 1 || 
                kData.kyc_status_label === "Verified" ||
                kData.is_verified || 
                kData.is_kyc_verified || 
                kData.kyc_verified ||
                (kData.kyc_status && String(kData.kyc_status).toLowerCase() === "verified") ||
                (kData.status && String(kData.status).toLowerCase() === "verified")
            );
            if (kycDone) {
                const [availRes, assignedRes] = await Promise.allSettled([
                    api.get("/voicelink/available-dids"),
                    api.get("/voicelink/my-assigned-dids"),
                ]);
                const availData    = availRes.status    === "fulfilled" ? (availRes.value.data?.data    || []) : [];
                const assignedData = assignedRes.status === "fulfilled" ? (assignedRes.value.data?.data || []) : [];
                setAvailableDids(availData);
                setAssignedDids(assignedData);
            }
        } catch (err) {
            setPageErr(err?.response?.data?.message || "Failed to load ZenVoice data.");
        } finally { setPageLoad(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (client) loadVlProfile();
    }, [client, loadVlProfile]);

    // On mount: determine starting tab from URL param or pending aadhaar return
    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam === "kyc" || tabParam === "numbers") {
            setTab(tabParam);
        }
    }, [searchParams]);

    // Auto-check aadhaar status if we detect a pending return from DigiLocker
    useEffect(() => {
        if (!client || !kycStorageKey) return;
        try {
            const saved = localStorage.getItem(kycStorageKey);
            if (!saved) return;
            const d = JSON.parse(saved);
            if (d.pendingAadhaar && d.aadhaarUrl) {
                setTab("kyc");
                setKycStep(2);
                // Auto-check after a short delay to let state settle
                setTimeout(() => autoCheckAadhaar(client.clientId, kycStorageKey), 800);
            }
        } catch { /* ignore */ }
    }, [client, kycStorageKey]);

    const autoCheckAadhaar = async (cid, storageKey) => {
        setCheckingAadhaar(true); setKycError("");
        try {
            const res = await api.get(`/voicelink/kyc/status?client_id=${cid}`);
            if (res.data?.data?.aadhaar_verified) {
                setKycStep(3);
                // Clear pending flag
                try {
                    const saved = localStorage.getItem(storageKey);
                    if (saved) {
                        const d = JSON.parse(saved);
                        d.pendingAadhaar = false;
                        localStorage.setItem(storageKey, JSON.stringify(d));
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore, user can manually check */ }
        finally { setCheckingAadhaar(false); }
    };

    // Load data when switching to data-driven tabs
    useEffect(() => {
        if (tab === "team-numbers") loadTeamNumbers();
        if (tab === "call-history") loadCallHistory();
    }, [tab, loadTeamNumbers, loadCallHistory]);

    // ── KYC handlers ────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault(); setKycError(""); setKycLoading(true);
        try {
            const payload = { ...regForm, client_id: client.clientId };
            if (regForm.account_type !== "business") delete payload.business_name;
            await api.post("/voicelink/kyc/step-1", payload);
            setAccountType(regForm.account_type);
            setKycStep(1);
        } catch (err) { setKycError(err?.response?.data?.message || "Failed to save register details."); }
        finally { setKycLoading(false); }
    };

    const handlePan = async (e) => {
        e.preventDefault(); setKycError(""); setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/step-2", { ...panForm, client_id: client.clientId });
            setKycStep(2);
        } catch (err) {
            const msg = err?.response?.data?.message || "PAN verification failed.";
            setKycError(msg.toLowerCase().includes("name") || err?.response?.status === 422
                ? `${msg} — Name must match your PAN card exactly as per NSDL records.`
                : msg);
        } finally { setKycLoading(false); }
    };

    const initiateAadhaar = async () => {
        setKycError(""); setKycLoading(true);
        try {
            const res = await api.post("/voicelink/kyc/step-3-init", { client_id: client.clientId });
            const url = res.data?.data?.redirect_url || "";
            setAadhaarUrl(url);
            // Save pending state — page will auto-check on return
            if (kycStorageKey) {
                try {
                    const existing = JSON.parse(localStorage.getItem(kycStorageKey) || "{}");
                    localStorage.setItem(kycStorageKey, JSON.stringify({ ...existing, aadhaarUrl: url, pendingAadhaar: true }));
                } catch { /* ignore */ }
            }
            // Navigate to DigiLocker in same tab so return lands on /zenvoice
            if (url) window.location.href = url;
        } catch (err) { setKycError(err?.response?.data?.message || "Failed to initiate Aadhaar verification."); }
        finally { setKycLoading(false); }
    };

    const checkAadhaarStatus = async () => {
        setCheckingAadhaar(true); setKycError("");
        try {
            const res = await api.get(`/voicelink/kyc/status?client_id=${client.clientId}`);
            if (res.data?.data?.aadhaar_verified) {
                setKycStep(3);
                if (kycStorageKey) {
                    try {
                        const d = JSON.parse(localStorage.getItem(kycStorageKey) || "{}");
                        d.pendingAadhaar = false;
                        localStorage.setItem(kycStorageKey, JSON.stringify(d));
                    } catch { /* ignore */ }
                }
            } else {
                setKycError("Aadhaar not verified yet. Complete the DigiLocker process first.");
            }
        } catch (err) { setKycError(err?.response?.data?.message || "Failed to check Aadhaar status."); }
        finally { setCheckingAadhaar(false); }
    };

    const handleGst = async (e) => {
        e.preventDefault(); setKycError(""); setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/step-4", { gst_number: gstForm.gst_number.toUpperCase(), client_id: client.clientId });
            setKycStep(4);
        } catch (err) { setKycError(err?.response?.data?.message || "GST verification failed."); }
        finally { setKycLoading(false); }
    };

    const handleFinalSubmit = async () => {
        setKycError(""); setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/final-submit", { client_id: client.clientId });
            if (kycStorageKey) localStorage.removeItem(kycStorageKey);

            // Force KYC complete locally so the numbers tab unlocks immediately
            // (VoiceLink's status API may lag behind the submission)
            setKycStatus({ data: { is_kyc_complete: true } });
            markKycAsSubmitted?.(client.clientId);
            refreshCtx?.();

            // Fetch DIDs now that KYC is done
            const [availRes, assignedRes] = await Promise.allSettled([
                api.get("/voicelink/available-dids"),
                api.get("/voicelink/my-assigned-dids"),
            ]);
            setAvailableDids(availRes.status === "fulfilled" ? (availRes.value.data?.data || []) : []);
            setAssignedDids(assignedRes.status === "fulfilled" ? (assignedRes.value.data?.data || []) : []);

            setTab("numbers");
        } catch (err) { setKycError(err?.response?.data?.message || "Final KYC submission failed."); }
        finally { setKycLoading(false); }
    };

    // ── DID handlers ─────────────────────────────────────────────────────────
    const toggleDid = (didId) => {
        setSelectedDids(prev => {
            if (prev.includes(didId)) return prev.filter(id => id !== didId);
            if (prev.length >= maxDids) return prev;
            return [...prev, didId];
        });
    };

    const handleMapDids = async () => {
        if (selectedDids.length === 0) return;
        setMapping(true); setMapErr("");
        try {
            for (const didId of selectedDids) {
                await api.post("/voicelink/map-did", {
                    client_id: client.clientId, did_id: didId,
                    call_recording: 0, user_status: 2,
                });
            }
            setMapped(true);
        } catch (err) { setMapErr(err?.response?.data?.message || "Failed to assign numbers."); }
        finally { setMapping(false); }
    };

    // ── Loading / error states ────────────────────────────────────────────────
    if (pageLoad) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
    );
    if (pageErr) return (
        <div className="max-w-2xl mx-auto mt-10 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{pageErr}</span>
        </div>
    );

    // No client: provisioning not done yet
    if (!client) return (
        <div className="max-w-xl mx-auto mt-20 text-center space-y-5">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <PhoneIncoming className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">ZenVoice Not Set Up</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
                Your ZenVoice account has not been provisioned yet.
                Contact your platform administrator to set it up.
            </p>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 text-left">
                <p className="font-semibold mb-1">What is ZenVoice?</p>
                <p>ZenVoice is an AI-powered voice agent that automates calls and engages your leads directly from the CRM.</p>
            </div>
        </div>
    );

    const availableTabs = [
        { key: "account",      icon: User,         label: "My Account" },
        ...(isKycComplete || isKycSubmitted
            ? [
                { key: "numbers",      icon: Hash,         label: "Available Numbers" },
                { key: "my-numbers",   icon: Phone,        label: "My Numbers" },
                { key: "team-numbers", icon: Users,        label: "Team Numbers" },
              ]
            : [{ key: "kyc",           icon: Shield,       label: "KYC" }]
        ),
        ...((isKycSubmitted && !isKycComplete) ? [{ key: "kyc", icon: Shield, label: "KYC Status" }] : []),
        { key: "call-history", icon: PhoneCall,     label: "Call History" },
        { key: "dialer",       icon: Radio,         label: "Dialer" },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">ZenVoice</h1>
                    <p className="text-sm text-gray-500">Your AI voice agent</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        isKycComplete ? "bg-green-100 text-green-700" : 
                        isKycSubmitted ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                        "bg-amber-100 text-amber-700"
                    }`}>
                        {isKycComplete ? "KYC Approved" : isKycSubmitted ? "KYC In Progress" : "KYC Pending"}
                    </span>
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {availableTabs.map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                        <Icon className="h-4 w-4" />{label}
                    </button>
                ))}
            </div>

            {/* ── My Account tab ── */}
            {tab === "account" && (
                <div className="space-y-5">
                    {/* Client info card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <PhoneIncoming className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{client.username}</p>
                                <p className="text-xs text-gray-500">
                                    Client ID: <span className="font-mono">{client.clientId}</span>
                                    {" · "}{client.channelCount} channel{client.channelCount !== 1 ? "s" : ""}
                                </p>
                            </div>
                            {!isKycComplete && (
                                <button onClick={() => setTab("kyc")}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                                    <Shield className="h-3.5 w-3.5" /> Complete KYC <ChevronRight className="h-3 w-3" />
                                </button>
                            )}
                            {isKycComplete && (
                                <button onClick={() => setTab("numbers")}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                    <Hash className="h-3.5 w-3.5" /> Phone Numbers <ChevronRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* VoiceLink Profile */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-indigo-600" />
                                <h2 className="text-sm font-semibold text-gray-900">VoiceLink Profile</h2>
                            </div>
                            <button onClick={loadVlProfile} disabled={vlProfLoad}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                <RefreshCw className={`h-3 w-3 ${vlProfLoad ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                        <div className="p-5">
                            {vlProfLoad && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                                </div>
                            )}
                            {vlProfErr && !vlProfLoad && (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Could not load VoiceLink profile</p>
                                            <p className="mt-0.5 text-amber-700">{vlProfErr}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={loadVlProfile}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                            <RefreshCw className="h-3 w-3" /> Retry
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!vlProfLoad && vlProfile && (() => {
                                const entries = Object.entries(vlProfile).filter(
                                    ([, v]) => typeof v !== "object"
                                );
                                return entries.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-3">No profile data available.</p>
                                ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {entries.map(([key, value]) => (
                                                <div key={key} className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                                        {key.replace(/_/g, " ")}
                                                    </p>
                                                    <p className="text-sm font-medium text-gray-900 break-all">{String(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                );
                            })()}
                        </div>
                    </div>

                </div>
            )}

            {/* ── KYC tab ── */}
            {tab === "kyc" && !isKycComplete && !isKycSubmitted && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-6 py-5 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-5 w-5 text-amber-500" />
                            <h2 className="text-base font-semibold text-gray-900">KYC Verification</h2>
                        </div>
                        {/* Step progress bar */}
                        <div className="flex items-center">
                            {kycSteps.map((label, i) => {
                                const isDone   = visualIdx > i;
                                const isActive = visualIdx === i;
                                return (
                                    <div key={i} className="flex items-center flex-1 last:flex-none">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                ${isDone   ? "bg-indigo-600 text-white" :
                                                  isActive ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                                                             "bg-gray-100 text-gray-400"}`}>
                                                {isDone ? "✓" : i + 1}
                                            </div>
                                            <span className={`text-[10px] font-medium text-center w-14 leading-tight
                                                ${isDone || isActive ? "text-indigo-600" : "text-gray-400"}`}>{label}</span>
                                        </div>
                                        {i < kycSteps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-5 ${isDone ? "bg-indigo-600" : "bg-gray-200"}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        {kycError && <ErrBanner msg={kycError} />}

                        {/* Step 0: Register Details */}
                        {kycStep === 0 && (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Register Details</h3>
                                <Field label="Account Type" required>
                                    <select value={regForm.account_type} onChange={e => setRegForm(p => ({ ...p, account_type: e.target.value }))} className={`${inputCls} bg-white`}>
                                        <option value="individual">Individual</option>
                                        <option value="business">Business</option>
                                    </select>
                                </Field>
                                {regForm.account_type === "business" && (
                                    <Field label="Business Name" required>
                                        <input value={regForm.business_name} required onChange={e => setRegForm(p => ({ ...p, business_name: e.target.value }))} className={inputCls} />
                                    </Field>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Full Legal Name" required>
                                        <input value={regForm.full_name} required onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))} className={inputCls} />
                                    </Field>
                                    <Field label="Email" required>
                                        <input type="email" value={regForm.email} required onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
                                    </Field>
                                    <Field label="Phone" required>
                                        <input value={regForm.phone} required placeholder="+91XXXXXXXXXX" onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
                                    </Field>
                                </div>
                                <Field label="Billing Address" required>
                                    <textarea value={regForm.billing_address} required rows={2} onChange={e => setRegForm(p => ({ ...p, billing_address: e.target.value }))} className={`${inputCls} resize-none`} placeholder="123 Main St, City, State, PIN" />
                                </Field>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" required checked={regForm.term_and_condition} onChange={e => setRegForm(p => ({ ...p, term_and_condition: e.target.checked }))} className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-gray-300" />
                                    <span className="text-sm text-gray-700">I accept VoiceLink Terms of Service and telecom compliance requirements</span>
                                </label>
                                <div className="flex justify-end pt-2 border-t border-gray-100">
                                    <KycBtn loading={kycLoading} label="Save & Continue" />
                                </div>
                            </form>
                        )}

                        {/* Step 1: PAN */}
                        {kycStep === 1 && (
                            <form onSubmit={handlePan} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">PAN Verification</h3>
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-1">
                                    <p className="font-semibold">How to match your PAN name exactly:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                                        <li>Enter name <strong>exactly as on your PAN card</strong></li>
                                        <li>Verify at <span className="font-mono">incometax.gov.in</span> using your PAN number</li>
                                        <li>South Indian names: try <span className="font-mono">INITIAL FIRSTNAME</span> (e.g. <span className="font-mono">J DHARUN</span>)</li>
                                    </ul>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="PAN Number" required>
                                        <input value={panForm.pan_number} required placeholder="ABCDE1234F" maxLength={10}
                                            onChange={e => setPanForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} className={inputCls} />
                                    </Field>
                                    <Field label="Name on PAN Card" required>
                                        <input value={panForm.pan_holder_name} required placeholder="Exactly as on PAN card"
                                            onChange={e => setPanForm(p => ({ ...p, pan_holder_name: e.target.value.toUpperCase() }))} className={inputCls} />
                                    </Field>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button" onClick={() => { setKycError(""); setKycStep(0); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">← Back</button>
                                    <KycBtn loading={kycLoading} label="Verify PAN" />
                                </div>
                            </form>
                        )}

                        {/* Step 2: Aadhaar */}
                        {kycStep === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Aadhaar Verification via DigiLocker</h3>
                                <p className="text-sm text-gray-600">Click below to start Aadhaar verification. You will be taken to DigiLocker — once done, you will return here automatically.</p>
                                {checkingAadhaar && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Checking Aadhaar verification status…</span>
                                    </div>
                                )}
                                {!aadhaarUrl ? (
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <button type="button" onClick={() => { setKycError(""); setKycStep(1); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">← Back</button>
                                        <button onClick={initiateAadhaar} disabled={kycLoading}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                            {kycLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {kycLoading ? "Initiating..." : "Start Aadhaar Verification →"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 space-y-2">
                                            <p className="font-semibold">DigiLocker process started</p>
                                            <p className="text-xs text-amber-700">If you were not redirected automatically, use the button below. Return here after completing DigiLocker.</p>
                                            <a href={aadhaarUrl} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors">
                                                <ExternalLink className="h-3.5 w-3.5" /> Open DigiLocker
                                            </a>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                            <button type="button" onClick={() => { setKycError(""); setAadhaarUrl(""); setKycStep(1); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">← Back</button>
                                            <button onClick={checkAadhaarStatus} disabled={checkingAadhaar}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                                {checkingAadhaar && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {checkingAadhaar ? "Checking…" : "I've Completed Aadhaar — Check Status"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3 (business only): GST */}
                        {kycStep === 3 && accountType === "business" && (
                            <form onSubmit={handleGst} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">GST Verification</h3>
                                <Field label="GSTIN" required>
                                    <input value={gstForm.gst_number} required placeholder="22AAAAA0000A1Z5" maxLength={15}
                                        onChange={e => setGstForm({ gst_number: e.target.value })} className={inputCls} />
                                </Field>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button" onClick={() => { setKycError(""); setKycStep(2); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">← Back</button>
                                    <KycBtn loading={kycLoading} label="Verify GST" />
                                </div>
                            </form>
                        )}

                        {/* Final Submit */}
                        {isFinalStep && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Final KYC Submission</h3>
                                <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                                    All verification steps complete. Click below to finalise and submit your KYC.
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button" onClick={() => { setKycError(""); setKycStep(accountType === "business" ? 3 : 2); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">← Back</button>
                                    <button onClick={handleFinalSubmit} disabled={kycLoading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                                        {kycLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {kycLoading ? "Submitting…" : "Submit KYC"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* KYC submitted but not yet approved by API */}
            {tab === "kyc" && !isKycComplete && isKycSubmitted && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
                    <div className="relative mx-auto h-16 w-16">
                        <Shield className="h-16 w-16 text-amber-400 opacity-20" />
                        <Loader2 className="absolute inset-0 h-16 w-16 text-amber-500 animate-spin stroke-[1.5]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-gray-900">KYC In Progress</h2>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                            Your KYC documents have been submitted successfully. 
                            VoiceLink is currently processing your verification. 
                            <strong> This usually takes 5-10 minutes.</strong>
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                        <button onClick={() => setTab("numbers")} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                            <Hash className="h-4 w-4" /> Go to Phone Numbers
                        </button>
                        <button onClick={load} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <RefreshCw className="h-4 w-4" /> Check Status Now
                        </button>
                    </div>
                </div>
            )}

            {/* KYC already complete but user landed on kyc tab */}
            {tab === "kyc" && isKycComplete && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                    <h2 className="text-base font-semibold text-gray-900">KYC Approved</h2>
                    <p className="text-sm text-gray-500">Your KYC has been verified. Proceed to assign phone numbers.</p>
                    <button onClick={() => setTab("numbers")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        <Hash className="h-4 w-4" /> Go to Phone Numbers
                    </button>
                </div>
            )}

            {/* ── My Numbers tab ── */}
            {tab === "my-numbers" && (isKycComplete || isKycSubmitted) && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-600" />
                            <h2 className="text-sm font-semibold text-gray-900">Your Assigned Numbers</h2>
                            {assignedDids.length > 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                    {assignedDids.length}
                                </span>
                            )}
                        </div>
                        <button onClick={load} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" /> Sync Now
                        </button>
                    </div>
                    {assignedDids.length === 0 ? (
                        <div className="p-12 text-center space-y-3">
                            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                                <Phone className="h-6 w-6 text-gray-400" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-900">No numbers assigned</h3>
                            <p className="text-xs text-gray-500 max-w-xs mx-auto">You haven't assigned any phone numbers to your account yet.</p>
                            <button onClick={() => setTab("numbers")} className="text-xs font-semibold text-indigo-600 hover:underline block mx-auto">
                                Browse available numbers →
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {assignedDids.map((did) => (
                                <div key={did.did_id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 border border-green-100">
                                        <Hash className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900">{did.did_number}</p>
                                        <p className="text-[11px] text-gray-500 flex items-center gap-2">
                                            <span>{did.type_label}</span>
                                            <span className="h-1 w-1 rounded-full bg-gray-300" />
                                            <span>{did.country_code}</span>
                                            <span className="h-1 w-1 rounded-full bg-gray-300" />
                                            <span className="text-orange-600 font-medium">Expires {did.expiry_date}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-tighter">
                                            Active
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Available Numbers tab ── */}
            {tab === "numbers" && (isKycComplete || isKycSubmitted) && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Available Phone Numbers</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Select up to {maxDids} number{maxDids !== 1 ? "s" : ""}
                                {" "}({selectedDids.length}/{maxDids} selected)
                            </p>
                        </div>
                        {!mapped && (
                            <button onClick={handleMapDids} disabled={selectedDids.length === 0 || mapping}
                                className="flex items-center gap-2 shrink-0 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                {mapping && <Loader2 className="h-4 w-4 animate-spin" />}
                                {mapping ? "Assigning…" : `Assign ${selectedDids.length} Number${selectedDids.length !== 1 ? "s" : ""}`}
                            </button>
                        )}
                    </div>
                    {mapErr && <div className="mx-6 mt-4"><ErrBanner msg={mapErr} /></div>}

                    {mapped ? (
                        <div className="p-10 text-center space-y-4">
                            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
                            <h2 className="text-lg font-bold text-gray-900">Numbers Assigned!</h2>
                            <p className="text-sm text-gray-600">{selectedDids.length} number{selectedDids.length !== 1 ? "s have" : " has"} been assigned to your ZenVoice account.</p>
                            <button onClick={() => { setMapped(false); setSelectedDids([]); load(); setTab("my-numbers"); }} 
                                className="inline-flex items-center gap-2 mx-auto px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                                <Phone className="h-4 w-4" /> Go to My Numbers
                            </button>
                        </div>
                    ) : (() => {
                        const filteredAvail = availableDids.filter(a => !assignedDids.some(m => m.did_id === a.did_id));
                        
                        return filteredAvail.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto">
                                    <Hash className="h-6 w-6 text-gray-300" />
                                </div>
                                <p className="text-sm text-gray-500">No more numbers available for assignment. Contact your reseller to purchase more DIDs.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredAvail.map((did) => {
                                    const isSelected = selectedDids.includes(did.did_id);
                                    const isDisabled = !isSelected && (assignedDids.length + selectedDids.length) >= maxDids;
                                    return (
                                        <label key={did.did_id}
                                            className={`flex items-center gap-4 px-6 py-4 transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}>
                                            <input type="checkbox" checked={isSelected} disabled={isDisabled} onChange={() => toggleDid(did.did_id)} className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900">{did.did_number}</p>
                                                <p className="text-xs text-gray-500">{did.type_label} · {did.country_code} · Expires {did.expiry_date}</p>
                                            </div>
                                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{did.user_status_label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* KYC not done but on numbers tab */}
            {tab === "numbers" && !isKycComplete && !isKycSubmitted && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
                    <Shield className="h-12 w-12 text-amber-400 mx-auto" />
                    <h2 className="text-base font-semibold text-gray-900">KYC Required</h2>
                    <p className="text-sm text-gray-500">Complete KYC verification to unlock phone number selection.</p>
                    <button onClick={() => setTab("kyc")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors">
                        <Shield className="h-4 w-4" /> Go to KYC
                    </button>
                </div>
            )}

            {/* ── Team Numbers tab ── */}
            {tab === "team-numbers" && (
                <div className="space-y-5">
                    {/* Import form */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <Plus className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-semibold text-gray-900">Import DID Number</h2>
                        </div>
                        <form onSubmit={handleImportDID} className="p-6 space-y-4">
                            {importErr && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex gap-2"><AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{importErr}</span></div>}
                            {importOk  && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs flex gap-2"><CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{importOk}</span></div>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number (DID) <span className="text-red-500">*</span></label>
                                    <input required value={importForm.phone_number} onChange={e => setImportForm(p => ({ ...p, phone_number: e.target.value }))}
                                        placeholder="+919876543210" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">SIP Address</label>
                                    <input value={importForm.address} onChange={e => setImportForm(p => ({ ...p, address: e.target.value }))}
                                        placeholder="sip.provider.com" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Auth Username</label>
                                    <input value={importForm.auth_username} onChange={e => setImportForm(p => ({ ...p, auth_username: e.target.value }))}
                                        placeholder="sip_user" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Auth Password</label>
                                    <input type="password" value={importForm.auth_password} onChange={e => setImportForm(p => ({ ...p, auth_password: e.target.value }))}
                                        placeholder="••••••••" className={inputCls} />
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={importForm.inbound_enabled}
                                        onChange={e => setImportForm(p => ({ ...p, inbound_enabled: e.target.checked }))}
                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                                    Inbound Enabled
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={importForm.outbound_enabled}
                                        onChange={e => setImportForm(p => ({ ...p, outbound_enabled: e.target.checked }))}
                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                                    Outbound Enabled
                                </label>
                            </div>
                            <div className="flex justify-end pt-2 border-t border-gray-100">
                                <button type="submit" disabled={importing}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    {importing ? "Importing…" : "Import DID"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* SIP Trunk ID — shown when auto-fetch returns nothing */}
                    {!sipTrunks.length && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
                            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-amber-800 mb-1">SIP Trunk Name required for routing</p>
                                <p className="text-[11px] text-amber-700 mb-2">
                                    Enter your custom SIP trunk name from your VoiceLink dashboard.
                                </p>
                                <input
                                    value={manualTrunkId}
                                    onChange={e => setManualTrunkId(e.target.value)}
                                    placeholder="e.g. HexiteTech or my-custom-trunk"
                                    className="w-full max-w-xs border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* Numbers list with assignment */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-indigo-600" />
                                <h2 className="text-sm font-semibold text-gray-900">Imported Numbers</h2>
                                {teamNumbers.length > 0 && <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">{teamNumbers.length}</span>}
                            </div>
                            <button onClick={loadTeamNumbers} disabled={tnLoading} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                <RefreshCw className={`h-3 w-3 ${tnLoading ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                        {tnError && <div className="mx-6 mt-4"><ErrBanner msg={tnError} /></div>}
                        {tnLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>}
                        {!tnLoading && teamNumbers.length === 0 && (
                            <div className="p-10 text-center space-y-2">
                                <Hash className="h-8 w-8 text-gray-200 mx-auto" />
                                <p className="text-sm text-gray-500">No DID numbers imported yet. Use the form above to add one.</p>
                            </div>
                        )}
                        {!tnLoading && teamNumbers.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {teamNumbers.map(did => (
                                    <div key={did.id} className="px-6 py-4 flex items-center gap-4">
                                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                            <Hash className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{did.number}</p>
                                            <p className="text-xs text-gray-400 flex items-center gap-2">
                                                {did.inboundEnabled  && <span className="text-green-600 flex items-center gap-0.5"><ArrowDownLeft className="h-3 w-3" />In</span>}
                                                {did.outboundEnabled && <span className="text-blue-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />Out</span>}
                                                {did.routingId && <span className="text-indigo-500">Routing ✓</span>}
                                                {did.sipAddress && <span className="text-gray-400 truncate">{did.sipAddress}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Routing setup */}
                                            {!did.routingId && (
                                                <button onClick={() => handleSetupRouting(did)} disabled={routingLoading === did.id}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-60">
                                                    {routingLoading === did.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
                                                    Setup Routing
                                                </button>
                                            )}
                                            {/* Assign to user */}
                                            <div className="flex items-center gap-1">
                                                <UserPlus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                                <select
                                                    value={did.assignedToEmployeeId || ""}
                                                    onChange={e => handleAssignDID(did.id, e.target.value || null)}
                                                    disabled={assigningId === did.id}
                                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[160px]"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {workspaceUsers.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Call History tab ── */}
            {tab === "call-history" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-semibold text-gray-900">Call History</h2>
                            {callHistory.length > 0 && <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">{callHistory.length}</span>}
                        </div>
                        <button onClick={loadCallHistory} disabled={chLoading} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            <RefreshCw className={`h-3 w-3 ${chLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                    {chError && <div className="mx-6 mt-4"><ErrBanner msg={chError} /></div>}
                    {chLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>}
                    {!chLoading && callHistory.length === 0 && (
                        <div className="p-12 text-center space-y-2">
                            <PhoneCall className="h-8 w-8 text-gray-200 mx-auto" />
                            <p className="text-sm text-gray-500">No call history yet. Calls will appear here as they happen.</p>
                        </div>
                    )}
                    {!chLoading && callHistory.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {["Direction","From","To","DID","Status","Duration","Recording","Time"].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {callHistory.map(ev => {
                                        const statusColor = { connected:"text-green-700 bg-green-50", hangup:"text-gray-600 bg-gray-100", failed:"text-red-600 bg-red-50", initiated:"text-blue-600 bg-blue-50", ringing:"text-amber-600 bg-amber-50" }[ev.status] ?? "text-gray-500 bg-gray-50";
                                        return (
                                            <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    {ev.direction === "inbound"
                                                        ? <span className="flex items-center gap-1 text-green-600"><ArrowDownLeft className="h-3.5 w-3.5" />In</span>
                                                        : <span className="flex items-center gap-1 text-blue-600"><ArrowUpRight className="h-3.5 w-3.5" />Out</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700">{ev.from || "—"}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700">{ev.to || "—"}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.did || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{ev.status}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    {ev.duration != null ? `${Math.floor(ev.duration/60)}m ${ev.duration%60}s` : "—"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {ev.recordingUrl
                                                        ? <audio controls src={ev.recordingUrl} className="h-7 w-40" />
                                                        : <span className="text-xs text-gray-400">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                                                    {new Date(ev.createdAt).toLocaleString("en-IN", { dateStyle:"short", timeStyle:"short" })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Dialer tab ── */}
            {tab === "dialer" && (
                <ZenDialer />
            )}
        </div>
    );
};

// ── Shared small components ───────────────────────────────────────────────────
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
const KycBtn = ({ loading, label }) => (
    <button type="submit" disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Processing…" : label}
    </button>
);

export { ZenCallResellerView };
export default ZenCallPage;
