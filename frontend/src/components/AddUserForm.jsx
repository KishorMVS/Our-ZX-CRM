import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

// Add User Schema
const addUserSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(10, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.string().min(1, "Role is required"),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    canCreateGroup: z.boolean().optional(),
    smtpEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    smtpPassword: z.string().optional(),
    smtpFromName: z.string().optional(),
});

const AddUserForm = ({ onClose }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(addUserSchema),
        defaultValues: {
            role: "EMPLOYEE"
        }
    });

    const mutation = useMutation({
        mutationFn: async (newUser) => {
            return await api.post("/team", newUser);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries(["team"]);
            queryClient.invalidateQueries(["zxcall-c2c-usage"]);
            if (res?.data?.warning) toast.error(res.data.warning, { duration: 6000 });
            else toast.success("User created");
            onClose();
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to create user");
        }
    });



    // Better to fetch if not available
    const { data: departmentsList } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get("/departments")).data,
    });

    // C2C user quota for this workspace
    const { data: c2cUsage } = useQuery({
        queryKey: ["zxcall-c2c-usage"],
        queryFn: async () => (await api.get("/zxcall/c2c-usage")).data,
    });

    const isAdminRole = watch("role") === "ADMIN";
    const selectedDept = departmentsList?.find((d) => d.name === watch("department"));
    const isC2CDept = !!selectedDept?.c2c;
    const c2cReady = !!c2cUsage?.hasActive && (c2cUsage?.remaining ?? 0) > 0;
    const c2cBlocked = isC2CDept && !c2cReady;

    const { data: rolesList } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => (await api.get("/permissions/roles")).data,
    });

    const onSubmit = (data) => {
        // TeleCMI requires an 8+ char password for C2C agents
        if (isC2CDept && (data.password || "").length < 8) {
            setError("password", { type: "manual", message: "C2C users need a password of at least 8 characters." });
            return;
        }
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                    {...register("name")}
                    placeholder="Enter full name"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                        type="email"
                        {...register("email")}
                        placeholder="Enter email address"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                    {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                        {...register("phone")}
                        placeholder="Enter phone number"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                    {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        {...register("password")}
                        placeholder="Enter password"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 top-1 pr-3 flex items-center"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                {isC2CDept && !errors.password && (
                    <p className="text-gray-400 text-xs mt-1">C2C users require at least 8 characters.</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                        {...register("role")}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                        <option value="">Select Role</option>
                        {rolesList
                            ?.filter(role => !["SUPER_ADMIN", "PLATFORM_OWNER"].includes(role.name))
                            .map((role) => (
                                <option key={role.name} value={role.name}>
                                    {role.name.replace(/_/g, ' ')}
                                </option>
                            ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <select
                        {...register("department")}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                        <option value="">{isAdminRole ? "All Departments (full access)" : "Select Department"}</option>
                        {departmentsList?.map((dept) => (
                            <option key={dept.id} value={dept.name}>{dept.name}{dept.c2c ? " (C2C)" : ""}</option>
                        ))}
                    </select>
                    {isAdminRole && (
                        <p className="mt-1.5 text-xs text-gray-500">
                            Leave as <span className="font-medium">All Departments</span> for workspace-wide access (like a super admin).
                            Pick a department to confine this admin to that department only.
                        </p>
                    )}
                    {isC2CDept && (
                        c2cReady ? (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-green-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                C2C available — {c2cUsage.used}/{c2cUsage.limit} used
                            </p>
                        ) : (
                            <div className="mt-1.5">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                                    <XCircle className="h-3.5 w-3.5" />
                                    {!c2cUsage?.hasActive
                                        ? "C2C is not active for this workspace."
                                        : `C2C limit reached (${c2cUsage.used}/${c2cUsage.limit}). Cannot create.`}
                                </p>
                                {c2cUsage?.hasActive && (c2cUsage?.remaining ?? 0) <= 0 && (
                                    <button type="button" onClick={() => navigate("/zxcall/onboard?add=1")}
                                        className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline">
                                        Buy more seats
                                    </button>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Job Title / Designation</label>
                <input
                    {...register("jobTitle")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="e.g. Senior Developer, Sales Manager"
                />
            </div>

            {/* Chat privileges — relevant only for Team Leads (admins always have them) */}
            {watch("role") === "TEAM_LEAD" && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2.5">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Chat Privileges</p>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" {...register("canCreateGroup")} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        Can create groups
                    </label>
                </div>
            )}

            {/* Per-user email sending (SMTP) — optional */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Email Sending (SMTP) — optional</p>
                <p className="text-xs text-gray-400 -mt-1">Used as the sender identity for mail this user sends (e.g. meeting invites). Leave blank to use the company default.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">SMTP Email</label>
                        <input
                            type="email"
                            {...register("smtpEmail")}
                            placeholder="user@company.com"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        />
                        {errors.smtpEmail && <p className="text-red-500 text-xs">{errors.smtpEmail.message}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">SMTP App Password</label>
                        <input
                            type="password"
                            {...register("smtpPassword")}
                            placeholder="App password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">From Name</label>
                    <input
                        {...register("smtpFromName")}
                        placeholder="e.g. John from Sales"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                </div>
            </div>

            {mutation.isError && (
                <p className="text-red-600 text-xs font-medium">
                    {mutation.error?.response?.data?.message || "Failed to create user."}
                </p>
            )}

            <div className="flex justify-end pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending || c2cBlocked}
                    title={c2cBlocked ? "C2C limit reached or not active" : undefined}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Create User"}
                </button>
            </div>
        </form>
    );
};

export default AddUserForm;
