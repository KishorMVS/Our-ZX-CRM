import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    CheckCircle, Loader2, ExternalLink, AlertCircle,
    Phone, Shield, Hash,
} from "lucide-react";
import api from "../api/axios";
import { useVoiceLink } from "../context/VoiceLinkContext";

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const SubmitBtn = ({ loading, label, color = "indigo" }) => (
    <button
        type="submit"
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors
            ${color === "green" ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
    >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Processing..." : label}
    </button>
);

const getKycSteps = (accountType) =>
    accountType === "business"
        ? ["Register Details", "PAN Verify", "Aadhaar", "GST", "Final Submit"]
        : ["Register Details", "PAN Verify", "Aadhaar", "Final Submit"];

const toVisualIdx = (kycStep, accountType) =>
    accountType === "business" ? kycStep : kycStep > 2 ? kycStep - 1 : kycStep;

const DIDNumbersPage = () => {
    const navigate = useNavigate();
    const vlCtx = useVoiceLink() || {};
    const { refresh: refreshCtx, isKycSubmitted, markKycAsSubmitted } = vlCtx;

    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError]     = useState("");
    const [client, setClient]           = useState(null);
    const [kycStatus, setKycStatus]     = useState(null);
    const [availableDids, setAvailableDids] = useState([]);
    const [selectedDids, setSelectedDids]   = useState([]);
    const [mapping, setMapping]             = useState(false);
    const [mapped, setMapped]               = useState(false);
    const [mapError, setMapError]           = useState("");

    // KYC wizard state
    const [kycStep, setKycStep]           = useState(0);
    const [kycLoading, setKycLoading]     = useState(false);
    const [kycError, setKycError]         = useState("");
    const [accountType, setAccountType]   = useState("individual");
    const [aadhaarUrl, setAadhaarUrl]     = useState("");
    const [checkingAadhaar, setCheckingAadhaar] = useState(false);

    const [regForm, setRegForm] = useState({
        account_type: "individual", full_name: "", email: "",
        phone: "", billing_address: "", business_name: "", term_and_condition: false,
    });
    const [panForm, setPanForm] = useState({ pan_number: "", pan_holder_name: "" });
    const [gstForm, setGstForm] = useState({ gst_number: "" });

    const kycStorageKey = client ? `vl_kyc_${client.clientId}` : null;

    // Restore KYC wizard progress from localStorage
    useEffect(() => {
        if (!kycStorageKey) return;
        try {
            const saved = localStorage.getItem(kycStorageKey);
            if (!saved) return;
            const d = JSON.parse(saved);
            if (d.kycStep    !== undefined) setKycStep(d.kycStep);
            if (d.accountType)              setAccountType(d.accountType);
            if (d.aadhaarUrl)               setAadhaarUrl(d.aadhaarUrl);
            if (d.regForm)                  setRegForm(d.regForm);
            if (d.panForm)                  setPanForm(d.panForm);
            if (d.gstForm)                  setGstForm(d.gstForm);
        } catch { /* ignore */ }
    }, [kycStorageKey]);

    // Persist KYC wizard progress
    useEffect(() => {
        if (!kycStorageKey) return;
        localStorage.setItem(kycStorageKey, JSON.stringify({
            kycStep, accountType, aadhaarUrl, regForm, panForm, gstForm,
        }));
    }, [kycStorageKey, kycStep, accountType, aadhaarUrl, regForm, panForm, gstForm]);

    const isKycComplete = !!(
        kycStatus?.data?.is_complete || kycStatus?.is_complete ||
        kycStatus?.data?.is_kyc_complete || kycStatus?.is_kyc_complete ||
        kycStatus?.data?.kyc_status === 1 || kycStatus?.kyc_status === 1 ||
        kycStatus?.data?.kyc_status_label === "Verified" ||
        vlProfile?.is_verified || vlProfile?.is_kyc_verified || vlProfile?.kyc_verified
    );
    const maxDids       = client?.channelCount || 0;
    const kycSteps      = getKycSteps(accountType);
    const visualIdx     = toVisualIdx(kycStep, accountType);
    const isFinalStep   = (accountType === "individual" && kycStep === 3) || (accountType === "business" && kycStep === 4);

    const load = useCallback(async () => {
        setPageLoading(true);
        setPageError("");
        try {
            const clientRes = await api.get("/voicelink/client");
            const c = clientRes.data?.client;
            setClient(c);
            if (!c) return;
            const kycRes = await api.get(`/voicelink/kyc/status?client_id=${c.clientId}`);
            setKycStatus(kycRes.data);
            const kData = kycRes.data?.data || kycRes.data || {};
            const kycDone = !!(
                kData.is_complete || 
                kData.is_kyc_complete || 
                kData.kyc_status === 1 || 
                kData.kyc_status_label === "Verified" ||
                kData.is_verified || 
                kData.is_kyc_verified || 
                kData.kyc_verified ||
                (kData.kyc_status && String(kData.kyc_status).toLowerCase() === "verified") ||
                (kData.status && String(kData.status).toLowerCase() === "verified")
            );
            if (kycDone) {
                const didsRes = await api.get("/voicelink/available-dids");
                setAvailableDids(didsRes.data?.data || []);
            }
        } catch (err) {
            setPageError(err?.response?.data?.message || "Failed to load data. Please try again.");
        } finally {
            setPageLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── DID selection ─────────────────────────────────────────────────────────
    const toggleDid = (didId) => {
        setSelectedDids(prev => {
            if (prev.includes(didId)) return prev.filter(id => id !== didId);
            if (prev.length >= maxDids) return prev;
            return [...prev, didId];
        });
    };

    const handleMapDids = async () => {
        if (selectedDids.length === 0) return;
        setMapping(true);
        setMapError("");
        try {
            for (const didId of selectedDids) {
                await api.post("/voicelink/map-did", {
                    client_id: client.clientId, did_id: didId,
                    call_recording: 0, user_status: 2,
                });
            }
            setMapped(true);
        } catch (err) {
            setMapError(err?.response?.data?.message || "Failed to assign DID(s). Please try again.");
        } finally {
            setMapping(false);
        }
    };

    // ── KYC handlers ──────────────────────────────────────────────────────────
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setKycError("");
        setKycLoading(true);
        try {
            const payload = { ...regForm, client_id: client.clientId };
            if (regForm.account_type !== "business") delete payload.business_name;
            await api.post("/voicelink/kyc/step-1", payload);
            setAccountType(regForm.account_type);
            setKycStep(1);
        } catch (err) {
            setKycError(err?.response?.data?.message || "Failed to save register details.");
        } finally {
            setKycLoading(false);
        }
    };

    const handlePanSubmit = async (e) => {
        e.preventDefault();
        setKycError("");
        setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/step-2", { ...panForm, client_id: client.clientId });
            setKycStep(2);
        } catch (err) {
            const msg = err?.response?.data?.message || "PAN verification failed.";
            const isNameMismatch = msg.toLowerCase().includes("name") || err?.response?.status === 422;
            setKycError(isNameMismatch
                ? `${msg} — Name must exactly match your PAN card as per NSDL records. Check incometax.gov.in to confirm.`
                : msg
            );
        } finally {
            setKycLoading(false);
        }
    };

    const initiateAadhaar = async () => {
        setKycError("");
        setKycLoading(true);
        try {
            const res = await api.post("/voicelink/kyc/step-3-init", { client_id: client.clientId });
            setAadhaarUrl(res.data?.data?.redirect_url || "");
        } catch (err) {
            setKycError(err?.response?.data?.message || "Failed to initiate Aadhaar verification.");
        } finally {
            setKycLoading(false);
        }
    };

    const checkAadhaarStatus = async () => {
        setCheckingAadhaar(true);
        setKycError("");
        try {
            const res = await api.get(`/voicelink/kyc/status?client_id=${client.clientId}`);
            if (res.data?.data?.aadhaar_verified) {
                setKycStep(3);
            } else {
                setKycError("Aadhaar not yet verified. Complete the DigiLocker process first.");
            }
        } catch (err) {
            setKycError(err?.response?.data?.message || "Failed to check Aadhaar status.");
        } finally {
            setCheckingAadhaar(false);
        }
    };

    const handleGstSubmit = async (e) => {
        e.preventDefault();
        setKycError("");
        setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/step-4", {
                gst_number: gstForm.gst_number.toUpperCase(),
                client_id: client.clientId,
            });
            setKycStep(4);
        } catch (err) {
            setKycError(err?.response?.data?.message || "GST verification failed.");
        } finally {
            setKycLoading(false);
        }
    };

    const handleFinalSubmit = async () => {
        setKycError("");
        setKycLoading(true);
        try {
            await api.post("/voicelink/kyc/final-submit", { client_id: client.clientId });
            if (kycStorageKey) localStorage.removeItem(kycStorageKey);
            
            // Optimistically mark as submitted to unlock DID list
            markKycAsSubmitted?.(client.clientId);

            refreshCtx?.();
            await load();
        } catch (err) {
            setKycError(err?.response?.data?.message || "Final KYC submission failed.");
        } finally {
            setKycLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    if (pageLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
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

    // No client → redirect to buy
    if (!client) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center space-y-4">
                <Phone className="h-12 w-12 text-gray-300 mx-auto" />
                <h2 className="text-lg font-semibold text-gray-700">No Client Setup Found</h2>
                <p className="text-sm text-gray-500">Purchase a DID number first to get started.</p>
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">DID Numbers</h1>
                    <p className="text-sm text-gray-500">
                        {isKycComplete || isKycSubmitted ? "Select and assign DID numbers to your client" : "Complete KYC to unlock DID number selection"}
                    </p>
                </div>
                {/* Client status badge */}
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold
                    ${isKycComplete ? "bg-green-100 text-green-700" : 
                      isKycSubmitted ? "bg-amber-100 text-amber-700 border border-amber-200" :
                      "bg-amber-100 text-amber-700"}`}>
                    {isKycComplete ? "KYC Approved" : isKycSubmitted ? "KYC In Progress" : "KYC Pending"}
                </span>
            </div>

            {/* ── KYC not complete: show inline KYC wizard ── */}
            {!isKycComplete && !isKycSubmitted && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    {/* KYC header + step bar */}
                    <div className="px-6 py-5 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-5 w-5 text-amber-500" />
                            <h2 className="text-base font-semibold text-gray-900">KYC Management</h2>
                        </div>
                        <div className="flex items-center">
                            {kycSteps.map((label, i) => {
                                const isDone   = visualIdx > i;
                                const isActive = visualIdx === i;
                                return (
                                    <div key={i} className="flex items-center flex-1 last:flex-none">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                ${isDone   ? "bg-indigo-600 text-white" :
                                                  isActive ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                                                             "bg-gray-100 text-gray-400"}`}>
                                                {isDone ? "✓" : i + 1}
                                            </div>
                                            <span className={`text-[10px] font-medium text-center w-16 leading-tight
                                                ${isDone || isActive ? "text-indigo-600" : "text-gray-400"}`}>
                                                {label}
                                            </span>
                                        </div>
                                        {i < kycSteps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-5 ${isDone ? "bg-indigo-600" : "bg-gray-200"}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* KYC step content */}
                    <div className="p-6 space-y-5">
                        {kycError && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start">
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{kycError}</span>
                            </div>
                        )}

                        {/* Step 0 — Register Details */}
                        {kycStep === 0 && (
                            <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Register Details</h3>
                                <Field label="Account Type" required>
                                    <select
                                        value={regForm.account_type}
                                        onChange={(e) => setRegForm(p => ({ ...p, account_type: e.target.value }))}
                                        className={`${inputCls} bg-white`}
                                    >
                                        <option value="individual">Individual</option>
                                        <option value="business">Business</option>
                                    </select>
                                </Field>
                                {regForm.account_type === "business" && (
                                    <Field label="Business Name" required>
                                        <input
                                            value={regForm.business_name} required
                                            onChange={(e) => setRegForm(p => ({ ...p, business_name: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Full Legal Name" required>
                                        <input
                                            value={regForm.full_name} required
                                            onChange={(e) => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Email" required>
                                        <input
                                            type="email" value={regForm.email} required
                                            onChange={(e) => setRegForm(p => ({ ...p, email: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Phone" required>
                                        <input
                                            value={regForm.phone} required placeholder="+91XXXXXXXXXX"
                                            onChange={(e) => setRegForm(p => ({ ...p, phone: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <Field label="Billing Address" required>
                                    <textarea
                                        value={regForm.billing_address} required rows={2}
                                        onChange={(e) => setRegForm(p => ({ ...p, billing_address: e.target.value }))}
                                        className={`${inputCls} resize-none`}
                                        placeholder="123 Main St, City, State, PIN"
                                    />
                                </Field>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox" required
                                        checked={regForm.term_and_condition}
                                        onChange={(e) => setRegForm(p => ({ ...p, term_and_condition: e.target.checked }))}
                                        className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">
                                        I accept VoiceLink Terms of Service and telecom compliance requirements
                                    </span>
                                </label>
                                <div className="flex justify-end pt-2 border-t border-gray-100">
                                    <SubmitBtn loading={kycLoading} label="Save & Continue" />
                                </div>
                            </form>
                        )}

                        {/* Step 1 — PAN Verify */}
                        {kycStep === 1 && (
                            <form onSubmit={handlePanSubmit} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">PAN Verification</h3>
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-1">
                                    <p className="font-semibold">How to find your exact PAN name:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                                        <li>Enter the name <span className="font-semibold">exactly as printed on your PAN card</span></li>
                                        <li>Verify at <span className="font-mono font-semibold">incometax.gov.in</span> using your PAN number</li>
                                        <li>South Indian names: try <span className="font-mono">INITIAL FIRSTNAME</span> (e.g. <span className="font-mono">J DHARUN</span>)</li>
                                    </ul>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="PAN Number" required>
                                        <input
                                            value={panForm.pan_number} required placeholder="ABCDE1234F" maxLength={10}
                                            onChange={(e) => setPanForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Name on PAN Card" required>
                                        <input
                                            value={panForm.pan_holder_name} required
                                            placeholder="Exactly as on PAN card"
                                            onChange={(e) => setPanForm(p => ({ ...p, pan_holder_name: e.target.value.toUpperCase() }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <p className="text-[11px] text-gray-500">
                                    Name is auto-uppercased. Must match NSDL records exactly — even a single letter difference will fail.
                                </p>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button" onClick={() => { setKycError(""); setKycStep(0); }}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                        ← Back
                                    </button>
                                    <SubmitBtn loading={kycLoading} label="Verify PAN" />
                                </div>
                            </form>
                        )}

                        {/* Step 2 — Aadhaar */}
                        {kycStep === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Aadhaar Verification</h3>
                                <p className="text-sm text-gray-600">
                                    Aadhaar is verified via DigiLocker. Initiate below, complete in your browser, then check status.
                                </p>
                                {!aadhaarUrl ? (
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <button type="button" onClick={() => { setKycError(""); setKycStep(1); }}
                                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                            ← Back
                                        </button>
                                        <button onClick={initiateAadhaar} disabled={kycLoading}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                            {kycLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {kycLoading ? "Initiating..." : "Initiate Aadhaar Verification"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-2">
                                            <p className="font-semibold">DigiLocker Link Ready</p>
                                            <p className="text-xs text-blue-700">Open the link below, complete Aadhaar verification, then click "I've Completed".</p>
                                            <a href={aadhaarUrl} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Open DigiLocker
                                            </a>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                            <button type="button" onClick={() => { setKycError(""); setAadhaarUrl(""); setKycStep(1); }}
                                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                                ← Back
                                            </button>
                                            <button onClick={checkAadhaarStatus} disabled={checkingAadhaar}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                                {checkingAadhaar && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {checkingAadhaar ? "Checking..." : "I've Completed Aadhaar — Check Status"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3 (business only) — GST */}
                        {kycStep === 3 && accountType === "business" && (
                            <form onSubmit={handleGstSubmit} className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">GST Verification</h3>
                                <Field label="GSTIN" required>
                                    <input
                                        value={gstForm.gst_number} required
                                        placeholder="22AAAAA0000A1Z5" maxLength={15}
                                        onChange={(e) => setGstForm({ gst_number: e.target.value })}
                                        className={inputCls}
                                    />
                                </Field>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button" onClick={() => { setKycError(""); setKycStep(2); }}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                        ← Back
                                    </button>
                                    <SubmitBtn loading={kycLoading} label="Verify GST" />
                                </div>
                            </form>
                        )}

                        {/* Final Submit */}
                        {isFinalStep && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-800">Final KYC Submission</h3>
                                <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                                    All verification steps complete. Click below to finalise and submit your KYC.
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <button type="button"
                                        onClick={() => { setKycError(""); setKycStep(accountType === "business" ? 3 : 2); }}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                        ← Back
                                    </button>
                                    <button onClick={handleFinalSubmit} disabled={kycLoading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                                        {kycLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {kycLoading ? "Submitting..." : "Submit KYC"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* KYC Submitted but not yet approved */}
            {!isKycComplete && isKycSubmitted && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
                    <div className="relative mx-auto h-16 w-16">
                        <Shield className="h-16 w-16 text-amber-400 opacity-20" />
                        <Loader2 className="absolute inset-0 h-16 w-16 text-amber-500 animate-spin stroke-[1.5]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-gray-900">KYC In Progress</h2>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                            Your KYC documents have been submitted successfully. 
                            VoiceLink is currently processing your verification. 
                            <strong> This usually takes 5-10 minutes.</strong>
                        </p>
                    </div>
                    <div className="pt-4">
                        <button onClick={load} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <RefreshCw className="h-4 w-4" /> Check Status Now
                        </button>
                    </div>
                </div>
            )}

            {/* ── KYC complete (or submitted): DID selection ── */}
            {(isKycComplete || isKycSubmitted) && !mapped && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Available DID Numbers</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Select up to {maxDids} DID{maxDids !== 1 ? "s" : ""}
                                {" "}({selectedDids.length}/{maxDids} selected)
                            </p>
                        </div>
                        <button
                            onClick={handleMapDids}
                            disabled={selectedDids.length === 0 || mapping}
                            className="flex items-center gap-2 shrink-0 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {mapping && <Loader2 className="h-4 w-4 animate-spin" />}
                            {mapping ? "Assigning..." : `Assign ${selectedDids.length} DID${selectedDids.length !== 1 ? "s" : ""}`}
                        </button>
                    </div>

                    {mapError && (
                        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{mapError}</span>
                        </div>
                    )}

                    {availableDids.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-gray-500">
                            No available DIDs found. Contact your reseller to purchase DID numbers first.
                        </p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {availableDids.map((did) => {
                                const isSelected = selectedDids.includes(did.did_id);
                                const isDisabled = !isSelected && selectedDids.length >= maxDids;
                                return (
                                    <label
                                        key={did.did_id}
                                        className={`flex items-center gap-4 px-6 py-4 transition-colors
                                            ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onChange={() => toggleDid(did.did_id)}
                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{did.did_number}</p>
                                            <p className="text-xs text-gray-500">
                                                {did.type_label} · {did.country_code} · Expires {did.expiry_date}
                                            </p>
                                        </div>
                                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                            {did.user_status_label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Mapping success */}
            {isKycComplete && mapped && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
                    <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
                    <h2 className="text-lg font-bold text-gray-900">DID Numbers Assigned!</h2>
                    <p className="text-sm text-gray-600">
                        {selectedDids.length} DID{selectedDids.length !== 1 ? "s have" : " has"} been successfully assigned to your client account.
                    </p>
                    <button
                        onClick={() => navigate("/voicelink/profile")}
                        className="flex items-center gap-2 mx-auto px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Hash className="h-4 w-4" />
                        Back to Profile
                    </button>
                </div>
            )}
        </div>
    );
};

export default DIDNumbersPage;
