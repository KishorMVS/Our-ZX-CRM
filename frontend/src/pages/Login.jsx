import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { Lock, Mail, Loader2, Eye, EyeOff, CheckCircle2, BarChart2, Users, Zap, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

const FEATURES = [
    { icon: BarChart2, text: "Full CRM with leads & pipeline management" },
    { icon: Users, text: "Team management with role-based access" },
    { icon: Zap, text: "AI-powered lead scoring & automation" },
    { icon: CheckCircle2, text: "Invoicing, SLAs & attendance workflows" },
];

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(loginSchema),
    });

    // Hooks must run before any conditional return (rules of hooks).
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;

    const onSubmit = async (data) => {
        setIsLoading(true);
        setError("");
        const result = await login(data.email, data.password);
        setIsLoading(false);
        if (result.success) {
            navigate("/dashboard");
        } else {
            setError(result.message || "Invalid credentials");
        }
    };

    return (
        <div className="min-h-screen flex relative">
            <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-medium text-gray-600 lg:text-white/80 hover:text-gray-900 lg:hover:text-white transition-colors bg-white/50 lg:bg-transparent px-3 py-1.5 rounded-lg backdrop-blur-sm lg:backdrop-blur-none">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
            </Link>

            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 flex-col justify-between p-14 relative overflow-hidden">
                {/* Subtle pattern */}
                <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                        backgroundSize: "28px 28px"
                    }}
                />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-900/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

                <div className="relative">
                    <img
                        src="/zenxai-logo.png"
                        alt="ZenxAI"
                        className="h-10 object-contain brightness-0 invert mb-14"
                    />
                    <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                        Close more deals.<br />Faster.
                    </h1>
                    <p className="text-indigo-200 text-base leading-relaxed mb-10">
                        Your complete CRM — leads, team, tasks, and billing in one place.
                    </p>
                    <ul className="space-y-4">
                        {FEATURES.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                    <Icon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-indigo-100 text-sm">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-indigo-300/60 text-xs">
                    © {new Date().getFullYear()} ZenxAI. All rights reserved.
                </p>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-10 text-center">
                        <img src="/zenxai-logo.png" alt="ZenxAI" className="h-14 object-contain mx-auto" />
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-1.5">
                            Sign in to your workspace
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Enter your credentials to access your account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3.5 text-sm text-red-600">
                                <span className="shrink-0">⚠</span>
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="email"
                                    {...register("email")}
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                />
                            </div>
                            {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    {...register("password")}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-600/20 mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>

                        <p className="text-center text-sm text-gray-500 pt-1">
                            Don&apos;t have an account?{" "}
                            <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-500 transition-colors">
                                Register your company
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
