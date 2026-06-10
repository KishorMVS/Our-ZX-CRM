import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Building, Loader2, Users } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const departmentSchema = z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
    c2c: z.boolean().optional(),
    hasLeadsAccess: z.boolean().optional(),
});

const Departments = () => {
    const { user } = useAuth();
    console.log("Departments Page Mounted. User:", user);
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const { data: departments, isLoading, error } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get("/departments")).data,
    });

    const createMutation = useMutation({
        mutationFn: async (data) => await api.post("/departments", data),
        onSuccess: () => {
            queryClient.invalidateQueries(["departments"]);
            setIsAdding(false);
            reset();
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to create department");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => await api.delete(`/departments/${id}`),
        onSuccess: () => { queryClient.invalidateQueries(["departments"]); },
        onError: (error) => { alert(error.response?.data?.message || "Failed to delete department"); }
    });

    const updateFlagMutation = useMutation({
        mutationFn: async ({ id, field, value }) => api.patch(`/departments/${id}`, { [field]: value }),
        onSuccess: () => { queryClient.invalidateQueries(["departments"]); },
        onError: (err) => { alert(err.response?.data?.message || "Failed to update department"); }
    });

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
        resolver: zodResolver(departmentSchema),
        defaultValues: { c2c: false, hasLeadsAccess: false },
    });

    // Leads access only applies to C2C departments. When C2C is turned on,
    // default leads access ON (admin can then "remove lead access"); when off,
    // force it off so the two stay consistent with the backend invariant.
    const c2cChecked = watch("c2c");
    useEffect(() => {
        setValue("hasLeadsAccess", Boolean(c2cChecked));
    }, [c2cChecked, setValue]);

    const onSubmit = (data) => {
        createMutation.mutate({
            name: data.name,
            c2c: Boolean(data.c2c),
            hasLeadsAccess: Boolean(data.c2c) && Boolean(data.hasLeadsAccess),
        });
    };

    if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
    if (error) return <div className="text-center text-red-500 py-10">Failed to load departments.</div>;

    const filteredDepartments = departments?.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return <div className="text-center py-10">Access Denied</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
                    <p className="text-sm text-gray-500">Manage your organization's departments</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Department
                </button>
            </div>

            {isAdding && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <input
                                    {...register("name")}
                                    placeholder="Department Name (e.g. Engineering)"
                                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                            </div>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                            >
                                {createMutation.isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsAdding(false); reset(); }}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" {...register("c2c")}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="font-medium">C2C (click-to-call)</span>
                                <span className="text-xs text-gray-400">— only C2C members use leads and take calls</span>
                            </label>
                            {/* Leads access is a sub-option of C2C — revealed only when C2C is enabled */}
                            {c2cChecked && (
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer ml-6">
                                    <input type="checkbox" {...register("hasLeadsAccess")}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="font-medium">Leads Access</span>
                                    <span className="text-xs text-gray-400">— uncheck to remove lead access for this team</span>
                                </label>
                            )}
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredDepartments?.map((dept) => (
                        <li key={dept.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 group">
                            <Link to={`/departments/${dept.id}`} className="flex items-center flex-1 min-w-0">
                                <Building className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0 group-hover:text-indigo-600 transition-colors" />
                                <div className="min-w-0">
                                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2 flex-wrap">
                                        {dept.name}
                                        {dept.c2c && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">C2C</span>
                                        )}
                                        {dept.hasLeadsAccess && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                <Users className="h-2.5 w-2.5" /> Leads
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-gray-500">{dept._count?.users || 0} Employees</p>
                                </div>
                            </Link>
                            {isAdmin && (
                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                    {/* Leads access toggle is only meaningful for C2C departments */}
                                    {dept.c2c && (
                                        <button
                                            onClick={() => updateFlagMutation.mutate({ id: dept.id, field: "hasLeadsAccess", value: !dept.hasLeadsAccess })}
                                            title={dept.hasLeadsAccess ? "Revoke leads access" : "Grant leads access"}
                                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${dept.hasLeadsAccess ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                                        >
                                            {dept.hasLeadsAccess ? "Leads: ON" : "Leads: OFF"}
                                        </button>
                                    )}
                                    {dept._count?.users === 0 && (
                                        <button
                                            onClick={() => { if (confirm("Delete this department?")) deleteMutation.mutate(dept.id); }}
                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                            title="Delete Department"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                    {filteredDepartments?.length === 0 && (
                        <li className="px-6 py-10 text-center text-gray-500">
                            No departments found.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default Departments;
