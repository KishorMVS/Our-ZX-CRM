import { CreditCard, CheckCircle2, Users, Zap, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PLAN_FEATURES = [
    "Unlimited leads & contacts",
    "AI voice agent (ZenVoice)",
    "Call analytics & CDR",
    "Sprint & kanban boards",
    "Attendance & leave management",
    "Custom roles & permissions",
    "Email & SMS integrations",
    "Priority support",
];

export default function Subscription() {
    const { user } = useAuth();

    return (
        <div className="pb-16 space-y-8 max-w-3xl">
            <div>
                <h1 className="text-2xl font-black text-gray-950 tracking-tight">Subscription & Billing</h1>
                <p className="text-sm text-gray-400 font-medium mt-1">
                    Manage your workspace plan, seats, and payment history.
                </p>
            </div>

            {/* Current plan */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Current Plan</p>
                        <h2 className="text-2xl font-black">Professional</h2>
                        <p className="text-sm text-indigo-200 mt-1">Active workspace · {user?.workspaceId?.slice(0, 8)}</p>
                    </div>
                    <div className="bg-white/20 rounded-xl px-4 py-2 text-sm font-black">ACTIVE</div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                    {[
                        { icon: Users, label: "Seats", value: "Unlimited" },
                        { icon: Zap,   label: "AI Calls", value: "Enabled" },
                        { icon: Shield, label: "Support", value: "Priority" },
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="bg-white/10 rounded-xl p-3">
                            <Icon className="h-4 w-4 text-indigo-200 mb-1.5" />
                            <p className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wide">{label}</p>
                            <p className="text-sm font-black text-white">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Features included */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-900">What's included</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PLAN_FEATURES.map(f => (
                        <div key={f} className="flex items-center gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700 font-medium">{f}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment action */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900">Renew or Upgrade</p>
                        <p className="text-xs text-gray-400 font-medium">Contact support to change your plan or renew your subscription</p>
                    </div>
                </div>
                <a
                    href="mailto:support@zenxai.io?subject=Subscription%20Renewal"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
                >
                    Contact Support
                </a>
            </div>
        </div>
    );
}
