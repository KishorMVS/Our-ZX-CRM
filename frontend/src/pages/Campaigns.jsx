import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Megaphone, MessageSquare, Phone, Upload, Loader2, CheckCircle2, AlertCircle, Key, Rocket, History, Settings, Check, RefreshCw, Users } from "lucide-react";
import api from "../api/axios";

// ─── Utility: parse XLSX/CSV client-side ───────────────────────────────────
function normalizePhone(phone) {
    if (!phone) return "";
    let p = String(phone).replace(/\s+/g, "").replace(/['"]/g, "");
    if (p.startsWith("0")) p = "+91" + p.substring(1);
    else if (p.length === 10 && /^\d+$/.test(p)) p = "+91" + p;
    else if (/^\d+$/.test(p) && !p.startsWith("+")) p = "+" + p;
    return p;
}

async function parseContactFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isXlsx = file.name.endsWith('.xlsx');
        reader.onload = (e) => {
            try {
                let recipientData = [];
                let numbers = [];
                if (isXlsx) {
                    if (!window.XLSX) return reject("Excel library loading...");
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    const startRow = (isNaN(parseInt(rows[0][0])) && rows[0][0]) ? 1 : 0;
                    for (let i = startRow; i < rows.length; i++) {
                        let phone = normalizePhone(rows[i][0]);
                        if (phone.length > 5) {
                            numbers.push(phone);
                            recipientData.push({ phone, name: String(rows[i][1] || ""), city: String(rows[i][2] || "") });
                        }
                    }
                } else {
                    const text = e.target.result;
                    const rows = text.split(/\r?\n/).filter(Boolean);
                    const startRow = isNaN(parseInt(rows[0].split(",")[0])) ? 1 : 0;
                    for (let i = startRow; i < rows.length; i++) {
                        const cols = rows[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
                        let phone = normalizePhone(cols[0]);
                        if (phone) { numbers.push(phone); recipientData.push({ phone, name: cols[1] || "", city: cols[2] || "" }); }
                    }
                }
                if (numbers.length === 0) return reject("No numbers found");
                resolve({ numbers, recipientData });
            } catch (err) { reject("File parsing error"); }
        };
        if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    });
}

// ─── Sub-components ────────────────────────────────────────────────────────
function CSVPreview({ file }) {
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!file) return;
        setLoading(true);
        const reader = new FileReader();
        const isXlsx = file.name.endsWith('.xlsx');

        reader.onload = (e) => {
            try {
                let headers = [];
                let rows = [];
                if (isXlsx) {
                    if (!window.XLSX) {
                        setLoading(false);
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const allRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    if (allRows.length > 0) {
                        headers = allRows[0].map(h => String(h || "").trim());
                        rows = allRows.slice(1, 11).map(r => r.map((c, idx) => idx === 0 ? normalizePhone(c) : String(c || "")));
                    }
                } else {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/).filter(Boolean);
                    if (lines.length > 0) {
                        headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
                        rows = lines.slice(1, 11).map(l => l.split(",").map((c, idx) => idx === 0 ? normalizePhone(c) : c.trim().replace(/['"]/g, "")));
                    }
                }
                setPreviewData({ headers, rows });
            } catch (err) { console.error("Preview error:", err); }
            setLoading(false);
        };
        if (isXlsx) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    }, [file]);

    if (loading) return <div className="p-4 text-center text-xs animate-pulse">Reading file...</div>;
    if (!previewData) return null;

    return (
        <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-[10px] text-left">
                <thead className="bg-gray-50 text-gray-400">
                    <tr>{previewData.headers.map((h, i) => <th key={i} className="px-3 py-2 font-bold uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {previewData.rows.map((row, i) => (
                        <tr key={i}>{row.map((c, j) => <td key={j} className="px-3 py-1.5 text-gray-600">{c}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }) {
    const s = status?.toLowerCase() || "pending";
    const colors = {
        running: "bg-indigo-100 text-indigo-700",
        completed: "bg-emerald-100 text-emerald-700",
        failed: "bg-red-100 text-red-700",
        uploaded: "bg-blue-100 text-blue-700",
        processing: "bg-amber-100 text-amber-700",
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors[s] || "bg-gray-100 text-gray-500"}`}>{s.toUpperCase()}</span>;
}

// ─── Voice Call Campaigns ──────────────────────────────────────────────────
function CallCampaigns({ platformToken, setPlatformToken, assistantId, setAssistantId, refreshHistory, preloadedLeads }) {
    const [assistants, setAssistants] = useState([]);
    const [phoneNumbers, setPhoneNumbers] = useState([]);
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showPreview, setShowPreview] = useState(false);

    const handleAuthorize = async () => {
        if (!platformToken.trim()) return setError("Please enter Platform Token");
        setIsAuthorizing(true); setError("");
        try {
            const token = platformToken.replace("Bearer ", "");
            const [asstRes, numRes] = await Promise.all([
                api.get("/campaign-proxy/assistants", { headers: { "X-Platform-Token": token } }),
                api.get("/campaign-proxy/registered-numbers", { headers: { "X-Platform-Token": token } })
            ]);
            setAssistants(Array.isArray(asstRes.data) ? asstRes.data : (asstRes.data.assistants || []));
            setPhoneNumbers(Array.isArray(numRes.data) ? numRes.data : (numRes.data.numbers || []));
            setIsAuthorized(true);
        } catch (err) { setError("Authorization failed. Check your token."); } finally { setIsAuthorizing(false); }
    };

    useEffect(() => {
        if (preloadedLeads && selectedPhoneNumber) {
            const csv = ["assistant-phone,customer-phone,name", ...preloadedLeads.map(l => `${selectedPhoneNumber},${normalizePhone(l.phone)},${l.name || ""}`)].join("\n");
            setFile(new File([new Blob([csv], { type: "text/csv" })], `leads_${preloadedLeads.length}.csv`));
        }
    }, [preloadedLeads, selectedPhoneNumber]);

    const handleRun = async () => {
        if (!assistantId) return setError("Please select an Assistant");
        if (!selectedPhoneNumber) return setError("Please select a Phone Number (the outgoing line)");
        if (!file) return setError("Please upload a contact file");
        setLoading(true); setError(""); setSuccess("");
        try {
            // Parse the CSV client-side to find the customer-phone column
            // (col 0 is assistant-phone; col 1 is customer-phone in the expected format)
            let customerPhones = [];
            try {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(Boolean);
                if (lines.length > 1) {
                    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"/]/g, ""));
                    // Find the customer-phone column index (prefer explicit label, fall back to any phone col)
                    const customerIdx = headers.findIndex(h => h.includes("customer"));
                    const phoneIdx = customerIdx >= 0 ? customerIdx
                        : headers.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("number"));

                    if (phoneIdx >= 0) {
                        for (let i = 1; i < lines.length; i++) {
                            const cols = lines[i].split(",").map(c => c.trim().replace(/['"/]/g, ""));
                            const phone = normalizePhone(cols[phoneIdx]);
                            if (phone.length > 5) customerPhones.push(phone);
                        }
                    }
                }
            } catch (parseErr) {
                console.error("CSV parse error (non-blocking):", parseErr);
            }

            const form = new FormData();
            form.append("assistant-id", assistantId);
            form.append("phone-number", selectedPhoneNumber);
            form.append("file", file);

            const { data: uploadData } = await api.post("/campaign-proxy/upload", form, {
                headers: { "Content-Type": "multipart/form-data", "X-Platform-Token": platformToken }
            });

            await api.post("/campaign-proxy/run", {
                dbId: uploadData.dbId,
                assistantId,
                fromPhoneNumber: selectedPhoneNumber,   // the registered outgoing number
                phoneNumber: customerPhones[0] || "",   // first customer phone from CSV
                customerPhones,                         // full list for backend fallback
            }, {
                headers: { "X-Platform-Token": platformToken }
            });
            setSuccess("Campaign launched successfully!"); refreshHistory();
        } catch (err) { setError(err?.response?.data?.message || "Launch failed"); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Key className="h-4 w-4 text-indigo-500" /> Platform Token</label>
                <div className="flex gap-3">
                    <input type="password" value={platformToken} onChange={e => { setPlatformToken(e.target.value); setIsAuthorized(false); }} placeholder="Paste Voice API Token..." className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                    <button onClick={handleAuthorize} disabled={isAuthorizing || !platformToken} className={`px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isAuthorized ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white shadow-lg'}`}>
                        {isAuthorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAuthorized ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />)}
                        {isAuthorized ? "Authorized" : "Authorize"}
                    </button>
                </div>

                {isAuthorized && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Select Assistant</label>
                            <select value={assistantId} onChange={e => setAssistantId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                                <option value="">Choose Assistant...</option>
                                {assistants.map(a => (
                                    <option key={a.id || a.uuid} value={a.id || a.uuid}>
                                        {a.name || a.assistantName || (a.id || a.uuid).slice(0, 8) + "..."}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Phone Number</label>
                            <div className="relative">
                                <select
                                    value={selectedPhoneNumber}
                                    onChange={e => setSelectedPhoneNumber(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                                >
                                    <option value="">{phoneNumbers.length > 0 ? "Choose Phone..." : "No numbers found"}</option>
                                    {phoneNumbers.map((n, i) => {
                                        const val = n.phoneNumber || n.number || n.phoneNo || n.phone || (typeof n === 'string' ? n : "");
                                        return <option key={i} value={val}>{val}</option>;
                                    })}
                                </select>
                                {phoneNumbers.length === 0 && (
                                    <p className="text-[10px] text-indigo-500 mt-1 pl-1 italic">
                                        Tip: Ensure you have numbers registered in your ZenVoice dashboard.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="border-2 border-dashed border-gray-100 rounded-2xl p-8 text-center relative bg-gray-50/20 hover:border-indigo-100 transition-all">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files[0])} accept=".csv,.xlsx" />
                    <Upload className="h-8 w-8 text-indigo-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-900">{file ? file.name : "Drop contact list here or click to browse"}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase">assistant-phone, customer-phone</p>
                </div>
                {file && (
                    <div className="flex justify-end pr-2">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            <Settings className="h-3 w-3" /> {showPreview ? "Hide Preview" : "Preview Leads"}
                        </button>
                    </div>
                )}
                {showPreview && file && <CSVPreview file={file} />}
            </div>

            {error && <p className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</p>}
            {success && <p className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {success}</p>}

            <div className="flex justify-end">
                <button onClick={handleRun} disabled={loading} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Run Campaign
                </button>
            </div>
        </div>
    );
}

// ─── WhatsApp Chat Campaigns ───────────────────────────────────────────────
function ChatCampaigns({ chatPlatformToken, setChatPlatformToken, assistantId, setAssistantId, refreshHistory, preloadedLeads }) {
    const [campaignName, setCampaignName] = useState("");
    const [message, setMessage] = useState("");
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (preloadedLeads) {
            setCampaignName(`Exported leads - ${new Date().toLocaleDateString()}`);
            setFile(new File([new Blob(["phone,name,city"], { type: "text/csv" })], `${preloadedLeads.length}_leads_Search.csv`));
        }
    }, [preloadedLeads]);

    const handleSend = async () => {
        if (!campaignName.trim()) return setError("Please enter campaign name");
        if (!file) return setError("Please upload contact list");
        setLoading(true); setError("");
        try {
            let recipientData;
            if (preloadedLeads) {
                recipientData = preloadedLeads.map(l => ({
                    phoneNumber: normalizePhone(l.phone),
                    variables: { name: l.name || "" }
                }));
            } else {
                const parsed = await parseContactFile(file);
                recipientData = parsed.recipientData.map(r => ({
                    phoneNumber: normalizePhone(r.phone),
                    variables: { name: r.name || "" }
                }));
            }

            const payload = {
                name: campaignName,
                assistantId: assistantId || "default",
                message: message.trim() || undefined,
                templateName: message.trim() ? undefined : "hello_world",
                language: message.trim() ? undefined : "en_US",
                recipientData
            };

            await api.post("/campaign-proxy/chat/send", payload, {
                headers: { "X-Platform-Token": chatPlatformToken }
            });
            refreshHistory(); setCampaignName(""); setFile(null);
        } catch (err) { setError(err?.response?.data?.message || "Send failed"); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Campaign Name</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Summer Promo" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                        <Key className="h-4 w-4 text-emerald-500" /> Chat Platform Token
                    </label>
                    <input type="password" value={chatPlatformToken} onChange={e => setChatPlatformToken(e.target.value)} placeholder="WhatsApp API Token (zen_...)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-500" /> WhatsApp Assistant ID
                    </label>
                    <input value={assistantId} onChange={e => setAssistantId(e.target.value)} placeholder="Enter Assistant ID (e.g. e7da0da...)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
            </div>
            <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Message Body</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your WhatsApp message..." className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm h-24 resize-none" />
            </div>
            <div className="border border-dashed border-gray-200 rounded-xl px-6 py-6 bg-gray-50/20 text-center relative">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files[0])} />
                <div className="flex flex-col items-center">
                    <MessageSquare className="h-6 w-6 text-emerald-400 mb-2" />
                    <span className="text-sm font-bold text-gray-900">{file ? file.name : "Upload .xlsx or .csv List"}</span>
                </div>
                {file && (
                    <div className="mt-4 flex items-center justify-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[10px] font-black uppercase text-red-500 hover:underline">Remove</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview); }}
                            className="text-[10px] font-black uppercase text-indigo-500 hover:underline"
                        >
                            {showPreview ? "Hide Preview" : "Preview Leads"}
                        </button>
                    </div>
                )}
            </div>

            {showPreview && file && (
                <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-inner max-h-60 overflow-y-auto">
                    <CSVPreview file={file} />
                </div>
            )}

            {preloadedLeads && !file && (
                <div className="border border-indigo-100 rounded-2xl p-4 bg-indigo-50/30">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-indigo-500">Search Results Preview</span>
                        <button onClick={() => setShowPreview(!showPreview)} className="text-[10px] font-black uppercase text-indigo-500 hover:underline">
                            {showPreview ? "Hide" : "Show"}
                        </button>
                    </div>
                    {showPreview && (
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-white border-b border-indigo-50">
                                <tr><th className="px-3 py-2 text-gray-400 font-black uppercase">Phone</th><th className="px-3 py-2 text-gray-400 font-black uppercase">Name</th></tr>
                            </thead>
                            <tbody>
                                {preloadedLeads.slice(0, 5).map((l, idx) => (
                                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                                        <td className="px-3 py-2 font-bold text-emerald-600">{normalizePhone(l.phone)}</td>
                                        <td className="px-3 py-2 text-gray-900">{l.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">{error}</p>}
            <div className="flex justify-end">
                <button onClick={handleSend} disabled={loading} className="bg-emerald-600 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Send Bulk Messages
                </button>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Campaigns() {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(location.state?.tab || "call");
    const [assistantId, setAssistantId] = useState("0c3d3843-e720-4bd1-b182-17c15616329e");
    const [platformToken, setPlatformToken] = useState(localStorage.getItem("voice_platform_token") || "");
    const [chatPlatformToken, setChatPlatformToken] = useState(localStorage.getItem("chat_platform_token") || "");
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try { const { data } = await api.get("/campaign-proxy"); setHistory(data); } catch { } finally { setHistoryLoading(false); }
    };

    useEffect(() => {
        fetchHistory();
        const poll = setInterval(fetchHistory, 15000); // Sync data every 15s
        return () => clearInterval(poll);
    }, []);
    useEffect(() => { localStorage.setItem("voice_platform_token", platformToken); }, [platformToken]);
    useEffect(() => { localStorage.setItem("chat_platform_token", chatPlatformToken); }, [chatPlatformToken]);

    const preloadedLeads = location.state?.leads;

    return (
        <div className="max-w-6xl mx-auto py-10 px-8 font-sans min-h-screen">
            <header className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Megaphone className="h-7 w-7 text-[#5046e5]" />
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Campaign Manager</h1>
                </div>
                <p className="text-sm text-gray-500">Launch and track your bulk outreach across platforms.</p>
                {preloadedLeads && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-indigo-900 text-sm font-bold">
                        <span>🚀 Imported {preloadedLeads.length} leads from Search. Ready to launch.</span>
                        <button onClick={() => navigate(".", { replace: true, state: {} })} className="text-indigo-600 hover:underline">Clear</button>
                    </div>
                )}
            </header>

            <div className="flex bg-gray-100 p-1 rounded-2xl w-fit mb-10">
                <button onClick={() => setActiveTab("call")} className={`px-10 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'call' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                    Voice Call
                </button>
                <button onClick={() => setActiveTab("chat")} className={`px-10 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}>
                    WhatsApp Chat
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 shadow-xl shadow-black/[0.02] p-10">
                    {activeTab === "call" ? (
                        <CallCampaigns platformToken={platformToken} setPlatformToken={setPlatformToken} assistantId={assistantId} setAssistantId={setAssistantId} refreshHistory={fetchHistory} preloadedLeads={preloadedLeads} />
                    ) : (
                        <ChatCampaigns
                            chatPlatformToken={chatPlatformToken}
                            setChatPlatformToken={setChatPlatformToken}
                            assistantId={assistantId}
                            setAssistantId={setAssistantId}
                            refreshHistory={fetchHistory}
                            preloadedLeads={preloadedLeads}
                        />
                    )}
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-tight">
                            <History className="h-4 w-4 text-indigo-500" /> Recent History
                        </div>
                        <button onClick={fetchHistory} className="text-xs font-bold text-indigo-600 hover:underline">Sync</button>
                    </div>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {historyLoading && <p className="text-center text-xs text-gray-400 italic">Reading database...</p>}
                        {history.filter(c => c.type === (activeTab === 'call' ? 'CALL' : 'CHAT')).map(camp => (
                            <div key={camp.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-indigo-100 group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${camp.type === 'CHAT' ? 'text-emerald-500' : 'text-indigo-500'}`}>{camp.type}</span>
                                    <StatusBadge status={camp.status} />
                                </div>
                                <div className="text-xs font-extrabold text-gray-900 truncate mb-1">
                                    {camp.type === 'CHAT' ? (camp.name || "WhatsApp Blast") : `Voice: ${camp.assistantId.slice(0, 8)}...`}
                                </div>

                                {/* Unified Queue Progress Bar */}
                                {(camp.status === 'RUNNING' || camp.status === 'PROCESSING') && (
                                    <div className="mt-2 mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Queue Progress</span>
                                            <span className="text-[9px] font-black text-indigo-600">Active</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 animate-[pulse_2s_infinite] rounded-full" style={{ width: '45%' }} />
                                        </div>
                                    </div>
                                )}

                                <div className="text-[10px] text-gray-400 font-bold flex justify-between">
                                    <span>{new Date(camp.createdAt).toLocaleDateString()}</span>
                                    <span>{camp.imported} Contacts</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }`}</style>
        </div >
    );
}
