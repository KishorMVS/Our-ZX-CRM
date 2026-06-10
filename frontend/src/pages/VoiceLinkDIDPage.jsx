import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    CheckCircle, Loader2, ArrowLeft, AlertCircle,
    PhoneCall, CreditCard, ArrowRight,
} from "lucide-react";
import api from "../api/axios";
import { useVoiceLink } from "../context/VoiceLinkContext";

const CHANNEL_PRICE = 900;
const DID_PRICE     = 200;

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

const STEPS = [
    { key: "form",    label: "Client Details" },
    { key: "payment", label: "Payment"        },
    { key: "success", label: "Complete"       },
];

const BuyDIDPage = () => {
    const navigate = useNavigate();
    const { refresh: refreshVL } = useVoiceLink() || {};

    const [step, setStep] = useState("form");
    const [form, setForm] = useState({
        first_name: "", last_name: "", username: "", email: "",
        password: "", channel_count: "", negative_threshold: "", plan_type: "",
    });
    const [error, setError]         = useState("");
    const [payLoading, setPayLoad]  = useState(false);
    const [creating, setCreating]   = useState(false);
    const [createdId, setCreatedId] = useState(null);

    const channelCount = Number(form.channel_count) || 0;
    const channelCost  = channelCount * CHANNEL_PRICE;
    const didCost      = channelCount * DID_PRICE;
    const total        = channelCost + didCost;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setError("");
        if (Number(form.channel_count) < 1) { setError("Channel Count must be at least 1."); return; }
        if (Number(form.negative_threshold) > 0) { setError("Negative Threshold must be 0 or less."); return; }
        setStep("payment");
    };

    const handlePayment = async () => {
        setError("");
        setPayLoad(true);
        // Simulate payment gateway delay
        await new Promise(r => setTimeout(r, 2000));
        setPayLoad(false);

        // Create client on backend
        setCreating(true);
        try {
            const res = await api.post("/voicelink/client/create", {
                first_name:         form.first_name,
                last_name:          form.last_name,
                username:           form.username,
                email:              form.email,
                password:           form.password,
                channel_count:      Number(form.channel_count),
                negative_threshold: Number(form.negative_threshold),
                plan_type:          form.plan_type,
            });
            const id = res.data?.client_id ?? res.data?.data?.client_id;
            setCreatedId(id);
            refreshVL?.();
            setStep("success");
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to create VoiceLink client. Please try again.");
            setStep("payment");
        } finally {
            setCreating(false);
        }
    };

    // Step progress visual index
    const visualIdx = step === "success" ? 2 : step === "payment" ? 1 : 0;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate("/dashboard")}
                    className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Buy DID Number</h1>
                    <p className="text-sm text-gray-500">Provision a Cloud Dialer DID via VoiceLink</p>
                </div>
            </div>

            {/* Step progress */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
                <div className="flex items-center">
                    {STEPS.map((s, i) => {
                        const isDone   = visualIdx > i;
                        const isActive = visualIdx === i;
                        return (
                            <div key={s.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                                        ${isDone   ? "bg-indigo-600 text-white" :
                                          isActive ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                                                     "bg-gray-100 text-gray-400"}`}>
                                        {isDone ? <CheckCircle className="h-4 w-4" /> : i + 1}
                                    </div>
                                    <span className={`text-[11px] font-medium ${isDone || isActive ? "text-indigo-600" : "text-gray-400"}`}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-4 ${isDone ? "bg-indigo-600" : "bg-gray-200"}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step content */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                {error && (
                    <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ── Step 1: Client Details form ── */}
                {step === "form" && (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div className="flex items-center gap-2 mb-1">
                            <PhoneCall className="h-5 w-5 text-indigo-600" />
                            <h2 className="text-base font-semibold text-gray-900">Client Details</h2>
                        </div>

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
                            <Field label="Password" required>
                                <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} className={inputCls} />
                            </Field>
                            <Field label="Channel Count" required>
                                <input
                                    name="channel_count" type="number" min={1}
                                    value={form.channel_count} onChange={handleChange}
                                    required placeholder="e.g. 5" className={inputCls}
                                />
                            </Field>
                            <Field label="Negative Threshold" required>
                                <input
                                    name="negative_threshold" type="number" max={0}
                                    value={form.negative_threshold} onChange={handleChange}
                                    required placeholder="e.g. -100" className={inputCls}
                                />
                            </Field>
                            <Field label="Plan Type" required>
                                <select name="plan_type" value={form.plan_type} onChange={handleChange} required className={`${inputCls} bg-white`}>
                                    <option value="">Select plan</option>
                                    <option value="unlimited">Unlimited</option>
                                    <option value="prepaid">Prepaid</option>
                                </select>
                            </Field>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-gray-100">
                            <button type="submit" className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                                Continue to Payment <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Step 2: Payment ── */}
                {step === "payment" && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-indigo-600" />
                            <h2 className="text-base font-semibold text-gray-900">Payment Summary</h2>
                        </div>

                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Item</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Qty</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Rate</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="px-4 py-3 text-gray-800">Channels</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{channelCount}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">₹{CHANNEL_PRICE}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">₹{channelCost.toLocaleString("en-IN")}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-gray-800">DID Numbers</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{channelCount}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">₹{DID_PRICE}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">₹{didCost.toLocaleString("en-IN")}</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-indigo-50">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-sm font-bold text-indigo-800">Total</td>
                                        <td className="px-4 py-3 text-right text-base font-bold text-indigo-800">₹{total.toLocaleString("en-IN")}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                            <p className="font-semibold mb-0.5">Demo Payment Mode</p>
                            <p className="text-xs text-amber-700">No actual charge will be made. Click below to simulate payment and provision your DID.</p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <button
                                onClick={() => setStep("form")}
                                className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
                            >
                                Back
                            </button>
                            <button
                                onClick={handlePayment}
                                disabled={payLoading || creating}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                            >
                                {(payLoading || creating) && <Loader2 className="h-4 w-4 animate-spin" />}
                                {payLoading  ? "Processing Payment..."  :
                                 creating    ? "Creating Client..."     :
                                 `Pay ₹${total.toLocaleString("en-IN")} & Continue`}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Success ── */}
                {step === "success" && (
                    <div className="text-center space-y-5 py-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Payment Successful!</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                VoiceLink client created
                                {createdId && <span> — Client ID: <span className="font-mono font-semibold text-indigo-600">{createdId}</span></span>}.
                            </p>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 text-left">
                            <p className="font-semibold mb-1">Next Steps</p>
                            <p className="text-xs text-blue-700">
                                Complete KYC verification in the DID Numbers section to unlock DID selection and assignment.
                            </p>
                        </div>

                        <button
                            onClick={() => navigate("/voicelink/numbers")}
                            className="flex items-center gap-2 mx-auto px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Go to DID Numbers <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuyDIDPage;
