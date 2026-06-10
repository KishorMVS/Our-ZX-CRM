import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { Building2, User, Mail, Lock, Phone, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const registerSchema = z.object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    adminName: z.string().min(2, "Your name must be at least 2 characters"),
    adminEmail: z.string().email("Invalid email address"),
    adminPhone: z.string().optional(),
    adminPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
}).refine((data) => data.adminPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});

const FEATURES = [
    "Full CRM with leads & pipeline management",
    "Team management with role-based access",
    "Attendance, leave & HR workflows",
    "Invoicing, SLAs & billing",
    "AI-powered lead scoring & routing",
];

const Register = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { registerCompany } = useAuth();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({ resolver: zodResolver(registerSchema) });

    const onSubmit = async (data) => {
        setIsLoading(true);
        setError("");
        const result = await registerCompany({
            companyName: data.companyName,
            adminName: data.adminName,
            adminEmail: data.adminEmail,
            adminPhone: data.adminPhone || "",
            adminPassword: data.adminPassword,
        });
        setIsLoading(false);

        if (result.success) {
            navigate("/dashboard");
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-indigo-50/40">
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-5/12 bg-indigo-600 flex-col justify-between p-12 text-white">
                <div>
                    <img src="/zenxai-logo.png" alt="ZenxAI Logo" className="h-12 object-contain brightness-0 invert mb-12" />
                    <h1 className="text-4xl font-bold leading-tight mb-4">
                        Run your entire business from one place
                    </h1>
                    <p className="text-indigo-200 text-lg leading-relaxed">
                        Set up your company workspace in under 2 minutes. Your team can start closing deals today.
                    </p>
                </div>

                <ul className="space-y-4">
                    {FEATURES.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-indigo-300 shrink-0 mt-0.5" />
                            <span className="text-indigo-100 text-sm">{f}</span>
                        </li>
                    ))}
                </ul>

                <p className="text-indigo-300 text-xs">© {new Date().getFullYear()} ZenxAI. All rights reserved.</p>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <img src="/zenxai-logo.png" alt="ZenxAI Logo" className="h-14 object-contain mx-auto" />
                    </div>

                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-gray-900">Create your workspace</h2>
                        <p className="text-gray-500 mt-1">Register your company and get started instantly</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 rounded">
                                {error}
                            </div>
                        )}

                        {/* Company Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building2 className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    {...register("companyName")}
                                    placeholder="Acme Corp"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>
                            {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName.message}</p>}
                        </div>

                        {/* Admin Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    {...register("adminName")}
                                    placeholder="John Smith"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>
                            {errors.adminName && <p className="mt-1 text-xs text-red-600">{errors.adminName.message}</p>}
                        </div>

                        {/* Admin Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    {...register("adminEmail")}
                                    placeholder="john@acmecorp.com"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>
                            {errors.adminEmail && <p className="mt-1 text-xs text-red-600">{errors.adminEmail.message}</p>}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="tel"
                                    {...register("adminPhone")}
                                    placeholder="+91 9876543210"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    {...register("adminPassword")}
                                    placeholder="Min. 8 characters"
                                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </button>
                            </div>
                            {errors.adminPassword && <p className="mt-1 text-xs text-red-600">{errors.adminPassword.message}</p>}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    {...register("confirmPassword")}
                                    placeholder="Repeat password"
                                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    {showConfirm ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </button>
                            </div>
                            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Creating workspace...
                                </>
                            ) : (
                                "Create Workspace"
                            )}
                        </button>

                        <p className="text-center text-sm text-gray-500">
                            Already have an account?{" "}
                            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-500">
                                Sign in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;
