import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    PhoneCall, KeyRound, User, CheckCircle, AlertCircle,
    Loader2, ArrowRight, Hash, Shield,
} from "lucide-react";
import api from "../api/axios";
import { useVoiceLink } from "../context/VoiceLinkContext";

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const VoiceLinkProfilePage = () => {
    const navigate = useNavigate();
    const { hasClient, isKycComplete, refresh } = useVoiceLink() || {};

    const [client, setClient]       = useState(null);
    const [loading, setLoading]     = useState(true);
    const [pageError, setPageError] = useState("");

    // Credential update
    const [credForm, setCredForm]     = useState({ username: "", password: "", confirmPassword: "" });
    const [credLoading, setCredLoad]  = useState(false);
    const [credError, setCredError]   = useState("");
    const [credSuccess, setCredSuccess] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setPageError("");
        try {
            const res = await api.get("/voicelink/client");
            setClient(res.data?.client || null);
        } catch (err) {
            setPageError(err?.response?.data?.message || "Failed to load client info.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCredUpdate = async (e) => {
        e.preventDefault();
        setCredError("");
        setCredSuccess("");
        if (credForm.password !== credForm.confirmPassword) {
            setCredError("Passwords do not match.");
            return;
        }
        setCredLoad(true);
        try {
            await api.patch("/voicelink/client/credentials", {
                username: credForm.username,
                password: credForm.password,
            });
            setCredSuccess("Credentials updated successfully.");
            setCredForm({ username: "", password: "", confirmPassword: "" });
            refresh?.();
        } catch (err) {
            setCredError(err?.response?.data?.message || "Failed to update credentials.");
        } finally {
            setCredLoad(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{pageError}</span>
            </div>
        );
    }

    if (!hasClient || !client) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center space-y-4">
                <PhoneCall className="h-12 w-12 text-gray-300 mx-auto" />
                <h2 className="text-lg font-semibold text-gray-700">No VoiceLink Client Found</h2>
                <p className="text-sm text-gray-500">Purchase a DID number first to set up your VoiceLink client.</p>
                <button
                    onClick={() => navigate("/voicelink/did")}
                    className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Buy DID Number
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">VoiceLink Profile</h1>
                <p className="text-sm text-gray-500">Manage your VoiceLink client account</p>
            </div>

            {/* Client info card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                            <PhoneCall className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{client.username}</p>
                            <p className="text-xs text-gray-500">
                                Client ID: <span className="font-mono">{client.clientId}</span>
                                {" · "}{client.channelCount} channel{client.channelCount !== 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold
                        ${isKycComplete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {isKycComplete ? "KYC Approved" : "KYC Pending"}
                    </span>
                </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Manage — credential update */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Manage</h2>
                    </div>
                    <p className="text-xs text-gray-500">Update your VoiceLink login credentials.</p>
                    <button
                        onClick={() => document.getElementById("cred-section")?.scrollIntoView({ behavior: "smooth" })}
                        className="mt-auto flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        Update credentials <ArrowRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Buy / Manage DID Numbers */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {isKycComplete
                            ? <Hash className="h-4 w-4 text-indigo-600" />
                            : <Shield className="h-4 w-4 text-amber-500" />
                        }
                        <h2 className="text-sm font-semibold text-gray-900">
                            {isKycComplete ? "DID Numbers" : "Buy DID Numbers"}
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500">
                        {isKycComplete
                            ? "View and assign DID numbers to your client account."
                            : "Complete KYC verification to unlock DID number selection."}
                    </p>
                    <button
                        onClick={() => navigate("/voicelink/numbers")}
                        className={`mt-auto flex items-center gap-2 text-sm font-medium transition-colors
                            ${isKycComplete ? "text-indigo-600 hover:text-indigo-800" : "text-amber-600 hover:text-amber-800"}`}
                    >
                        {isKycComplete ? "Go to DID Numbers" : "Complete KYC & Buy DID"}
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Credential update form */}
            <div id="cred-section" className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                    <KeyRound className="h-4 w-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Update Client Login</h2>
                </div>
                <form onSubmit={handleCredUpdate} className="p-6 space-y-4">
                    {credError && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{credError}</span>
                        </div>
                    )}
                    {credSuccess && (
                        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex gap-2">
                            <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{credSuccess}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    required
                                    value={credForm.username}
                                    onChange={(e) => setCredForm(p => ({ ...p, username: e.target.value }))}
                                    placeholder="VoiceLink username"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                New Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    required type="password"
                                    value={credForm.password}
                                    onChange={(e) => setCredForm(p => ({ ...p, password: e.target.value }))}
                                    placeholder="New password"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Confirm Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    required type="password"
                                    value={credForm.confirmPassword}
                                    onChange={(e) => setCredForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                    placeholder="Confirm password"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={credLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                        >
                            {credLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {credLoading ? "Updating..." : "Update Credentials"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VoiceLinkProfilePage;
