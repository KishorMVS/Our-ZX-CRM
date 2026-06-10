import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
    Clock, Play, Pause, Search, Filter, ChevronLeft, ChevronRight,
    TrendingUp, Calendar, Users, BarChart2, AlertCircle, RefreshCw,
    CheckCircle2, Trophy, Zap,
    FileText, Mic, X, ChevronDown, ChevronUp, MessageSquare, ThumbsUp, Heart, Loader2,
    Link2, KeyRound, Eye, EyeOff, Unplug, WifiOff,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const normalizePhone = (p) => (p || "").replace(/\D/g, "").slice(-10);
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

const today   = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; };

const fmt = (secs) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
};

const fmtDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

const getCallType = (call) => {
    if (call.inbound  &&  call.answered) return "incoming";
    if (call.inbound  && !call.answered) return "missed";
    if (!call.inbound &&  call.answered) return "outgoing";
    return "outgoing_missed";
};

const callTypeLabel = (t) => ({
    incoming: "Incoming", outgoing: "Outgoing", missed: "Missed", outgoing_missed: "No Answer",
}[t] || t);

const callTypeBadge = (call) => {
    const t = getCallType(call);
    const map = {
        incoming:        "bg-green-100 text-green-700",
        outgoing:        "bg-indigo-100 text-indigo-700",
        missed:          "bg-red-100 text-red-700",
        outgoing_missed: "bg-orange-100 text-orange-700",
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[t] || "bg-gray-100 text-gray-600"}`}>
            {callTypeLabel(t)}
        </span>
    );
};

const dirIcon = (call) => {
    const t = getCallType(call);
    if (t === "incoming") return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    if (t === "outgoing") return <PhoneOutgoing  className="h-4 w-4 text-indigo-500" />;
    if (t === "missed")   return <PhoneMissed    className="h-4 w-4 text-red-500" />;
    return <PhoneMissed className="h-4 w-4 text-orange-400" />;
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
            <p className="text-sm text-gray-500">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

const Tab = ({ label, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            active ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
    >
        <Icon className="h-4 w-4" />
        {label}
    </button>
);

const Empty = ({ message = "No data found" }) => (
    <div className="p-10 text-center">
        <Phone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">{message}</p>
    </div>
);

const Loading = () => (
    <div className="p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
    </div>
);

const InlineError = ({ msg }) => (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{msg || "Failed to load data. Please try again."}</span>
    </div>
);

// ── Not Connected State ───────────────────────────────────────────────────────
const NotConnected = ({ onConnect }) => (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="bg-gray-100 rounded-full p-6 mb-6">
            <WifiOff className="h-12 w-12 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">FasterQ Not Connected</h2>
        <p className="text-gray-500 text-sm max-w-sm mb-6 leading-relaxed">
            Connect your FasterQ account to view call analytics, recordings, and agent performance data from your SIM card calls.
        </p>
        <button
            onClick={onConnect}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
            <Link2 className="h-4 w-4" />
            Connect FasterQ
        </button>
    </div>
);

// ── API Integration Modal ─────────────────────────────────────────────────────
const ApiIntegrationModal = ({ onClose, currentMasked, isConnected }) => {
    const queryClient = useQueryClient();
    const [apiKey, setApiKey]     = useState("");
    const [showKey, setShowKey]   = useState(false);
    const [error, setError]       = useState("");

    const saveMutation = useMutation({
        mutationFn: (key) => api.post("/fasterq/settings", { apiKey: key }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fasterq-settings"] });
            queryClient.invalidateQueries({ queryKey: ["fq-analytics"] });
            onClose(true);
        },
        onError: (err) => {
            setError(err.response?.data?.message || "Failed to save API key");
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: () => api.delete("/fasterq/settings"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fasterq-settings"] });
            queryClient.invalidateQueries({ queryKey: ["fq-analytics"] });
            onClose(false);
        },
        onError: (err) => {
            setError(err.response?.data?.message || "Failed to disconnect");
        },
    });

    const handleSave = () => {
        setError("");
        if (!apiKey.trim()) { setError("Please enter your FasterQ API key"); return; }
        saveMutation.mutate(apiKey.trim());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => onClose(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Link2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">FasterQ Integration</h3>
                            <p className="text-indigo-100 text-xs">Connect your FasterQ account</p>
                        </div>
                    </div>
                    <button onClick={() => onClose(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Current status */}
                    {isConnected && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-green-800">Connected</p>
                                <p className="text-xs text-green-600 font-mono truncate">{currentMasked}</p>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-800 space-y-1">
                        <p className="font-semibold mb-2 flex items-center gap-1.5">
                            <KeyRound className="h-4 w-4" /> How to get your API key
                        </p>
                        <ol className="space-y-1 text-xs text-indigo-700 list-decimal list-inside">
                            <li>Log in to your FasterQ account at fasterq.in</li>
                            <li>Go to Settings → API Integration</li>
                            <li>Copy the API key and paste it below</li>
                        </ol>
                    </div>

                    {/* API key input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {isConnected ? "Replace API Key" : "FasterQ API Key"}
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={e => { setApiKey(e.target.value); setError(""); }}
                                placeholder="Paste your FasterQ API key here…"
                                className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {error && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {error}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                        >
                            {saveMutation.isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                                : <><CheckCircle2 className="h-4 w-4" /> {isConnected ? "Update Key" : "Connect"}</>
                            }
                        </button>
                        {isConnected && (
                            <button
                                onClick={() => disconnectMutation.mutate()}
                                disabled={disconnectMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-60 transition-colors"
                            >
                                <Unplug className="h-4 w-4" />
                                {disconnectMutation.isPending ? "…" : "Disconnect"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Transcription components ──────────────────────────────────────────────────
const BADGE_COLORS = {
    Good: "bg-green-100 text-green-800", Bad: "bg-red-100 text-red-800",
    Neutral: "bg-gray-100 text-gray-800", Professional: "bg-blue-100 text-blue-800",
    Casual: "bg-amber-100 text-amber-800", Frustrated: "bg-red-100 text-red-800",
    Polite: "bg-emerald-100 text-emerald-800", Aggressive: "bg-rose-100 text-rose-800",
    High: "bg-red-100 text-red-800", Medium: "bg-amber-100 text-amber-800",
    Low: "bg-green-100 text-green-800", Calm: "bg-blue-100 text-blue-800",
    Angry: "bg-red-100 text-red-800", Happy: "bg-green-100 text-green-800",
    Complaint: "bg-red-100 text-red-800", Inquiry: "bg-blue-100 text-blue-800",
    "Follow-up": "bg-purple-100 text-purple-800", Sales: "bg-emerald-100 text-emerald-800",
    Support: "bg-amber-100 text-amber-800", General: "bg-gray-100 text-gray-800",
};

const Badge = ({ label, value }) => {
    if (!value || value === "Neutral") return null;
    const color = BADGE_COLORS[value] || "bg-gray-100 text-gray-800";
    return (
        <div className="flex flex-col">
            <span className="text-xs text-gray-500 mb-1">{label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color} inline-block w-fit`}>{value}</span>
        </div>
    );
};

const TranscriptModal = ({ data, onClose }) => {
    const [showFull, setShowFull] = useState(false);
    if (!data) return null;
    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
                <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg"><FileText className="h-6 w-6" /></div>
                            <div>
                                <h3 className="text-xl font-bold">AI Call Analysis</h3>
                                <p className="text-indigo-100 text-xs">FasterQ Call</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
                        <div className="bg-indigo-50/50 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> AI Insights
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <Badge label="Sentiment" value={data.sentiment} />
                                <Badge label="Tone"      value={data.tone} />
                                <Badge label="Urgency"   value={data.urgency} />
                                <Badge label="Category"  value={data.category} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-indigo-600" /> Executive Summary
                            </h4>
                            <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-5 whitespace-pre-wrap">
                                {data.summary || "No summary generated."}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <ThumbsUp className="h-4 w-4 text-green-600" /> Feedback
                                </h4>
                                <div className="text-xs text-gray-600 p-4 bg-green-50/30 rounded-lg border border-green-100">
                                    {data.feedback || "No specific feedback extracted."}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Heart className="h-4 w-4 text-rose-500" /> Conclusion
                                </h4>
                                <div className="text-xs text-gray-600 p-4 bg-rose-50/30 rounded-lg border border-rose-100">
                                    {data.conclusion || "No clear conclusion found."}
                                </div>
                            </div>
                        </div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setShowFull(!showFull)}
                                className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
                            >
                                <span className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-indigo-600" /> Full Transcript
                                </span>
                                {showFull ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {showFull && (
                                <div className="p-5 bg-white border-t border-gray-100">
                                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                                        {data.transcription || data.plainText || "No transcript available."}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <button onClick={onClose} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all">
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Audio Player ──────────────────────────────────────────────────────────────
const AudioPlayer = ({ url }) => {
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState(null);
    const ref = useRef(null);

    if (!url) return <span className="text-gray-400 text-xs">No recording</span>;

    const toggle = () => {
        if (!ref.current) return;
        if (playing) { ref.current.pause(); setPlaying(false); }
        else         { ref.current.play();  setPlaying(true);  }
    };

    return (
        <div className="flex items-center gap-2">
            <audio ref={ref} src={url}
                onEnded={() => setPlaying(false)}
                onError={() => setError("Load failed")}
                onWaiting={() => setLoading(true)}
                onCanPlay={() => setLoading(false)}
                className="hidden" preload="none"
            />
            {error ? (
                <span className="text-red-400 text-xs">⚠ Failed</span>
            ) : (
                <button onClick={toggle}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition-colors">
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {loading ? "Loading…" : playing ? "Pause" : "Play"}
                </button>
            )}
        </div>
    );
};

const TopCard = ({ label, agent, sub, icon: Icon, bg, iconColor }) => {
    if (!agent?.userName) return null;
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
            <div className="flex items-center gap-4">
                <div className={`${bg} p-3 rounded-full`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div>
                    <p className="font-bold text-gray-900">{agent.userName}</p>
                    {agent.userPhone && <p className="text-xs text-gray-400 font-mono">{agent.userPhone}</p>}
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">{sub(agent)}</p>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
const FasterQCalls = () => {
    const { user } = useAuth();
    const isAdmin  = ADMIN_ROLES.includes(user?.role);
    const userPhone = normalizePhone(user?.phone);

    const [tab,      setTab]      = useState("overview");
    const [dateFrom, setDateFrom] = useState(daysAgo(6));
    const [dateTo,   setDateTo]   = useState(today());
    const [histPage, setHistPage] = useState(1);

    const [callTypeFilter, setCallTypeFilter] = useState([]);
    const [searchInput,    setSearchInput]    = useState("");
    const [searchTerm,     setSearchTerm]     = useState("");
    const [agentFilter,    setAgentFilter]    = useState("");

    const [agentDetail,     setAgentDetail]     = useState(null);
    const [agentDetailTab,  setAgentDetailTab]  = useState("overview");
    const [agentDetailPage, setAgentDetailPage] = useState(1);

    const [transcripts,        setTranscripts]        = useState({});
    const [transcribingId,     setTranscribingId]     = useState(null);
    const [selectedTranscript, setSelectedTranscript] = useState(null);

    const [showIntegrationModal, setShowIntegrationModal] = useState(false);

    // ── Settings query ────────────────────────────────────────────────────────
    const { data: settings, isLoading: settingsLoading } = useQuery({
        queryKey: ["fasterq-settings"],
        queryFn: () => api.get("/fasterq/settings").then(r => r.data),
        staleTime: 60_000,
    });

    const isConnected = settings?.connected === true;

    const handleTranscribe = async (call) => {
        const id = call.callId;
        if (transcripts[id]) { setSelectedTranscript({ id, ...transcripts[id] }); return; }
        setTranscribingId(id);
        try {
            const res = await api.post("/fasterq/transcribe", { recordingUrl: call.recUrl }, { timeout: 300000 });
            setTranscripts(prev => ({ ...prev, [id]: res.data }));
            setSelectedTranscript({ id, ...res.data });
        } catch (err) {
            alert("Transcription failed: " + (err.response?.data?.error || err.message));
        } finally {
            setTranscribingId(null);
        }
    };

    // ── Analytics query ───────────────────────────────────────────────────────
    const { data: analyticsData, isLoading: anaLoading, error: anaError } = useQuery({
        queryKey: ["fq-analytics", dateFrom, dateTo],
        queryFn:  () => api.get("/fasterq/analytics", { params: { from: dateFrom, to: dateTo } }).then(r => r.data),
        staleTime: 90_000,
        retry: false,
        enabled: isConnected && (tab === "overview" || tab === "analysis" || tab === "agents"),
    });

    // ── Call History (plain fetch — avoids React Query cache issues) ──────────
    const [callsData,    setCallsData]    = useState(null);
    const [callsLoading, setCallsLoading] = useState(false);
    const [callsError,   setCallsError]   = useState(null);

    useEffect(() => {
        if (tab !== "history" || !isConnected) return;
        let cancelled = false;
        setCallsData(null); setCallsLoading(true); setCallsError(null);
        api.get("/fasterq/calls", {
            params: { from: dateFrom, to: dateTo, page: histPage, limit: 50, userId: agentFilter,
                userPhone: !isAdmin ? userPhone : undefined, _t: Date.now() },
            headers: { "Cache-Control": "no-cache" },
        })
            .then(r => { if (!cancelled) { setCallsData(r.data); setCallsLoading(false); } })
            .catch(e => { if (!cancelled) { setCallsError(e); setCallsLoading(false); } });
        return () => { cancelled = true; };
    }, [tab, dateFrom, dateTo, histPage, agentFilter, isConnected]);

    // ── Agent detail queries ──────────────────────────────────────────────────
    const { data: agentDetailCalls, isLoading: agentDetailLoading } = useQuery({
        queryKey: ["fq-agent-calls", agentDetail?.userId, agentDetail?.userPhone, dateFrom, dateTo, agentDetailPage],
        queryFn: () => api.get("/fasterq/agent-calls", {
            params: { from: dateFrom, to: dateTo, userId: agentDetail?.userId, userPhone: agentDetail?.userPhone, page: agentDetailPage, limit: 25 },
        }).then(r => r.data),
        enabled: isConnected && !!agentDetail && tab === "agents" && agentDetailTab === "history",
        staleTime: 90_000, retry: false,
    });

    const { data: agentStatsCalls, isLoading: agentStatsLoading } = useQuery({
        queryKey: ["fq-agent-stats", agentDetail?.userId, agentDetail?.userPhone, dateFrom, dateTo],
        queryFn: () => api.get("/fasterq/agent-calls", {
            params: { from: dateFrom, to: dateTo, userId: agentDetail?.userId, userPhone: agentDetail?.userPhone, page: 1, limit: 500 },
        }).then(r => r.data),
        enabled: isConnected && !!agentDetail && tab === "agents" && agentDetailTab !== "history",
        staleTime: 90_000, retry: false,
    });

    // ── Derived data ──────────────────────────────────────────────────────────
    const summary     = analyticsData?.summary     || {};
    const daywise     = analyticsData?.daywise     || [];
    const hourly      = analyticsData?.hourly      || [];
    const allAgents   = analyticsData?.agents      || [];
    const agents      = isAdmin ? allAgents : allAgents.filter(a => normalizePhone(a.number || a.phone) === userPhone);
    const topPerf     = analyticsData?.topPerformers || {};
    const longestCall = analyticsData?.longestCall  || null;

    const rawCalls   = Array.isArray(callsData?.data) ? callsData.data : [];
    const totalCalls = callsData?.meta?.total      ?? 0;
    const totalPages = callsData?.meta?.totalPages ?? 1;

    const agentOptions = useMemo(() => {
        const seen = new Map();
        rawCalls.forEach(c => { if (c.userId && !seen.has(c.userId)) seen.set(c.userId, c.userName || c.userId); });
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [rawCalls]);

    const pagedCalls = useMemo(() => {
        return rawCalls.filter(c => {
            const type      = getCallType(c);
            const typeMatch = callTypeFilter.length === 0 || callTypeFilter.includes(type);
            const search    = searchTerm.toLowerCase();
            const textMatch = !search ||
                (c.phonebookName || "").toLowerCase().includes(search) ||
                (c.formattedNumber || c.number || "").includes(search) ||
                (c.userName || "").toLowerCase().includes(search);
            return typeMatch && textMatch;
        });
    }, [rawCalls, callTypeFilter, searchTerm]);

    const handleSearch  = (e) => { e.preventDefault(); setSearchTerm(searchInput); setHistPage(1); };
    const toggleType    = (t) => { setCallTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); setHistPage(1); };
    const clearFilters  = () => { setCallTypeFilter([]); setAgentFilter(""); setSearchTerm(""); setSearchInput(""); setHistPage(1); };
    const hasFilters    = callTypeFilter.length > 0 || agentFilter || searchTerm;

    const isNotConfiguredError = (err) => err?.response?.data?.code === "NOT_CONFIGURED";

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
        <div className="p-6 space-y-5">

            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">FasterQ</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Call analytics powered by FasterQ API</p>
                    </div>
                    {/* Connection status badge */}
                    {!settingsLoading && (
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`} />
                            {isConnected ? "Connected" : "Not connected"}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Date range — only show when connected */}
                    {isConnected && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <input type="date" value={dateFrom}
                                onChange={e => { setDateFrom(e.target.value); setHistPage(1); setAgentDetailPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-gray-400 text-sm">to</span>
                            <input type="date" value={dateTo}
                                onChange={e => { setDateTo(e.target.value); setHistPage(1); setAgentDetailPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    )}

                    {/* Api Integration button */}
                    {isAdmin && (
                        <button
                            onClick={() => setShowIntegrationModal(true)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                                isConnected
                                    ? "border-gray-200 text-gray-700 hover:bg-gray-50"
                                    : "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                        >
                            <Link2 className="h-4 w-4" />
                            Api Integration
                        </button>
                    )}
                </div>
            </div>

            {/* ── Not connected state ── */}
            {!settingsLoading && !isConnected && (
                <div className="bg-white rounded-xl border border-gray-200">
                    <NotConnected onConnect={() => setShowIntegrationModal(true)} />
                </div>
            )}

            {/* ── Connected — show tabs + content ── */}
            {isConnected && (
                <>
                    {/* Tabs */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Tab label="Overview"     icon={TrendingUp} active={tab === "overview"}  onClick={() => setTab("overview")} />
                        <Tab label="Call History" icon={Phone}      active={tab === "history"}   onClick={() => { setTab("history"); setHistPage(1); }} />
                        {isAdmin && <Tab label="Agents" icon={Users} active={tab === "agents"} onClick={() => { setTab("agents"); setAgentDetail(null); setAgentDetailTab("overview"); }} />}
                        <Tab label="Analysis"     icon={BarChart2}  active={tab === "analysis"}  onClick={() => setTab("analysis")} />
                    </div>

                    {/* ── OVERVIEW TAB ── */}
                    {tab === "overview" && (
                        <div className="space-y-5">
                            {anaError && !isNotConfiguredError(anaError) && <InlineError msg={anaError.message} />}
                            {anaLoading ? <Loading /> : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <StatCard icon={Phone}        label="Total Calls"  value={summary.total}         color="bg-indigo-500" />
                                        <StatCard icon={CheckCircle2} label="Answered"     value={summary.answered}
                                            sub={summary.total ? `${Math.round((summary.answered / summary.total) * 100)}% rate` : ""}
                                            color="bg-green-500" />
                                        <StatCard icon={PhoneMissed}  label="Missed"       value={summary.missedInbound} color="bg-red-500" />
                                        <StatCard icon={Clock}        label="Avg Duration" value={fmt(summary.avgDuration)}
                                            sub={`Total: ${fmt(summary.totalDuration)}`}   color="bg-amber-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                                            <PhoneIncoming className="h-8 w-8 text-green-500" />
                                            <div>
                                                <p className="text-xl font-bold text-gray-900">{summary.inbound ?? "—"}</p>
                                                <p className="text-sm text-gray-500">Inbound calls</p>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                                            <PhoneOutgoing className="h-8 w-8 text-indigo-500" />
                                            <div>
                                                <p className="text-xl font-bold text-gray-900">{summary.outbound ?? "—"}</p>
                                                <p className="text-sm text-gray-500">Outbound calls</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                                    <h2 className="font-semibold text-gray-800">Calls Per Day</h2>
                                </div>
                                {anaLoading ? <Loading /> : daywise.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for selected range</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={daywise} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }}
                                                tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                            <Tooltip labelFormatter={v => new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })} />
                                            <Legend />
                                            <Bar dataKey="total"    name="Total"    fill="#6366f1" radius={[3,3,0,0]} />
                                            <Bar dataKey="answered" name="Answered" fill="#22c55e" radius={[3,3,0,0]} />
                                            <Bar dataKey="missed"   name="Missed"   fill="#ef4444" radius={[3,3,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="h-5 w-5 text-indigo-500" />
                                    <h2 className="font-semibold text-gray-800">Hourly Call Activity</h2>
                                </div>
                                {anaLoading ? <Loading /> : hourly.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No hourly data available</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={hourly} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="total"    name="Total"    stroke="#6366f1" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="answered" name="Answered" stroke="#22c55e" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="missed"   name="Missed"   stroke="#ef4444" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── CALL HISTORY TAB ── */}
                    {tab === "history" && (
                        <div className="space-y-4">
                            {callsError && <InlineError msg={callsError.message} />}
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="flex flex-wrap gap-3 items-end">
                                    <form onSubmit={handleSearch} className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input type="text" placeholder="Search name or number…" value={searchInput}
                                                onChange={e => setSearchInput(e.target.value)}
                                                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                                            Search
                                        </button>
                                    </form>
                                    <div className="flex items-center gap-1.5">
                                        <Filter className="h-4 w-4 text-gray-400" />
                                        {[
                                            { key: "incoming", label: "Inbound" }, { key: "outgoing", label: "Outbound" },
                                            { key: "missed",   label: "Missed"  }, { key: "outgoing_missed", label: "No Answer" },
                                        ].map(({ key, label }) => (
                                            <button key={key} onClick={() => toggleType(key)}
                                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                                                    callTypeFilter.includes(key) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                                                }`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {isAdmin && agentOptions.length > 0 && (
                                        <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setHistPage(1); }}
                                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            <option value="">All Agents</option>
                                            {agentOptions.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                                        </select>
                                    )}
                                    {hasFilters && (
                                        <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 px-2 py-2">
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-bold text-gray-900">Call Logs</h2>
                                        {Number(totalCalls) > 0 && (
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{totalCalls} Total</span>
                                        )}
                                    </div>
                                    {Number(totalPages) > 1 && (
                                        <span className="text-xs text-gray-500 font-medium">Page {histPage} of {totalPages}</span>
                                    )}
                                </div>
                                {callsLoading ? <Loading /> : pagedCalls.length === 0 ? (
                                    <Empty message="No calls found for the selected range and filters" />
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Number</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Agent</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Recording</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-500">AI Analysis</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {pagedCalls.map((call, i) => (
                                                    <tr key={call.callId || i} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5">{dirIcon(call)}{callTypeBadge(call)}</div>
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-800">
                                                            {call.phonebookName || <span className="text-gray-400">Unknown</span>}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{call.formattedNumber || call.number || "—"}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-gray-800">{call.userName || "—"}</div>
                                                            {call.userPhone && <div className="text-xs text-gray-400 font-mono">{call.userPhone}</div>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700">{fmt(call.duration)}</td>
                                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(call.startTime || call.createdAt)}</td>
                                                        <td className="px-4 py-3"><AudioPlayer url={call.recUrl} /></td>
                                                        <td className="px-4 py-3">
                                                            {call.recUrl ? (
                                                                transcripts[call.callId] ? (
                                                                    <button onClick={() => setSelectedTranscript({ id: call.callId, ...transcripts[call.callId] })}
                                                                        className="flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium">
                                                                        <FileText className="h-3 w-3" /> View Analysis
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => handleTranscribe(call)}
                                                                        disabled={transcribingId === call.callId}
                                                                        className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium disabled:opacity-60">
                                                                        {transcribingId === call.callId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
                                                                        {transcribingId === call.callId ? "Analysing…" : "Transcribe"}
                                                                    </button>
                                                                )
                                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {totalCalls > 0 && (
                                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Page {histPage} of {totalPages}</span>
                                        <div className="flex items-center gap-2">
                                            <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}
                                                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <span className="text-xs font-semibold text-gray-700 px-2 py-1 bg-gray-100 rounded-md">{histPage}</span>
                                            <button disabled={histPage >= totalPages} onClick={() => setHistPage(p => p + 1)}
                                                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── AGENTS TAB ── */}
                    {tab === "agents" && (
                        <div className="space-y-4">
                            {anaError && !isNotConfiguredError(anaError) && <InlineError msg={anaError.message} />}
                            {agentDetail ? (
                                <>
                                    <button onClick={() => { setAgentDetail(null); setAgentDetailTab("overview"); setAgentDetailPage(1); }}
                                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                        <ChevronLeft className="h-4 w-4" /> Back to agent list
                                    </button>
                                    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                                        <div className="bg-indigo-100 p-3 rounded-full">
                                            <Users className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">{agentDetail.userName}</p>
                                            <p className="text-sm text-gray-500 font-mono">{agentDetail.userPhone || "—"}</p>
                                        </div>
                                        <div className="ml-auto flex flex-wrap gap-4 text-center text-sm">
                                            {[
                                                { label: "Total",    value: agentDetail.total,              color: "text-indigo-700" },
                                                { label: "Answered", value: agentDetail.answered,            color: "text-green-700" },
                                                { label: "Inbound",  value: agentDetail.inbound,             color: "text-blue-700" },
                                                { label: "Outbound", value: agentDetail.outbound,            color: "text-purple-700" },
                                                { label: "Duration", value: fmt(agentDetail.totalDuration),  color: "text-amber-700" },
                                            ].map(({ label, value, color }) => (
                                                <div key={label} className="bg-gray-50 rounded-lg px-4 py-2">
                                                    <p className={`text-base font-bold ${color}`}>{value}</p>
                                                    <p className="text-xs text-gray-500">{label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {[
                                            { key: "overview", label: "Overview",     icon: TrendingUp },
                                            { key: "history",  label: "Call History", icon: Phone },
                                            { key: "analysis", label: "Analysis",     icon: BarChart2 },
                                        ].map(({ key, label, icon: Icon }) => (
                                            <button key={key} onClick={() => setAgentDetailTab(key)}
                                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                                    agentDetailTab === key ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                                                }`}>
                                                <Icon className="h-4 w-4" />{label}
                                            </button>
                                        ))}
                                    </div>

                                    {(agentDetailTab === "history" ? agentDetailLoading : agentStatsLoading) ? <Loading /> : (() => {
                                        const dc = agentDetailTab === "history"
                                            ? (agentDetailCalls?.data || [])
                                            : (agentStatsCalls?.data  || []);

                                        const answered = dc.filter(c =>  c.answered);
                                        const missed   = dc.filter(c => !c.answered && c.inbound);
                                        const totalDur = dc.reduce((s, c) => s + (c.duration || 0), 0);
                                        const avgDur   = answered.length > 0 ? Math.round(totalDur / answered.length) : 0;

                                        const daywiseMap = {};
                                        dc.forEach(c => {
                                            const d = (c.startTime || c.createdAt || "").split("T")[0] || "Unknown";
                                            if (!daywiseMap[d]) daywiseMap[d] = { date: d, total: 0, answered: 0, missed: 0 };
                                            daywiseMap[d].total++;
                                            c.answered ? daywiseMap[d].answered++ : daywiseMap[d].missed++;
                                        });
                                        const daywiseChart = Object.values(daywiseMap).sort((a, b) => a.date.localeCompare(b.date));

                                        const hourlyMap = {};
                                        dc.forEach(c => {
                                            const dt = c.startTime || c.createdAt;
                                            if (!dt) return;
                                            const h = new Date(dt).getHours();
                                            if (!hourlyMap[h]) hourlyMap[h] = { hour: h, label: `${h}:00`, total: 0, answered: 0, missed: 0 };
                                            hourlyMap[h].total++;
                                            c.answered ? hourlyMap[h].answered++ : hourlyMap[h].missed++;
                                        });
                                        const hourlyChart = Object.values(hourlyMap).sort((a, b) => a.hour - b.hour);

                                        const AgentCallTable = ({ rows }) => rows.length === 0
                                            ? <Empty message="No calls in selected range" />
                                            : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Number</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Recording</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">AI Analysis</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {rows.map((call, i) => (
                                                            <tr key={call.callId || i} className="hover:bg-gray-50">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-1.5">{dirIcon(call)}{callTypeBadge(call)}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-800">{call.phonebookName || <span className="text-gray-400">Unknown</span>}</td>
                                                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{call.formattedNumber || call.number || "—"}</td>
                                                                <td className="px-4 py-3 text-gray-700">{fmt(call.duration)}</td>
                                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(call.startTime || call.createdAt)}</td>
                                                                <td className="px-4 py-3"><AudioPlayer url={call.recUrl} /></td>
                                                                <td className="px-4 py-3">
                                                                    {call.recUrl ? (
                                                                        transcripts[call.callId] ? (
                                                                            <button onClick={() => setSelectedTranscript({ id: call.callId, ...transcripts[call.callId] })}
                                                                                className="flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium">
                                                                                <FileText className="h-3 w-3" /> View Analysis
                                                                            </button>
                                                                        ) : (
                                                                            <button onClick={() => handleTranscribe(call)}
                                                                                disabled={transcribingId === call.callId}
                                                                                className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium disabled:opacity-60">
                                                                                {transcribingId === call.callId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
                                                                                {transcribingId === call.callId ? "Analysing…" : "Transcribe"}
                                                                            </button>
                                                                        )
                                                                    ) : <span className="text-xs text-gray-300">—</span>}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );

                                        if (agentDetailTab === "overview") return (
                                            <div className="space-y-5">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {[
                                                        { label: "Total Calls",  value: dc.length,       color: "text-indigo-700" },
                                                        { label: "Answered",     value: answered.length, color: "text-green-700" },
                                                        { label: "Missed",       value: missed.length,   color: "text-red-700" },
                                                        { label: "Avg Duration", value: fmt(avgDur),     color: "text-amber-700" },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                                                            <p className={`text-xl font-bold ${color}`}>{value}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                                                        <PhoneIncoming className="h-8 w-8 text-green-500" />
                                                        <div>
                                                            <p className="text-xl font-bold text-gray-900">{dc.filter(c => c.inbound).length}</p>
                                                            <p className="text-sm text-gray-500">Inbound calls</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                                                        <PhoneOutgoing className="h-8 w-8 text-indigo-500" />
                                                        <div>
                                                            <p className="text-xl font-bold text-gray-900">{dc.filter(c => !c.inbound).length}</p>
                                                            <p className="text-sm text-gray-500">Outbound calls</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                                                        <h2 className="font-semibold text-gray-800">Calls Per Day</h2>
                                                    </div>
                                                    {daywiseChart.length === 0
                                                        ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
                                                        : <ResponsiveContainer width="100%" height={240}>
                                                            <BarChart data={daywiseChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                <XAxis dataKey="date" tick={{ fontSize: 11 }}
                                                                    tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                                                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                                                <Tooltip /><Legend />
                                                                <Bar dataKey="total"    name="Total"    fill="#6366f1" radius={[3,3,0,0]} />
                                                                <Bar dataKey="answered" name="Answered" fill="#22c55e" radius={[3,3,0,0]} />
                                                                <Bar dataKey="missed"   name="Missed"   fill="#ef4444" radius={[3,3,0,0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    }
                                                </div>
                                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Clock className="h-5 w-5 text-indigo-500" />
                                                        <h2 className="font-semibold text-gray-800">Hourly Activity</h2>
                                                    </div>
                                                    {hourlyChart.length === 0
                                                        ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
                                                        : <ResponsiveContainer width="100%" height={200}>
                                                            <LineChart data={hourlyChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                                                <Tooltip /><Legend />
                                                                <Line type="monotone" dataKey="total"    name="Total"    stroke="#6366f1" strokeWidth={2} dot={false} />
                                                                <Line type="monotone" dataKey="answered" name="Answered" stroke="#22c55e" strokeWidth={2} dot={false} />
                                                                <Line type="monotone" dataKey="missed"   name="Missed"   stroke="#ef4444" strokeWidth={2} dot={false} />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    }
                                                </div>
                                            </div>
                                        );

                                        if (agentDetailTab === "history") {
                                            const agTotalCalls = agentDetailCalls?.meta?.total ?? 0;
                                            const agTotalPages = agentDetailCalls?.meta?.totalPages ?? 1;
                                            return (
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                                        <h2 className="font-semibold text-gray-800">
                                                            All Calls <span className="text-gray-400 font-normal text-sm ml-1">({agTotalCalls} total)</span>
                                                        </h2>
                                                        <span className="text-xs text-gray-400">{dateFrom} → {dateTo}</span>
                                                    </div>
                                                    <AgentCallTable rows={dc} />
                                                    {agTotalPages > 1 && (
                                                        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                                                            <span className="text-sm text-gray-500">Page {agentDetailPage} of {agTotalPages} · {agTotalCalls} calls</span>
                                                            <div className="flex items-center gap-2">
                                                                <button disabled={agentDetailPage <= 1} onClick={() => setAgentDetailPage(p => p - 1)}
                                                                    className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                                                                    <ChevronLeft className="h-4 w-4" />
                                                                </button>
                                                                <button disabled={agentDetailPage >= agTotalPages} onClick={() => setAgentDetailPage(p => p + 1)}
                                                                    className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (agentDetailTab === "analysis") {
                                            const longest = [...dc].sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 5);
                                            return (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {[
                                                            { label: "Total Duration", value: fmt(totalDur),                       color: "text-indigo-700" },
                                                            { label: "Avg Duration",   value: fmt(avgDur),                         color: "text-amber-700" },
                                                            { label: "Outbound",       value: dc.filter(c => !c.inbound).length,   color: "text-purple-700" },
                                                            { label: "Inbound",        value: dc.filter(c =>  c.inbound).length,   color: "text-blue-700" },
                                                        ].map(({ label, value, color }) => (
                                                            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                                                                <p className={`text-xl font-bold ${color}`}>{value}</p>
                                                                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {longest.length > 0 && (
                                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                            <div className="px-5 py-4 border-b border-gray-100">
                                                                <h2 className="font-semibold text-gray-800">Longest Calls</h2>
                                                            </div>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                                                                            <th className="px-4 py-3 text-right font-medium text-gray-500">Duration</th>
                                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {longest.map((c, i) => (
                                                                            <tr key={c.callId || i} className="hover:bg-gray-50">
                                                                                <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                                                                                <td className="px-4 py-3 text-gray-800">{c.phonebookName || c.formattedNumber || c.number || "—"}</td>
                                                                                <td className="px-4 py-3">{callTypeBadge(c)}</td>
                                                                                <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(c.duration)}</td>
                                                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(c.startTime || c.createdAt)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </>
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100">
                                        <h2 className="font-semibold text-gray-800">Agent Performance</h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Click an agent to view their call details</p>
                                    </div>
                                    {anaLoading ? <Loading /> : agents.length === 0 ? (
                                        <Empty message="No agent data for selected range" />
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Agent</th>
                                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Total</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Answered</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Inbound</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Outbound</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Total Duration</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Answer Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {agents.map((a, i) => (
                                                        <tr key={a.userId || i}
                                                            onClick={() => { setAgentDetail(a); setAgentDetailTab("overview"); setAgentDetailPage(1); }}
                                                            className="hover:bg-indigo-50 cursor-pointer transition-colors">
                                                            <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                                                            <td className="px-4 py-3 font-medium text-gray-800">{a.userName || "—"}</td>
                                                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.userPhone || "—"}</td>
                                                            <td className="px-4 py-3 text-center font-bold text-indigo-700">{a.total}</td>
                                                            <td className="px-4 py-3 text-center text-green-700">{a.answered}</td>
                                                            <td className="px-4 py-3 text-center text-blue-600">{a.inbound}</td>
                                                            <td className="px-4 py-3 text-center text-purple-600">{a.outbound}</td>
                                                            <td className="px-4 py-3 text-center text-amber-600">{fmt(a.totalDuration)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                    a.total > 0 && (a.answered / a.total) >= 0.7 ? "bg-green-100 text-green-700"
                                                                    : a.total > 0 && (a.answered / a.total) >= 0.4 ? "bg-amber-100 text-amber-700"
                                                                    : "bg-red-100 text-red-700"
                                                                }`}>
                                                                    {a.total > 0 ? `${Math.round((a.answered / a.total) * 100)}%` : "—"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ANALYSIS TAB ── */}
                    {tab === "analysis" && (
                        <div className="space-y-5">
                            {anaError && !isNotConfiguredError(anaError) && <InlineError msg={anaError.message} />}
                            {anaLoading ? <Loading /> : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <StatCard icon={Phone}         label="Total Calls"    value={summary.total}              color="bg-indigo-500" />
                                        <StatCard icon={Clock}         label="Total Duration" value={fmt(summary.totalDuration)}  color="bg-amber-500" />
                                        <StatCard icon={PhoneIncoming} label="Inbound"        value={summary.inbound}            color="bg-green-500" />
                                        <StatCard icon={PhoneOutgoing} label="Outbound"       value={summary.outbound}           color="bg-blue-500" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <TopCard label="Top by Total Calls" agent={topPerf.topByTotal}    sub={a => `${a.total} total calls`}         icon={Trophy}        bg="bg-indigo-100" iconColor="text-indigo-600" />
                                        <TopCard label="Top by Outbound"    agent={topPerf.topByOutbound} sub={a => `${a.outbound} outbound calls`}    icon={PhoneOutgoing} bg="bg-blue-100"   iconColor="text-blue-600" />
                                        <TopCard label="Top by Answered"    agent={topPerf.topByAnswered} sub={a => `${a.answered} answered calls`}    icon={CheckCircle2}  bg="bg-green-100"  iconColor="text-green-600" />
                                        <TopCard label="Highest Duration"   agent={topPerf.topByDuration} sub={a => fmt(a.totalDuration)}              icon={Clock}         bg="bg-amber-100"  iconColor="text-amber-600" />
                                    </div>
                                    {longestCall && (
                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                                <Zap className="h-5 w-5 text-amber-500" />
                                                <h2 className="font-semibold text-gray-800">Longest Call</h2>
                                            </div>
                                            <div className="px-5 py-4 flex flex-wrap gap-6 text-sm">
                                                <div><p className="text-xs text-gray-400">Agent</p><p className="font-medium text-gray-800">{longestCall.userName || "—"}</p></div>
                                                <div><p className="text-xs text-gray-400">Contact</p><p className="font-medium text-gray-800">{longestCall.phonebookName || "Unknown"}</p></div>
                                                <div><p className="text-xs text-gray-400">Number</p><p className="font-mono text-xs text-gray-600">{longestCall.formattedNumber || longestCall.number || "—"}</p></div>
                                                <div><p className="text-xs text-gray-400">Duration</p><p className="font-bold text-amber-600">{fmt(longestCall.duration)}</p></div>
                                                <div><p className="text-xs text-gray-400">Type</p><p>{callTypeBadge(longestCall)}</p></div>
                                                <div><p className="text-xs text-gray-400">Date & Time</p><p className="text-gray-600">{fmtDate(longestCall.startTime || longestCall.createdAt)}</p></div>
                                                {longestCall.recUrl && <div><p className="text-xs text-gray-400 mb-1">Recording</p><AudioPlayer url={longestCall.recUrl} /></div>}
                                            </div>
                                        </div>
                                    )}
                                    {agents.length > 0 && (
                                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Users className="h-5 w-5 text-indigo-500" />
                                                <h2 className="font-semibold text-gray-800">Agent Call Volume</h2>
                                            </div>
                                            <ResponsiveContainer width="100%" height={260}>
                                                <BarChart data={agents.slice(0, 10)} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis dataKey="userName" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                                    <Tooltip /><Legend />
                                                    <Bar dataKey="total"    name="Total"    fill="#6366f1" radius={[3,3,0,0]} />
                                                    <Bar dataKey="answered" name="Answered" fill="#22c55e" radius={[3,3,0,0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>

        {showIntegrationModal && (
            <ApiIntegrationModal
                onClose={(saved) => { setShowIntegrationModal(false); }}
                currentMasked={settings?.maskedKey || ""}
                isConnected={isConnected}
            />
        )}

        {selectedTranscript && (
            <TranscriptModal data={selectedTranscript} onClose={() => setSelectedTranscript(null)} />
        )}
        </>
    );
};

export default FasterQCalls;
