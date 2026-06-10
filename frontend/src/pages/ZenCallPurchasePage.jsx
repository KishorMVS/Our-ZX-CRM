import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Bot, Star, User, KeyRound, Hash, Loader2, AlertCircle,
    CheckCircle, ArrowLeft, CreditCard, ChevronRight, Zap,
} from "lucide-react";
import api from "../api/axios";
import { useVoiceLink } from "../context/VoiceLinkContext";

const HARDCODED_EMAIL = "kishor@hexitetechnologies.com";

const PLANS = [
    {
        key:         "junior",
        name:        "Junior Agent",
        amount:      25000,
        Icon:        Bot,
        description: "Ideal for small teams getting started with AI voice.",
        features:    ["AI-powered voice calls", "CRM integration", "Basic analytics", "Email support"],
    },
    {
        key:         "senior",
        name:        "Senior Agent",
        amount:      40000,
        Icon:        Star,
        description: "For high-volume teams that need advanced capabilities.",
        features:    ["Advanced AI voice", "Deep analytics", "Custom call scripts", "Priority support"],
    },
];

const FORM_STORAGE_KEY = "zenvoice_purchase_form";

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const Field = ({ label, required, hint, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
);

const EMPTY_FORM = {
    first_name: "", last_name: "", username: "", password: "", channel_count: "",
};

const WIZARD_STEPS = [
    { key: "agent",  label: "Select Agent"  },
    { key: "form",   label: "Account Setup" },
    { key: "paying", label: "Payment"       },
];

const loadCashfreeScript = () =>
    new Promise((resolve, reject) => {
        if (window.Cashfree) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        s.onload  = resolve;
        s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
        document.head.appendChild(s);
    });

const ZenVoicePurchasePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refresh } = useVoiceLink() || {};

    // step: "agent" | "form" | "paying" | "verifying" | "done"
    const [step, setStep]             = useState("agent");
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [showPass, setShowPass]     = useState(false);
    const [error, setError]           = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [donePlan, setDonePlan]     = useState(null);

    // ── On mount: handle return from Cashfree (URL has ?order_id=...) ──────────
    useEffect(() => {
        const orderId = searchParams.get("order_id");
        if (!orderId) return;

        // Clean the URL so back-button doesn't re-trigger
        window.history.replaceState({}, "", "/zenvoice/purchase");

        const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
        if (!saved) {
            setError("Session expired. Please restart the purchase.");
            return;
        }

        const { form: savedForm, plan: savedPlan } = JSON.parse(saved);
        setForm(savedForm);
        setSelectedPlan(savedPlan);
        setStep("verifying");

        (async () => {
            try {
                const verifyRes = await api.post("/payments/verify", { orderId });
                if (!verifyRes.data.success) {
                    setError(`Payment not completed (${verifyRes.data.status || "PENDING"}). Please try again.`);
                    setStep("form");
                    return;
                }

                await api.post("/voicelink/self-signup", {
                    first_name:    savedForm.first_name,
                    last_name:     savedForm.last_name,
                    username:      savedForm.username,
                    password:      savedForm.password,
                    channel_count: Number(savedForm.channel_count),
                    plan_type:     "unlimited",
                    email:         HARDCODED_EMAIL,
                });

                sessionStorage.removeItem(FORM_STORAGE_KEY);
                setDonePlan(savedPlan);
                await refresh?.();
                setStep("done");
            } catch (err) {
                setError(err?.response?.data?.message || "Activation failed. Please contact support with your order ID: " + orderId);
                setStep("form");
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Initiate Cashfree payment ─────────────────────────────────────────────
    const handleInitiatePayment = async () => {
        setError(""); setSubmitting(true);
        try {
            const returnUrl = `${window.location.origin}/zenvoice/purchase?order_id={order_id}`;

            const res = await api.post("/payments/create-order", {
                plan:          selectedPlan.key,
                customerPhone: "9999999999",
                returnUrl,
            });

            const { payment_session_id, mode } = res.data;

            // Persist form before redirect
            sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({ form, plan: selectedPlan }));

            await loadCashfreeScript();
            const cashfree = window.Cashfree({ mode: mode || "sandbox" });
            cashfree.checkout({ paymentSessionId: payment_session_id });
            // Page redirects — no further code runs
        } catch (err) {
            sessionStorage.removeItem(FORM_STORAGE_KEY);
            setError(err?.response?.data?.message || "Failed to initiate payment. Please try again.");
            setSubmitting(false);
        }
    };

    // ── Step index helper ─────────────────────────────────────────────────────
    const stepIdx = WIZARD_STEPS.findIndex(s =>
        s.key === step || (step === "verifying" && s.key === "paying")
    );

    // ── Verifying state ───────────────────────────────────────────────────────
    if (step === "verifying") {
        return (
            <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Verifying Payment…</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Please wait while we confirm your payment and activate your AI voice agent.
                    </p>
                </div>
                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start text-left">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
                    </div>
                )}
            </div>
        );
    }

    // ── Done state ────────────────────────────────────────────────────────────
    if (step === "done") {
        return (
            <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">ZenVoice Activated!</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Your AI voice agent is live. Complete KYC to activate phone numbers.
                    </p>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-left text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Agent</span>
                        <span className="font-medium">{donePlan?.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Username</span>
                        <span className="font-medium">{form.username}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Amount Paid</span>
                        <span className="font-bold text-green-700">
                            ₹{(donePlan?.amount || 0).toLocaleString("en-IN")}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => navigate("/zenvoice")}
                    className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                    Open ZenVoice <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        );
    }

    // ── Main wizard ───────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => {
                        if (step === "paying") { setStep("form"); return; }
                        if (step === "form")   { setStep("agent"); return; }
                        navigate("/dashboard");
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Activate ZenVoice</h1>
                    <p className="text-sm text-gray-500">AI-powered voice agent for your team</p>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {WIZARD_STEPS.map(({ key, label }, i) => {
                    const active = i === stepIdx;
                    const done   = i < stepIdx;
                    return (
                        <div key={key} className="flex items-center gap-2">
                            <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold
                                ${done   ? "bg-indigo-600 text-white" :
                                  active ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                                           "bg-gray-100 text-gray-400"}`}>
                                {done ? "✓" : i + 1}
                            </div>
                            <span className={`text-xs font-medium ${active || done ? "text-indigo-700" : "text-gray-400"}`}>
                                {label}
                            </span>
                            {i < WIZARD_STEPS.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
                        </div>
                    );
                })}
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
                </div>
            )}

            {/* ── Step 1: Agent Selection ── */}
            {step === "agent" && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Choose the AI voice agent that fits your team.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PLANS.map((plan) => {
                            const { Icon } = plan;
                            const isSelected = selectedPlan?.key === plan.key;
                            return (
                                <button
                                    key={plan.key}
                                    type="button"
                                    onClick={() => setSelectedPlan(plan)}
                                    className={`text-left p-5 rounded-xl border-2 transition-all ${
                                        isSelected
                                            ? "border-indigo-500 bg-indigo-50 shadow-md"
                                            : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                                            isSelected ? "bg-indigo-600" : "bg-gray-100"
                                        }`}>
                                            <Icon className={`h-5 w-5 ${isSelected ? "text-white" : "text-gray-500"}`} />
                                        </div>
                                        {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600" />}
                                    </div>
                                    <p className={`text-sm font-bold mb-0.5 ${isSelected ? "text-indigo-900" : "text-gray-900"}`}>
                                        {plan.name}
                                    </p>
                                    <p className={`text-2xl font-black mb-1 ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                                        ₹{plan.amount.toLocaleString("en-IN")}
                                    </p>
                                    <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                                    <ul className="space-y-1">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => selectedPlan && setStep("form")}
                            disabled={!selectedPlan}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Continue <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Account Setup ── */}
            {step === "form" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); setStep("paying"); }}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
                >
                    {/* Selected plan pill */}
                    {selectedPlan && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="flex items-center gap-2">
                                <selectedPlan.Icon className="h-4 w-4 text-indigo-600" />
                                <span className="text-sm font-semibold text-indigo-900">{selectedPlan.name}</span>
                            </div>
                            <span className="text-sm font-bold text-indigo-700">
                                ₹{selectedPlan.amount.toLocaleString("en-IN")}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Account Details</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="First Name" required>
                            <input name="first_name" value={form.first_name}
                                onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                                required className={inputCls} placeholder="Jane" />
                        </Field>
                        <Field label="Last Name" required>
                            <input name="last_name" value={form.last_name}
                                onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                                required className={inputCls} placeholder="Smith" />
                        </Field>
                        <Field label="Username" required>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input name="username" value={form.username}
                                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                                    required className={`${inputCls} pl-9`} placeholder="janesmith" />
                            </div>
                        </Field>
                        <Field label="Password" required>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input name="password" type={showPass ? "text" : "password"}
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    required minLength={8} className={`${inputCls} pl-9 pr-20`} placeholder="Min 8 chars" />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-600 font-medium hover:text-indigo-800">
                                    {showPass ? "Hide" : "Show"}
                                </button>
                            </div>
                        </Field>
                        <Field label="Number of Channels" required hint="Concurrent calls your team can make">
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input name="channel_count" type="number" min={1} value={form.channel_count}
                                    onChange={e => setForm(p => ({ ...p, channel_count: e.target.value }))}
                                    required className={`${inputCls} pl-9`} placeholder="e.g. 5" />
                            </div>
                        </Field>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-100">
                        <button type="submit"
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                            Proceed to Payment <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </form>
            )}

            {/* ── Step 3: Payment Summary & Cashfree ── */}
            {step === "paying" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Order Summary</h2>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Agent</span>
                            <span className="font-medium text-gray-900">{selectedPlan?.name}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Name</span>
                            <span className="font-medium text-gray-900">{form.first_name} {form.last_name}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Username</span>
                            <span className="font-mono text-gray-900">{form.username}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Channels</span>
                            <span className="font-medium text-gray-900">{form.channel_count}</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2.5 flex justify-between font-bold text-indigo-900 text-base">
                            <span>Total</span>
                            <span>₹{(selectedPlan?.amount || 0).toLocaleString("en-IN")}</span>
                        </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                        <Zap className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                            You will be redirected to Cashfree's secure payment page.
                            Do not close or refresh the browser during payment.
                        </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button onClick={() => { setError(""); setStep("form"); }}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <button onClick={handleInitiatePayment} disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                            {submitting
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                                : <><CreditCard className="h-4 w-4" /> Pay ₹{(selectedPlan?.amount || 0).toLocaleString("en-IN")}</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZenVoicePurchasePage;
