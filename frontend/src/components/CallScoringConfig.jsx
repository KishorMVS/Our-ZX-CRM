import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Info } from "lucide-react";
import api from "../api/axios";

const MAX_CALL_SCORE = 30;

const defaultParam = () => ({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    maxPoints: 5,
});

const CallScoringConfig = () => {
    const [params, setParams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const totalPoints = params.reduce((sum, p) => sum + (Number(p.maxPoints) || 0), 0);
    const isOverLimit = totalPoints > MAX_CALL_SCORE;

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get("/company-settings");
                const config = res.data?.callScoringConfig;
                if (Array.isArray(config) && config.length > 0) {
                    setParams(config);
                } else {
                    setParams([defaultParam()]);
                }
            } catch {
                setParams([defaultParam()]);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const handleAdd = () => {
        setParams(prev => [...prev, defaultParam()]);
    };

    const handleRemove = (id) => {
        setParams(prev => prev.filter(p => p.id !== id));
    };

    const handleChange = (id, field, value) => {
        setParams(prev =>
            prev.map(p => p.id === id ? { ...p, [field]: field === "maxPoints" ? Number(value) : value } : p)
        );
    };

    const handleSave = async () => {
        setMessage({ type: "", text: "" });

        const cleaned = params.filter(p => p.name.trim());
        if (cleaned.length === 0) {
            setMessage({ type: "error", text: "Add at least one scoring parameter with a name." });
            return;
        }
        if (isOverLimit) {
            setMessage({ type: "error", text: `Total max points (${totalPoints}) exceeds the ${MAX_CALL_SCORE}-point limit.` });
            return;
        }

        setSaving(true);
        try {
            await api.patch("/company-settings", { callScoringConfig: cleaned });
            setParams(cleaned);
            setMessage({ type: "success", text: "Scoring configuration saved." });
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to save configuration." });
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
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">AI Call Scoring Parameters</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Define what the AI evaluates in a C2C call conversation. Maximum total: <span className="font-semibold">30 points</span> per call.
                    </p>
                </div>
            </div>

            {/* Score budget bar */}
            <div className="mt-4 mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Points budget used</span>
                    <span className={`text-sm font-bold ${isOverLimit ? "text-red-600" : "text-indigo-600"}`}>
                        {totalPoints} / {MAX_CALL_SCORE}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all ${isOverLimit ? "bg-red-500" : "bg-indigo-500"}`}
                        style={{ width: `${Math.min((totalPoints / MAX_CALL_SCORE) * 100, 100)}%` }}
                    />
                </div>
                {isOverLimit && (
                    <p className="text-xs text-red-500 mt-2">Total exceeds {MAX_CALL_SCORE} pts — reduce points before saving.</p>
                )}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2 mb-5 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                    After a C2C call is transcribed, AI will score each parameter based on the conversation and add the total to the lead's score.
                    A lead reaches <strong>100 (Converted)</strong> only when explicitly marked converted — a single call adds at most 30 points.
                </span>
            </div>

            {/* Parameters list */}
            <div className="space-y-3">
                {params.map((param, index) => (
                    <div key={param.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                                {index + 1}
                            </span>
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Parameter {index + 1}</span>
                            <button
                                onClick={() => handleRemove(param.id)}
                                disabled={params.length === 1}
                                className="ml-auto text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Parameter Name <span className="text-red-400">*</span></label>
                                <input
                                    value={param.name}
                                    onChange={e => handleChange(param.id, "name", e.target.value)}
                                    placeholder="e.g. Interest Level"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                <input
                                    value={param.description}
                                    onChange={e => handleChange(param.id, "description", e.target.value)}
                                    placeholder="e.g. Lead showed clear interest"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Max Points</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max={MAX_CALL_SCORE}
                                        value={param.maxPoints}
                                        onChange={e => handleChange(param.id, "maxPoints", e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">/ {MAX_CALL_SCORE}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add parameter */}
            <button
                onClick={handleAdd}
                disabled={totalPoints >= MAX_CALL_SCORE}
                className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
                <Plus className="h-4 w-4" />
                Add Parameter
            </button>

            {/* Status message */}
            {message.text && (
                <div className={`mt-4 p-3 rounded-md text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {message.text}
                </div>
            )}

            {/* Save */}
            <div className="mt-5 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || isOverLimit}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving..." : "Save Configuration"}
                </button>
            </div>

            {/* Score model explanation */}
            <div className="mt-6 pt-5 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Lead Score Model</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                        { label: "Cold Lead", range: "0 pts", color: "bg-gray-100 text-gray-600" },
                        { label: "Cold", range: "20–49 pts", color: "bg-blue-100 text-blue-700" },
                        { label: "Warm", range: "50–79 pts", color: "bg-yellow-100 text-yellow-700" },
                        { label: "Hot", range: "80–99 pts", color: "bg-orange-100 text-orange-700" },
                        { label: "Converted", range: "100 pts", color: "bg-green-100 text-green-700" },
                    ].map(t => (
                        <div key={t.label} className={`px-3 py-2 rounded-md font-medium flex justify-between items-center ${t.color}`}>
                            <span>{t.label}</span>
                            <span className="font-normal opacity-80">{t.range}</span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Score accumulates across calls and touchpoints. AI call (C2C) contributes max 30 pts per call.
                </p>
            </div>
        </div>
    );
};

export default CallScoringConfig;
