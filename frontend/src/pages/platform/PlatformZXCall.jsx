import { useEffect, useState, useCallback } from "react";
import { getZXCallRequests, activateZXCallRequest, fileUrl } from "../../api/platform";
import {
    PhoneCall, Loader2, RefreshCw, CheckCircle2, Clock, Mail, MapPin,
    Building2, FileText, Users, Network, Receipt, ExternalLink, KeyRound, X, AlertTriangle,
} from "lucide-react";

const SLA_MS = 48 * 60 * 60 * 1000; // 48 hours
const isOverdue = (r) =>
    r.status === "PAID" && r.paidAt && Date.now() - new Date(r.paidAt).getTime() > SLA_MS;
const hoursSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / (60 * 60 * 1000));

const EMPTY_CREDS = { appId: "", secretKey: "", didNumber: "" };
const CRED_FIELDS = [
    { key: "appId",       label: "App ID",     placeholder: "e.g. 33338120" },
    { key: "secretKey",   label: "Secret Key", placeholder: "SIP password" },
    { key: "didNumber",   label: "DID Number", placeholder: "e.g. 04471XXXXXX" },
];

const STATUS = {
    PENDING_PAYMENT: { label: "Awaiting payment", cls: "bg-slate-700 text-slate-300" },
    PAID:            { label: "Paid · provision pending", cls: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20" },
    ACTIVE:          { label: "Active", cls: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" },
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const DocLink = ({ label, path }) =>
    path ? (
        <a href={fileUrl(path)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300">
            <FileText className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3" />
        </a>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><FileText className="h-3.5 w-3.5" /> {label} — none</span>
    );

const Detail = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
            <p className="text-xs text-slate-200 font-medium break-words">{value || "—"}</p>
        </div>
    </div>
);

export default function PlatformZXCall() {
    const [requests, setRequests] = useState([]);
    const [pendingProvision, setPendingProvision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(null);
    const [openId, setOpenId] = useState(null);     // request showing the provision form
    const [creds, setCreds] = useState(EMPTY_CREDS);
    const [formError, setFormError] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        getZXCallRequests()
            .then((d) => { setRequests(d.requests || []); setPendingProvision(d.pendingProvision || 0); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openForm = (id) => { setOpenId(id); setCreds(EMPTY_CREDS); setFormError(""); };
    const closeForm = () => { setOpenId(null); setCreds(EMPTY_CREDS); setFormError(""); };

    const activate = async (id) => {
        if (Object.values(creds).some((v) => !v.trim())) {
            setFormError("All fields are required.");
            return;
        }
        setFormError("");
        setActivating(id);
        try {
            await activateZXCallRequest(id, creds);
            closeForm();
            load();
        } catch (err) {
            setFormError(err?.response?.data?.message || "Failed to activate.");
        } finally {
            setActivating(null);
        }
    };

    const overdueCount = requests.filter(isOverdue).length;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                        <PhoneCall className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">ZX Call Requests</h1>
                        <p className="text-xs text-slate-400">Click-to-call onboarding & provisioning</p>
                    </div>
                </div>
                <button onClick={load}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
            </div>

            {/* Overdue (>48h) warning banner */}
            {overdueCount > 0 && (
                <div className="mb-3 flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/30 text-rose-300">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 animate-pulse" />
                    <p className="text-sm font-semibold">
                        {overdueCount} request{overdueCount > 1 ? "s have" : " has"} exceeded the 48-hour provisioning window — activate {overdueCount > 1 ? "them" : "it"} now.
                    </p>
                </div>
            )}

            {/* Provision-pending banner (notification surface) */}
            {pendingProvision > 0 && (
                <div className="mb-6 flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-300">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm font-medium">
                        {pendingProvision} paid request{pendingProvision > 1 ? "s" : ""} awaiting provisioning (unlock within 48 hours).
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                </div>
            ) : requests.length === 0 ? (
                <div className="py-24 text-center">
                    <PhoneCall className="h-10 w-10 mx-auto mb-3 text-slate-700" />
                    <p className="text-sm text-slate-400 font-medium">No ZX Call requests yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((r) => {
                        const st = STATUS[r.status] || STATUS.PENDING_PAYMENT;
                        const overdue = isOverdue(r);
                        return (
                            <div key={r.id} className={`bg-slate-900 border rounded-2xl p-5 ${overdue ? "border-rose-500/40 ring-1 ring-rose-500/20" : "border-slate-800"}`}>
                                {/* Top row */}
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-white">{r.company?.name}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Requested {new Date(r.createdAt).toLocaleString("en-IN")}
                                            {r.paidAt && ` · Paid ${new Date(r.paidAt).toLocaleDateString("en-IN")}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {overdue && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 whitespace-nowrap">
                                                <AlertTriangle className="h-3 w-3 animate-pulse" /> Overdue · {hoursSince(r.paidAt)}h
                                            </span>
                                        )}
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.cls}`}>
                                            {st.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Company creation details */}
                                <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-2">Company (from account)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    <Detail icon={Building2} label="Company name" value={r.company?.name} />
                                    <Detail icon={Mail} label="Company email" value={r.company?.email} />
                                    <Detail icon={MapPin} label="Company address" value={r.company?.address} />
                                </div>

                                {/* Submitted onboarding details */}
                                <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-2">Onboarding submission</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <Detail icon={Receipt} label="GST number" value={r.gstNumber} />
                                    <Detail icon={Users} label="Contact" value={`${r.contactName} · ${r.phone}`} />
                                    <Detail icon={Users} label="Agents" value={r.agents} />
                                    <Detail icon={Network} label="Channels" value={r.channels} />
                                    <Detail icon={Users} label="User licenses" value={r.userLimit} />
                                </div>

                                {/* Documents + pricing */}
                                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                                    <div className="flex flex-wrap gap-4">
                                        <DocLink label="GST cert" path={r.gstCertificate} />
                                        <DocLink label="Incorporation/MSME" path={r.incorporationCertificate} />
                                        <DocLink label="Aadhar" path={r.aadharCard} />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Total paid</p>
                                            <p className="text-sm font-black text-white">{fmt(r.totalAmount)}<span className="text-[10px] text-slate-500 font-medium"> incl. GST</span></p>
                                        </div>
                                        {r.status === "PAID" && openId !== r.id && (
                                            <button onClick={() => openForm(r.id)}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors">
                                                <CheckCircle2 className="h-3.5 w-3.5" /> Provision & activate
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Provisioning form (shown after clicking Provision & activate) */}
                                {r.status === "PAID" && openId === r.id && (
                                    <div className="mt-4 pt-4 border-t border-slate-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                                <KeyRound className="h-3.5 w-3.5" /> Provisioning credentials
                                            </p>
                                            <button onClick={closeForm} className="text-slate-500 hover:text-slate-300">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {CRED_FIELDS.map((f) => (
                                                <div key={f.key}>
                                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">{f.label}</label>
                                                    <input
                                                        value={creds[f.key]}
                                                        onChange={(e) => setCreds((p) => ({ ...p, [f.key]: e.target.value }))}
                                                        placeholder={f.placeholder}
                                                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        {formError && <p className="text-xs text-rose-400 font-medium mt-2">{formError}</p>}
                                        <div className="flex justify-end mt-3">
                                            <button onClick={() => activate(r.id)} disabled={activating === r.id}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
                                                {activating === r.id
                                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Activating…</>
                                                    : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate account</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Assigned credentials (after activation) */}
                                {r.status === "ACTIVE" && (r.appId || r.didNumber) && (
                                    <div className="mt-4 pt-4 border-t border-slate-800">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5 mb-2">
                                            <KeyRound className="h-3.5 w-3.5" /> Assigned credentials
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <Detail icon={KeyRound} label="App ID" value={r.appId} />
                                            <Detail icon={KeyRound} label="Secret Key" value={r.secretKey} />
                                            <Detail icon={Network} label="DID Number" value={r.didNumber} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
