import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import api from "../api/axios";
import { Loader2 } from "lucide-react";

// Fallbacks used until /company-settings/lead-options resolves.
const FALLBACK_SOURCES = [
    { value: "WEBSITE", label: "Website" },
    { value: "PHONE_CALL", label: "Phone Call" },
    { value: "LINKEDIN", label: "LinkedIn" },
];
const FALLBACK_ENQUIRY_TYPES = ["PRODUCT", "SERVICES", "LMS", "WHITE_LABEL"];

const leadSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().min(10, "Phone number is required"),
    source: z.string().min(1, "Source is required"),
    enquiryType: z.string().min(1, "Enquiry type is required"),
    biodata: z.string().optional().or(z.literal("")),
    salesNotes: z.string().optional().or(z.literal("")),
    status: z.string().optional(),
});

const AddLeadForm = ({ onClose, initialData }) => {
    const queryClient = useQueryClient();
    const isEdit = !!initialData;

    // Sources (manual + connected integrations) and configurable enquiry types.
    const { data: options } = useQuery({
        queryKey: ["lead-options"],
        queryFn: async () => (await api.get("/company-settings/lead-options")).data,
        staleTime: 5 * 60 * 1000,
    });
    const sources = options?.sources?.length ? options.sources : FALLBACK_SOURCES;
    const enquiryTypes = options?.enquiryTypes?.length ? options.enquiryTypes : FALLBACK_ENQUIRY_TYPES;

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(leadSchema),
        defaultValues: initialData || { source: "", enquiryType: "" }
    });

    // Once options load, default to the first available value (new leads only).
    const currentSource = watch("source");
    const currentEnquiry = watch("enquiryType");
    useEffect(() => {
        if (isEdit) return;
        if (!currentSource && sources.length) setValue("source", sources[0].value);
        if (!currentEnquiry && enquiryTypes.length) setValue("enquiryType", enquiryTypes[0]);
    }, [sources, enquiryTypes, currentSource, currentEnquiry, isEdit, setValue]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (isEdit) {
                return await api.patch(`/leads/${initialData.id}/status`, data);
            }
            return await api.post("/leads", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            onClose();
        },
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
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

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <select {...register("source")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                        {sources.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}{s.connected ? " • connected" : ""}
                            </option>
                        ))}
                    </select>
                    {errors.source && <p className="text-red-500 text-xs">{errors.source.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Enquiry Type</label>
                    <select {...register("enquiryType")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                        {/* Preserve an existing value even if it's no longer in the configured list */}
                        {isEdit && initialData?.enquiryType && !enquiryTypes.includes(initialData.enquiryType) && (
                            <option value={initialData.enquiryType}>{initialData.enquiryType}</option>
                        )}
                        {enquiryTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    {errors.enquiryType && <p className="text-red-500 text-xs">{errors.enquiryType.message}</p>}
                </div>
            </div>

            {isEdit && (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select {...register("status")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="FOLLOW_UP">Follow Up</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="LOST">Lost</option>
                    </select>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700">Biodata / Notes</label>
                <textarea
                    {...register("biodata")}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="Enter additional details about the lead..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 font-bold text-indigo-700">Sales Notes (Manual notes by closer)</label>
                <textarea
                    {...register("salesNotes")}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-indigo-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-indigo-50/30"
                    placeholder="Enter manual closing notes here..."
                />
            </div>

            {isEdit && initialData?.source === "META_ADS" && (
                <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mt-4">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <span>📊</span> Meta Ads Attribution
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-gray-500 text-xs">Platform</span>
                            <span className="font-medium text-gray-900">{initialData.metaPlatform || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs">Campaign</span>
                            <span className="font-medium text-gray-900">{initialData.metaCampaignName || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs">Ad Set</span>
                            <span className="font-medium text-gray-900">{initialData.metaAdsetName || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs">Ad</span>
                            <span className="font-medium text-gray-900">{initialData.metaAdName || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="block text-gray-500 text-xs">Form ID</span>
                            <span className="font-mono text-xs text-gray-600">{initialData.metaFormId || "N/A"}</span>
                        </div>
                    </div>
                </div>
            )}

            {isEdit && initialData?.source === "GMAIL" && (
                <div className="bg-red-50 border border-red-100 rounded-md p-4 mt-4">
                    <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                        <span>📧</span> Gmail Source
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-gray-500 text-xs">Sender Email</span>
                            <span className="font-medium text-gray-900">{initialData.gmailSenderEmail || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs">Subject</span>
                            <span className="font-medium text-gray-900">{initialData.gmailSubject || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs">Received At</span>
                            <span className="font-medium text-gray-900">{initialData.gmailReceivedAt ? new Date(initialData.gmailReceivedAt).toLocaleString() : "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                            {initialData.gmailMessageId && (
                                <button
                                    type="button"
                                    onClick={() => window.open(`https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(initialData.gmailMessageId)}`, '_blank')}
                                    className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition"
                                >
                                    View Original Email
                                </button>
                            )}
                        </div>
                    </div>
                </div>
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
                    disabled={mutation.isPending}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : (isEdit ? "Update Lead" : "Save Lead")}
                </button>
            </div>
        </form>
    );
};

export default AddLeadForm;
