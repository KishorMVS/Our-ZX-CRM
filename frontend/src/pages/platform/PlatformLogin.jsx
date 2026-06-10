import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePlatformAuth } from "../../context/PlatformAuthContext";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Lock, Mail, Loader2, Eye, EyeOff, Shield, BarChart2, Building2, ArrowLeft } from "lucide-react";

const schema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
});

const FEATURES = [
    { icon: Building2, text: "Monitor all registered companies" },
    { icon: BarChart2, text: "Registration analytics & growth trends" },
    { icon: Shield, text: "Activate or suspend workspaces instantly" },
];

const PlatformLogin = () => {
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login, isAuthenticated } = usePlatformAuth();
    const navigate = useNavigate();

    const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

    // Hooks must run before any conditional return (rules of hooks).
    if (isAuthenticated) return <Navigate to="/platform/dashboard" replace />;

    const onSubmit = async (data) => {
        setLoading(true);
        setError("");
        const result = await login(data.email, data.password);
        setLoading(false);
        if (result.success) {
            navigate("/platform/dashboard");
        } else {
            setError(result.message || "Invalid credentials");
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-950 relative">
            <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 lg:bg-transparent px-3 py-1.5 rounded-lg backdrop-blur-sm lg:backdrop-blur-none">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
            </Link>

            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden">
                {/* Subtle grid background */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
                        backgroundSize: "48px 48px"
                    }}
                />
                {/* Glow */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-16">
                        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <Shield className="h-4.5 w-4.5 text-white" />
                        </div>
                        <span className="text-white font-semibold text-lg tracking-tight">ZenxAI</span>
                    </div>

                    <div className="mb-12">
                        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3.5 py-1.5 mb-6">
                            <Shield className="h-3.5 w-3.5 text-indigo-400" />
                            <span className="text-indigo-300 text-xs font-medium">Platform Administration</span>
                        </div>
                        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                            Your command<br />center for the<br />entire platform
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                            Manage every company workspace, track registrations, and control platform health from one place.
                        </p>
                    </div>

                    <ul className="space-y-4">
                        {FEATURES.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                    <Icon className="h-4 w-4 text-indigo-400" />
                                </div>
                                <span className="text-slate-300 text-sm">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-slate-600 text-xs">© {new Date().getFullYear()} ZenxAI. All rights reserved.</p>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center px-8 py-12 bg-slate-900 lg:border-l border-slate-800">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-white font-semibold">ZenxAI</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-1.5">Owner Portal</h2>
                        <p className="text-slate-400 text-sm">Sign in to manage your platform</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl p-3.5 text-sm text-red-400">
                                <span className="shrink-0 mt-0.5">⚠</span>
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                                <input
                                    type="email"
                                    {...register("email")}
                                    autoComplete="email"
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                    placeholder="owner@yourplatform.com"
                                />
                            </div>
                            {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                                <input
                                    type={showPw ? "text" : "password"}
                                    {...register("password")}
                                    autoComplete="current-password"
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-600/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in to Portal"
                            )}
                        </button>
                    </form>

                    <p className="text-center text-slate-600 text-xs mt-8">
                        This portal is restricted to platform administrators.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlatformLogin;
