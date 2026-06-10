import { useState, useEffect, useCallback } from "react";
import {
    Building2, Loader2, AlertCircle, RefreshCw,
    Pencil, CheckCircle, X, Phone, Info,
    ToggleLeft, ToggleRight, Users, ExternalLink,
} from "lucide-react";
import api from "../api/axios";

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const EMPTY_FORM = {
    first_name: "", last_name: "", username: "", email: "",
    phone: "", password: "", is_active: 1,
    channel_count: "", negative_threshold: "", plan_type: "",
    pulse_seconds: "", inbound_rate: "", outbound_rate: "", wallet_balance: "",
};

const VoiceLinkResellerPage = () => {
    // Reseller profile state
    const [profile, setProfile]     = useState(null);
    const [profLoad, setProfLoad]   = useState(true);
    const [profErr, setProfErr]     = useState("");

    // Clients list state
    const [clients, setClients]         = useState([]);
    const [clientsLoad, setClientsLoad] = useState(true);
    const [clientsErr, setClientsErr]   = useState("");

    // Selected client for edit
    const [selected, setSelected]   = useState(null);
    const [showEdit, setShowEdit]   = useState(false);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);
    const [saveErr, setSaveErr]     = useState("");
    const [saveOk, setSaveOk]       = useState("");

    // Per-client toggle loading (Set of _id values)
    const [toggling, setToggling]   = useState(new Set());

    // ── Loaders ───────────────────────────────────────────────────────────────
    const loadProfile = useCallback(async () => {
        setProfLoad(true);
        setProfErr("");
        try {
            const res = await api.get("/voicelink/reseller/profile");
            setProfile(res.data?.data || res.data);
        } catch (err) {
            setProfErr(err?.response?.data?.message || "Failed to load reseller profile.");
        } finally {
            setProfLoad(false);
        }
    }, []);

    const loadClients = useCallback(async () => {
        setClientsLoad(true);
        setClientsErr("");
        try {
            const res = await api.get("/voicelink/reseller/clients");
            const raw = res.data;
            const list = raw?.data || raw?.clients || raw;
            const normalized = (Array.isArray(list) ? list : []).map(c => ({
                ...c,
                _id: c.client_id ?? c.clientId ?? c.id ?? c.client_ID,
            }));
            setClients(normalized);
        } catch (err) {
            setClientsErr(err?.response?.data?.message || "Failed to load client list.");
            setClients([]);
        } finally {
            setClientsLoad(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
        loadClients();
    }, [loadProfile, loadClients]);

    // ── Open edit ─────────────────────────────────────────────────────────────
    const openEdit = (client) => {
        setSaveErr("");
        setSaveOk("");
        setSelected(client);
        setForm({
            ...EMPTY_FORM,
            first_name:         client.first_name         || "",
            last_name:          client.last_name          || "",
            username:           client.username           || "",
            email:              client.email              || "",
            phone:              client.phone              || "",
            channel_count:      client.channel_count      ?? "",
            negative_threshold: client.negative_threshold ?? "",
            is_active:          client.is_active          ?? 1,
            plan_type:          client.plan_type          || "",
        });
        setShowEdit(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
    };

    // ── Update client ─────────────────────────────────────────────────────────
    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaveErr("");
        setSaveOk("");
        setSaving(true);
        try {
            const payload = {
                first_name:  form.first_name,
                last_name:   form.last_name,
                username:    form.username,
                email:       form.email,
                is_active:   Number(form.is_active),
            };
            if (form.channel_count)      payload.channel_count      = Number(form.channel_count);
            if (form.negative_threshold) payload.negative_threshold = Number(form.negative_threshold);
            if (form.phone)              payload.phone              = form.phone;
            if (form.password)           payload.password           = form.password;
            if (form.plan_type)          payload.plan_type          = form.plan_type;
            if (form.pulse_seconds)      payload.pulse_seconds      = Number(form.pulse_seconds);
            if (form.inbound_rate)       payload.inbound_rate       = Number(form.inbound_rate);
            if (form.outbound_rate)      payload.outbound_rate      = Number(form.outbound_rate);
            if (form.wallet_balance)     payload.wallet_balance     = Number(form.wallet_balance);

            await api.put(`/voicelink/reseller/client/${selected._id}`, payload);
            setSaveOk("Client updated successfully.");
            await loadClients();
        } catch (err) {
            setSaveErr(err?.response?.data?.message || "Failed to update client.");
        } finally {
            setSaving(false);
        }
    };

    // ── Toggle active / inactive ──────────────────────────────────────────────
    const handleToggle = async (client) => {
        const newStatus = (client.is_active === 1 || client.is_active === true) ? 0 : 1;
        setToggling(prev => new Set(prev).add(client._id));
        try {
            await api.put(`/voicelink/reseller/client/${client._id}`, {
                first_name:  client.first_name  || "",
                last_name:   client.last_name   || "",
                username:    client.username    || "",
                email:       client.email       || "",
                is_active:   newStatus,
            });
            await loadClients();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to update client status.");
        } finally {
            setToggling(prev => { const s = new Set(prev); s.delete(client._id); return s; });
        }
    };

    const profileEntries = profile
        ? Object.entries(profile).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
        : [];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Reseller Account</h1>
                    <p className="text-sm text-gray-500">VoiceLink reseller profile and client management</p>
                </div>
                <button
                    onClick={() => { loadProfile(); loadClients(); }}
                    disabled={profLoad || clientsLoad}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className={`h-4 w-4 ${(profLoad || clientsLoad) ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* ── Reseller Profile ─────────────────────────────────────────── */}
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

            {/* ── Client Management ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Client Management</h2>
                        {clients.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                {clients.length}
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {clientsLoad && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 text-indigo-600 animate-spin" /></div>}

                    {!clientsLoad && clientsErr && (
                        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{clientsErr}</span>
                        </div>
                    )}

                    {!clientsLoad && !clientsErr && clients.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-6">No clients found on VoiceLink.</p>
                    )}

                    {/* Clients list */}
                    {!clientsLoad && !clientsErr && clients.length > 0 && !showEdit && (
                        <>
                            <div className="space-y-3">
                                {clients.map((c) => {
                                    const displayName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username;
                                    const isActive = c.is_active === 1 || c.is_active === true;
                                    const isToggling = toggling.has(c._id);
                                    return (
                                        <div key={c._id ?? c.username} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                                        ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                                        {isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    <span className="font-mono">@{c.username}</span>
                                                    {" · "}ID: <span className="font-mono">{c._id}</span>
                                                    {c.channel_count != null && ` · ${c.channel_count} ch`}
                                                    {c.email && ` · ${c.email}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Update
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(c)}
                                                    disabled={isToggling}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50
                                                        ${isActive
                                                            ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                                            : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"}`}
                                                >
                                                    {isToggling
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : isActive
                                                            ? <><ToggleLeft className="h-3.5 w-3.5" /> Deactivate</>
                                                            : <><ToggleRight className="h-3.5 w-3.5" /> Activate</>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Permanent deletion note */}
                            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                    To permanently delete a client, use the{" "}
                                    <a
                                        href="https://app.voicelink.co.in/admin/clients"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 hover:text-blue-900"
                                    >
                                        VoiceLink admin panel
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                    . The reseller API does not permit client deletion.
                                </span>
                            </div>
                        </>
                    )}

                    {/* ── Inline update form ── */}
                    {!clientsLoad && selected && showEdit && (
                        <form onSubmit={handleUpdate} className="space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-800">
                                    Update Client — {selected.username} (ID {selected._id})
                                </h3>
                                <button type="button" onClick={() => { setShowEdit(false); setSelected(null); }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {saveErr && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{saveErr}</span>
                                </div>
                            )}
                            {saveOk && (
                                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex gap-2">
                                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{saveOk}</span>
                                </div>
                            )}

                            {/* Required fields */}
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
                                    <Field label="Email" required>
                                        <input name="email" type="email" value={form.email} onChange={handleChange} required className={inputCls} />
                                    </Field>
                                    <Field label="Status" required>
                                        <div className="flex items-center gap-3 h-9">
                                            <button type="button"
                                                onClick={() => setForm(p => ({ ...p, is_active: p.is_active === 1 ? 0 : 1 }))}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                                                    ${form.is_active === 1
                                                        ? "bg-green-50 border-green-200 text-green-700"
                                                        : "bg-red-50 border-red-200 text-red-700"}`}
                                            >
                                                {form.is_active === 1
                                                    ? <><ToggleRight className="h-4 w-4" /> Active</>
                                                    : <><ToggleLeft className="h-4 w-4" /> Inactive</>
                                                }
                                            </button>
                                        </div>
                                    </Field>
                                </div>
                            </div>

                            {/* Optional fields */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Optional</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Channel Count">
                                        <input name="channel_count" type="number" min={1} value={form.channel_count} onChange={handleChange} placeholder="e.g. 5" className={inputCls} />
                                    </Field>
                                    <Field label="Negative Threshold">
                                        <input name="negative_threshold" type="number" max={0} value={form.negative_threshold} onChange={handleChange} placeholder="e.g. -500" className={inputCls} />
                                    </Field>
                                    <Field label="Phone">
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91XXXXXXXXXX" className={`${inputCls} pl-9`} />
                                        </div>
                                    </Field>
                                    <Field label="New Password (leave blank to keep)">
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
                                        <input name="wallet_balance" type="number" min={0} value={form.wallet_balance} onChange={handleChange} placeholder="Amount to top-up" className={inputCls} />
                                    </Field>
                                    <Field label="Pulse Seconds (Limited plan)">
                                        <input name="pulse_seconds" type="number" min={1} value={form.pulse_seconds} onChange={handleChange} placeholder="e.g. 60" className={inputCls} />
                                    </Field>
                                    <Field label="Inbound Rate (Limited plan)">
                                        <input name="inbound_rate" type="number" step="0.01" min={0} value={form.inbound_rate} onChange={handleChange} placeholder="e.g. 0.50" className={inputCls} />
                                    </Field>
                                    <Field label="Outbound Rate (Limited plan)">
                                        <input name="outbound_rate" type="number" step="0.01" min={0} value={form.outbound_rate} onChange={handleChange} placeholder="e.g. 0.80" className={inputCls} />
                                    </Field>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <button type="button" onClick={() => { setShowEdit(false); setSelected(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceLinkResellerPage;
