import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const editUserSchema = z.object({
    name: z.string().min(2, "Name is required"),
    phone: z.string().optional(),
    role: z.string().min(1, "Role is required"),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    canCreateGroup: z.boolean().optional(),
    smtpEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    smtpPassword: z.string().optional(),
    smtpFromName: z.string().optional(),
});

const EditUserForm = ({ user, onClose }) => {
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        setValue
    } = useForm({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            name: user.name,
            phone: user.phone || "",
            role: user.role,
            department: user.department || "",
            jobTitle: user.jobTitle || "",
            canCreateGroup: !!user.canCreateGroup,
            smtpEmail: user.smtpEmail || "",
            smtpPassword: "",
            smtpFromName: user.smtpFromName || ""
        }
    });

    const { data: departmentsList } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get("/departments")).data,
    });

    const { data: rolesList } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => (await api.get("/permissions/roles")).data,
    });

    // Populate form if user prop changes (though generic modal unmounts usually)
    useEffect(() => {
        if (user) {
            setValue("name", user.name);
            setValue("phone", user.phone);
            setValue("role", user.role);
            setValue("department", user.department);
            setValue("jobTitle", user.jobTitle);
            setValue("canCreateGroup", !!user.canCreateGroup);
            setValue("smtpEmail", user.smtpEmail || "");
            setValue("smtpFromName", user.smtpFromName || "");
        }
    }, [user, setValue]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            return await api.patch(`/team/${user.id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["team"]);
            onClose();
            // alert("User updated successfully");
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to update user");
        },
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                    {...register("name")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                    {...register("phone")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                    {...register("role")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                    <option value="">Select Role</option>
                    {rolesList
                        ?.filter((role) => {
                            if (role.name === "SUPER_ADMIN") return false;
                            if (currentUser?.role !== "SUPER_ADMIN" && role.name === "ADMIN") return false;
                            return true;
                        })
                        .map((role) => (
                            <option key={role.name} value={role.name}>{role.name.replace(/_/g, ' ')}</option>
                        ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                    {...register("department")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                    <option value="">{watch("role") === "ADMIN" ? "All Departments (full access)" : "Select Department"}</option>
                    {departmentsList?.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                </select>
                {watch("role") === "ADMIN" && (
                    <p className="mt-1.5 text-xs text-gray-500">
                        Leave as <span className="font-medium">All Departments</span> for workspace-wide access.
                        Pick a department to confine this admin to that department only.
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Job Title / Designation</label>
                <input
                    {...register("jobTitle")}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. Senior Developer"
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
            {["ADMIN", "SUPER_ADMIN"].includes(watch("role")) && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-2.5">
                    Admins can always create groups.
                </p>
            )}

            {/* Per-user email sending (SMTP) — fill in later if it was left blank at creation */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email Sending (SMTP){user.smtpEmail ? "" : " — not set"}
                </p>
                <p className="text-xs text-gray-400 -mt-1">Used as the sender identity for mail this user sends. Leave the password blank to keep the existing one.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">SMTP Email</label>
                        <input
                            type="email"
                            {...register("smtpEmail")}
                            placeholder="user@company.com"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        {errors.smtpEmail && <p className="text-red-500 text-xs mt-1">{errors.smtpEmail.message}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">SMTP App Password</label>
                        <input
                            type="password"
                            {...register("smtpPassword")}
                            placeholder={user.smtpEmail ? "•••••• (unchanged)" : "App password"}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">From Name</label>
                    <input
                        {...register("smtpFromName")}
                        placeholder="e.g. John from Sales"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                </button>
            </div>
        </form>
    );
};

export default EditUserForm;
