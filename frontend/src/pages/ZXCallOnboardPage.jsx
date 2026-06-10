import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import {
    PhoneCall, FileText, Users, Network, UserPlus,
    Upload, CheckCircle2, ChevronRight, ChevronLeft,
    Loader2, AlertCircle, X, CreditCard, Clock, ShieldCheck,
} from "lucide-react";

const STEPS = [
    { key: "docs",     label: "Certificates",  Icon: FileText   },
    { key: "capacity", label: "Capacity",      Icon: Network    },
    { key: "payment",  label: "Payment",       Icon: CreditCard },
];

// ── Pricing (mirrors backend zxcallController) ───────────────────────────────
const PRICE_PER_CHANNEL = 1500;
const PRICE_PER_AGENT   = 400;
const GST_RATE          = 0.18;

const computePricing = (channels, agents) => {
    const ch = Math.max(0, Number(channels) || 0);
    const ag = Math.max(0, Number(agents) || 0);
    const base = ch * PRICE_PER_CHANNEL + ag * PRICE_PER_AGENT;
    const gst = Math.round(base * GST_RATE * 100) / 100;
    const total = Math.round((base + gst) * 100) / 100;
    return { base, gst, total };
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const EMPTY_FORM = {
    gstNumber: "",
    gstCertificate: null,
    incorporationCertificate: null,
    aadharCard: null,
    agents: "",
    channels: "",
    users: "",
};

const MAX_FILE_MB = 5;
const REQ_STORAGE_KEY = "zxcall_request_id";
const DRAFT_KEY = "zxcall_draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Text fields only — File objects can't be serialized to localStorage
const draftFields = (f) => ({
    gstNumber: f.gstNumber, agents: f.agents, channels: f.channels, users: f.users,
});

const loadCashfreeScript = () =>
    new Promise((resolve, reject) => {
        if (window.Cashfree) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
        document.head.appendChild(s);
    });

// ── File upload field ─────────────────────────────────────────────────────────
function FileField({ label, hint, file, onChange, accept }) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">{label}</label>
            {file ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50">
                    <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-emerald-800 truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => onChange(null)}
                        className="text-emerald-700 hover:text-emerald-900 flex-shrink-0">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                    <Upload className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-500">{hint || "Upload file"}</span>
                    <input
                        type="file"
                        accept={accept}
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onChange(f);
                            e.target.value = "";
                        }}
                    />
                </label>
            )}
        </div>
    );
}

// ── Text input field ──────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text", required }) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
            />
        </div>
    );
}

// ── Unlock / status screen ────────────────────────────────────────────────────
const SLA_HOURS = 48;
const remainingHours = (paidAt) => {
    if (!paidAt) return SLA_HOURS;
    const elapsedMs = Date.now() - new Date(paidAt).getTime();
    const left = Math.ceil((SLA_HOURS * 3600 * 1000 - elapsedMs) / (3600 * 1000));
    return Math.max(0, left);
};

function UnlockScreen({ status, paidAt, navigate }) {
    const active = status === "ACTIVE";
    const hoursLeft = remainingHours(paidAt);
    const timeText = hoursLeft > 0
        ? `within ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`
        : "very shortly";
    return (
        <div className="max-w-xl mx-auto py-16 text-center">
            <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${active ? "bg-emerald-50" : "bg-indigo-50"}`}>
                {active ? <ShieldCheck className="h-9 w-9 text-emerald-600" /> : <Clock className="h-9 w-9 text-indigo-600" />}
            </div>
            <h1 className="text-2xl font-black text-gray-900">
                {active ? "ZX Call is Active" : "Payment Received"}
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-2 max-w-md mx-auto">
                {active
                    ? "Your ZX Call click-to-call account has been provisioned and is ready to use."
                    : `Thank you! Your payment was successful. We'll unlock your ZX Call account ${timeText} and notify you once it's live.`}
            </p>
            <button
                onClick={() => navigate("/dashboard")}
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl transition-colors"
            >
                Back to Dashboard
            </button>
        </div>
    );
}

export default function ZXCallOnboardPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [stepIdx, setStepIdx] = useState(0);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [unlock, setUnlock] = useState(null); // { status: "PAID" | "ACTIVE", paidAt }

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const setFile = (k) => (f) => {
        if (f && f.size > MAX_FILE_MB * 1024 * 1024) { setError(`File must be under ${MAX_FILE_MB} MB.`); return; }
        setError("");
        set(k, f);
    };

    const pricing = computePricing(form.channels, form.agents);
    const addMode = searchParams.get("add") === "1";

    // On mount: handle Cashfree return, otherwise check existing request status
    useEffect(() => {
        const orderId = searchParams.get("order_id");
        if (orderId) {
            window.history.replaceState({}, "", "/zxcall/onboard");
            (async () => {
                try {
                    const { data } = await api.post("/zxcall/verify", { orderId });
                    if (data.success) {
                        sessionStorage.removeItem(REQ_STORAGE_KEY);
                        localStorage.removeItem(DRAFT_KEY);
                        setUnlock({ status: data.status === "ACTIVE" ? "ACTIVE" : "PAID", paidAt: data.paidAt });
                    } else {
                        setError(`Payment not completed (${data.status || "PENDING"}). Please try again.`);
                    }
                } catch {
                    setError("Could not verify payment. If you were charged, please contact support.");
                } finally {
                    setLoadingStatus(false);
                }
            })();
            return;
        }
        // ?add=1 → buying more seats/capacity even though a request is already active
        const addMode = searchParams.get("add") === "1";

        (async () => {
            try {
                const { data } = await api.get("/zxcall/my");
                const st = data?.request?.status;
                // In add-mode, never short-circuit to the unlock/active screen —
                // let the user start a fresh top-up request.
                if (!addMode && (st === "PAID" || st === "ACTIVE")) {
                    localStorage.removeItem(DRAFT_KEY);
                    setUnlock({ status: st, paidAt: data.request.paidAt });
                    return;
                }
            } catch { /* no-op */ }
            finally { setLoadingStatus(false); }

            // Restore any saved draft (text fields) so a reload doesn't wipe input
            try {
                const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
                if (draft?.savedAt && Date.now() - draft.savedAt < DRAFT_TTL_MS) {
                    setForm((p) => ({ ...p, ...draft.form }));
                } else if (draft) {
                    localStorage.removeItem(DRAFT_KEY); // older than 7 days — start fresh
                }
            } catch { /* no-op */ }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist text fields as the user types (keeps the original timestamp for TTL)
    useEffect(() => {
        const fields = draftFields(form);
        if (!Object.values(fields).some((v) => v)) return;
        let savedAt = Date.now();
        try {
            const existing = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
            if (existing?.savedAt) savedAt = existing.savedAt;
        } catch { /* no-op */ }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: fields, savedAt }));
    }, [form]);

    const validateStep = () => {
        const step = STEPS[stepIdx].key;
        if (step === "docs") {
            if (!form.gstNumber.trim()) return "Company GST number is required.";
            if (!form.gstCertificate) return "Company GST certificate is required.";
            if (!form.incorporationCertificate) return "Certificate of Incorporation / MSME is required.";
            if (!form.aadharCard) return "Authorised person's Aadhar card is required.";
        }
        if (step === "capacity") {
            if (!form.agents || Number(form.agents) < 1) return "Enter the number of agents.";
            if (!form.channels || Number(form.channels) < 1) return "Enter the number of channels.";
            if (!form.users || Number(form.users) < 1) return "Enter the number of users.";
        }
        return "";
    };

    const next = () => {
        const msg = validateStep();
        if (msg) { setError(msg); return; }
        setError("");
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    };

    const back = () => {
        setError("");
        if (stepIdx === 0) { navigate("/dashboard"); return; }
        setStepIdx((i) => Math.max(i - 1, 0));
    };

    // Submit onboarding (files), create order, redirect to Cashfree
    const handlePay = async () => {
        setError("");
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("gstNumber", form.gstNumber);
            fd.append("agents", form.agents);
            fd.append("channels", form.channels);
            fd.append("users", form.users);
            fd.append("gstCertificate", form.gstCertificate);
            fd.append("incorporationCertificate", form.incorporationCertificate);
            fd.append("aadharCard", form.aadharCard);

            const onboardRes = await api.post("/zxcall/onboard", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const requestId = onboardRes.data.requestId;

            const returnUrl = `${window.location.origin}/zxcall/onboard`;
            const orderRes = await api.post("/zxcall/create-order", { requestId, returnUrl });
            const { payment_session_id, mode } = orderRes.data;

            sessionStorage.setItem(REQ_STORAGE_KEY, requestId);
            await loadCashfreeScript();
            const cashfree = window.Cashfree({ mode: mode || "sandbox" });
            cashfree.checkout({ paymentSessionId: payment_session_id });
        } catch (err) {
            sessionStorage.removeItem(REQ_STORAGE_KEY);
            setError(err?.response?.data?.message || "Failed to start payment. Please try again.");
            setSubmitting(false);
        }
    };

    if (loadingStatus) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (unlock) return <UnlockScreen status={unlock.status} paidAt={unlock.paidAt} navigate={navigate} />;

    const step = STEPS[stepIdx].key;

    return (
        <div className="max-w-2xl mx-auto pb-16">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <PhoneCall className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-gray-900 leading-tight">{addMode ? "Add ZX Call Capacity" : "ZX Call Setup"}</h1>
                    <p className="text-xs text-gray-500 font-medium">{addMode ? "Buy more channels / agents / user seats" : "Click-to-call onboarding"}</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center mb-7">
                {STEPS.map((s, i) => {
                    const active = i === stepIdx;
                    const complete = i < stepIdx;
                    return (
                        <div key={s.key} className="flex items-center flex-1 last:flex-none">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                    complete ? "bg-emerald-500 text-white"
                                    : active ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 text-gray-400"}`}>
                                    {complete ? <CheckCircle2 className="h-4 w-4" /> : <s.Icon className="h-4 w-4" />}
                                </div>
                                <span className={`text-xs font-bold hidden sm:block ${
                                    active ? "text-indigo-700" : complete ? "text-emerald-600" : "text-gray-400"}`}>
                                    {s.label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-3 rounded ${complete ? "bg-emerald-400" : "bg-gray-100"}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                {error && (
                    <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex gap-2 items-start">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
                    </div>
                )}

                {/* Step 1 — Certificates */}
                {step === "docs" && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 font-medium">
                            Upload your business verification documents. PDF, JPG or PNG, up to {MAX_FILE_MB} MB each.
                        </p>
                        <Field label="Company GST Number" value={form.gstNumber} onChange={(v) => set("gstNumber", v)}
                            placeholder="22AAAAA0000A1Z5" required />
                        <FileField label="Company GST Certificate" hint="Upload GST certificate"
                            file={form.gstCertificate} onChange={setFile("gstCertificate")}
                            accept=".pdf,.jpg,.jpeg,.png" />
                        <FileField label="Certificate of Incorporation / MSME" hint="Upload incorporation or MSME certificate"
                            file={form.incorporationCertificate} onChange={setFile("incorporationCertificate")}
                            accept=".pdf,.jpg,.jpeg,.png" />
                        <FileField label="Authorised Person's Aadhar Card" hint="Upload Aadhar card"
                            file={form.aadharCard} onChange={setFile("aadharCard")}
                            accept=".pdf,.jpg,.jpeg,.png" />
                    </div>
                )}

                {/* Step 2 — Capacity */}
                {step === "capacity" && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 font-medium">
                            Configure how many agents and concurrent channels you need.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Number of Agents <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input type="number" min="1" value={form.agents}
                                        onChange={(e) => set("agents", e.target.value)} placeholder="5"
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition" />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">{fmt(PRICE_PER_AGENT)} + GST per agent</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Number of Channels <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Network className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input type="number" min="1" value={form.channels}
                                        onChange={(e) => set("channels", e.target.value)} placeholder="2"
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition" />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">{fmt(PRICE_PER_CHANNEL)} + GST per channel</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Number of Users <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input type="number" min="1" value={form.users}
                                        onChange={(e) => set("users", e.target.value)} placeholder="5"
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition" />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Max C2C users you can create</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4 — Payment */}
                {step === "payment" && (
                    <div className="space-y-5">
                        <p className="text-sm text-gray-500 font-medium">Review your order and proceed to secure payment.</p>

                        <div className="rounded-xl border border-gray-150 bg-gray-50 divide-y divide-gray-200">
                            <Row label={`Channels (${form.channels} × ${fmt(PRICE_PER_CHANNEL)})`}
                                value={fmt(Number(form.channels) * PRICE_PER_CHANNEL)} />
                            <Row label={`Agents (${form.agents} × ${fmt(PRICE_PER_AGENT)})`}
                                value={fmt(Number(form.agents) * PRICE_PER_AGENT)} />
                            <Row label="Subtotal" value={fmt(pricing.base)} />
                            <Row label="GST (18%)" value={fmt(pricing.gst)} />
                            <Row label="Total payable" value={fmt(pricing.total)} bold />
                        </div>

                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                            Includes <span className="font-bold text-gray-700">{form.users}</span> C2C user license{Number(form.users) === 1 ? "" : "s"}.
                        </p>

                        <div className="flex gap-2 items-start p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium">
                            <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            After successful payment, your ZX Call account will be unlocked within 48 hours.
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-100">
                    <button onClick={back} disabled={submitting}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                        {stepIdx === 0 ? "Cancel" : "Back"}
                    </button>
                    {step === "payment" ? (
                        <button onClick={handlePay} disabled={submitting}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 py-2.5 rounded-xl transition-colors">
                            {submitting
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                                : <>Pay {fmt(pricing.total)} <CreditCard className="h-4 w-4" /></>}
                        </button>
                    ) : (
                        <button onClick={next}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl transition-colors">
                            Continue <ChevronRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, bold }) {
    return (
        <div className="flex items-center justify-between px-4 py-3">
            <span className={`text-sm ${bold ? "font-black text-gray-900" : "font-medium text-gray-600"}`}>{label}</span>
            <span className={`text-sm tabular-nums ${bold ? "font-black text-indigo-700" : "font-semibold text-gray-800"}`}>{value}</span>
        </div>
    );
}
