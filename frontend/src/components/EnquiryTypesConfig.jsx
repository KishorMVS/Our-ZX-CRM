import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Info } from "lucide-react";
import api from "../api/axios";

const DEFAULT_TYPES = ["PRODUCT", "SERVICES", "LMS", "WHITE_LABEL"];

const EnquiryTypesConfig = () => {
    const [types, setTypes] = useState([]);
    const [newType, setNewType] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get("/company-settings");
                const list = res.data?.enquiryTypes;
                setTypes(Array.isArray(list) && list.length > 0 ? list : DEFAULT_TYPES);
            } catch {
                setTypes(DEFAULT_TYPES);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleAdd = () => {
        const value = newType.trim();
        if (!value) return;
        if (types.some(t => t.toLowerCase() === value.toLowerCase())) {
            setMessage({ type: "error", text: `"${value}" already exists.` });
            return;
        }
        setTypes(prev => [...prev, value]);
        setNewType("");
        setMessage({ type: "", text: "" });
    };

    const handleRemove = (value) => {
        setTypes(prev => prev.filter(t => t !== value));
    };

    const handleSave = async () => {
        setMessage({ type: "", text: "" });
        const cleaned = [...new Set(types.map(t => t.trim()).filter(Boolean))];
        if (cleaned.length === 0) {
            setMessage({ type: "error", text: "Add at least one enquiry type." });
            return;
        }
        setSaving(true);
        try {
            await api.patch("/company-settings", { enquiryTypes: cleaned });
            setTypes(cleaned);
            setMessage({ type: "success", text: "Enquiry types saved." });
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to save enquiry types." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Lead Enquiry Types</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Customize the enquiry types available when creating or editing a lead. These appear in the
                    "Enquiry Type" dropdown on the lead form.
                </p>
            </div>

            <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-md p-3 mb-5">
                <Info className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-indigo-700">
                    Removing a type only hides it from the dropdown — existing leads keep their current enquiry type.
                </p>
            </div>

            {/* Existing types */}
            <div className="space-y-2 mb-5">
                {types.map((t) => (
                    <div key={t} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        <span className="text-sm font-medium text-gray-800">{t}</span>
                        <button
                            type="button"
                            onClick={() => handleRemove(t)}
                            title="Remove"
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                {types.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No enquiry types yet — add one below.</p>
                )}
            </div>

            {/* Add new */}
            <div className="flex gap-2 mb-5">
                <input
                    type="text"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                    placeholder="e.g. Consultation, Demo Request, Partnership"
                    className="flex-1 rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Add
                </button>
            </div>

            {message.text && (
                <p className={`text-sm mb-4 ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}>
                    {message.text}
                </p>
            )}

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Enquiry Types
                </button>
            </div>
        </div>
    );
};

export default EnquiryTypesConfig;
