import React, { useState, useEffect, useRef } from "react";
import { Phone, MessageSquare, Send, User, ChevronRight, Loader2, RefreshCw, FileDown, Search, Inbox, Check, CheckCheck, Megaphone, Play, Video, Trash2, Calendar, Clock, HardDrive, VideoOff, X } from "lucide-react";
import api from "../api/axios";

export default function ActivityDashboard() {
    const [activeTab, setActiveTab] = useState("call");
    const [platformToken] = useState(localStorage.getItem("voice_platform_token") || "");
    const [chatToken] = useState(localStorage.getItem("chat_platform_token") || "");

    return (
        <div className="max-w-7xl mx-auto py-8 px-6 font-sans min-h-screen">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Activity Hub</h1>
                    <p className="text-sm text-gray-500">Manage your voice calls, chat progress, and live conversations.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {["call", "chat-status", "inbox", "meetings"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.replace("-", " ")}
                        </button>
                    ))}
                </div>
            </header>

            {activeTab === "call" && <CallLogsView token={platformToken} />}
            {activeTab === "chat-status" && <ChatStatusView />}
            {activeTab === "inbox" && <WhatsAppInbox token={chatToken} />}
            {activeTab === "meetings" && <MeetingRecordingsView />}
        </div>
    );
}

// ─── VIEW 1: CALL LOGS (Voice) ─────────────────────────────────────────────
function CallLogsView({ token }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);

    const fetchLogs = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const { data } = await api.get("/campaign-proxy/call-logs", {
                headers: { "X-Platform-Token": token.replace("Bearer ", "") }
            });
            setLogs(data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    return (
        <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-2xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Recent Calls</span>
                <button onClick={fetchLogs} className="p-2 hover:bg-gray-50 rounded-lg transition-all">
                    <RefreshCw className={`h-4 w-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[#f8faff] text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Room Name</th>
                            <th className="px-6 py-4">Assistant ID</th>
                            <th className="px-6 py-4">Assistant</th>
                            <th className="px-6 py-4">Assistant Phone</th>
                            <th className="px-6 py-4">Customer Phone</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Call Status</th>
                            <th className="px-6 py-4">Start Time</th>
                            <th className="px-6 py-4">Duration</th>
                            <th className="px-6 py-4">Cost</th>
                            <th className="px-6 py-4">Collected Data</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                        {logs.map(log => (
                            <React.Fragment key={log.id}>
                                <tr className="hover:bg-indigo-50/20 transition-all border-b border-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-500">{log.sessionId || "N/A"}</td>
                                    <td className="px-6 py-4 font-medium text-gray-400 truncate max-w-[100px]" title={log.assistantId}>{log.assistantId || "N/A"}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{log.assistantName || "aaa"}</td>
                                    <td className="px-6 py-4 text-gray-500 font-medium">{log.assistantPhone || "N/A"}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{log.customerPhone}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border ${log.type === 'outbound' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase border ${log.callStatus === 'completed' || log.callStatus === 'COMPLETED'
                                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                                            : log.callStatus === 'failed' || log.callStatus === 'FAILED'
                                                ? 'bg-red-100 text-red-700 border-red-200'
                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                            }`}>
                                            {log.callStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">
                                        {new Date(log.startTime || log.createdAt).toLocaleString([], {
                                            month: 'numeric',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-6 py-4 font-bold">{log.duration || "00:00"}</td>
                                    <td className="px-6 py-4 font-black">₹{parseFloat(log.cost || 0).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        {log.collectedData ? (
                                            <button
                                                onClick={() => toggleRow(log.id)}
                                                className="text-indigo-600 font-black hover:text-indigo-800 flex items-center gap-1 transition-colors"
                                            >
                                                {expandedRow === log.id ? '∨ Hide Data' : '> Show Data'}
                                            </button>
                                        ) : (
                                            <span className="text-gray-300">N/A</span>
                                        )}
                                    </td>
                                </tr>
                                {expandedRow === log.id && (
                                    <tr className="bg-gray-50/50">
                                        <td colSpan="11" className="px-8 py-6">
                                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Collected Data</div>
                                                <pre className="text-[11px] font-mono text-gray-700 bg-gray-50 p-4 rounded-xl overflow-x-auto border border-gray-100">
                                                    {JSON.stringify(log.collectedData, null, 2)}
                                                </pre>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// ─── VIEW 2: CHAT STATUS (Bulk Progress) ───────────────────────────────────
function ChatStatusView() {
    const [history, setHistory] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobDetails, setJobDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const chatToken = localStorage.getItem("chat_platform_token") || "";
    const itemsPerPage = 5;

    const totalPages = Math.ceil(history.length / itemsPerPage);
    const paginatedHistory = history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        api.get("/campaign-proxy").then(r => {
            const chatCamps = r.data.filter(c => c.type === 'CHAT').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setHistory(chatCamps);
            if (chatCamps.length > 0 && !selectedJob) {
                fetchJobDetails(chatCamps[0].jobId);
            }
        });
    }, []);

    const fetchJobDetails = async (jobId) => {
        if (!jobId || !chatToken) return;
        setSelectedJob(jobId);
        setLoadingDetails(true);
        try {
            const cleanToken = chatToken.replace(/^Bearer\s+/i, "");
            const res = await api.get(`/campaign-proxy/chat-campaigns/status/${jobId}`, {
                headers: { "X-Platform-Token": cleanToken }
            });
            setJobDetails(res.data);
        } catch (err) {
            console.error("Failed to fetch job details", err);
            setJobDetails(null);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Send Summary Card */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl shadow-black/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><CheckCheck className="w-5 h-5" /></div>
                    <h2 className="text-gray-900 font-black text-xl tracking-tight uppercase">Send Summary</h2>
                </div>

                {loadingDetails ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                    </div>
                ) : jobDetails ? (
                    <>
                        <div className="flex flex-wrap gap-3 mb-8">
                            <span className="bg-gray-50 text-gray-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200 shadow-sm">Total: {jobDetails.total || 0}</span>
                            <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100 shadow-sm">Valid: {jobDetails.total - (jobDetails.invalid || 0)}</span>
                            <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-amber-100 shadow-sm">Invalid: {jobDetails.invalid || 0}</span>
                            <span className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100 shadow-sm">Sent: {jobDetails.sent || 0}</span>
                            <span className="bg-red-50 text-red-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-red-100 shadow-sm">Failed: {jobDetails.failed || 0}</span>
                        </div>

                        <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {(jobDetails.results || []).map((res, i) => (
                                    <div key={i} className="flex justify-between items-center py-3 px-6 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50/50 transition-colors">
                                        <span className="text-gray-700 text-sm font-bold">{res.number}</span>
                                        <div className="flex items-center gap-1.5">
                                            {res.status === 'SENT' ? (
                                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-black uppercase tracking-widest">
                                                    <Check className="h-3.5 w-3.5" /> Sent
                                                </span>
                                            ) : res.status === 'FAILED' ? (
                                                <span className="text-red-600 text-xs font-black uppercase tracking-widest">Failed</span>
                                            ) : (
                                                <span className="text-gray-500 text-xs font-black uppercase tracking-widest">{res.status}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {jobDetails.invalidNumbers && jobDetails.invalidNumbers.map((num, i) => (
                                    <div key={`inv-${i}`} className="flex justify-between items-center py-3 px-6 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50/50 transition-colors">
                                        <span className="text-gray-700 text-sm font-bold">{num}</span>
                                        <span className="text-amber-500 text-xs font-black uppercase tracking-widest">Invalid</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-50 rounded-2xl border border-gray-100 py-12 flex flex-col items-center justify-center">
                        <Inbox className="h-8 w-8 text-gray-300 mb-3" />
                        <div className="text-gray-500 text-sm font-bold uppercase tracking-widest">Select a campaign to view details</div>
                    </div>
                )}
            </div>

            {/* Recent Campaigns Table */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl shadow-black/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Megaphone className="w-5 h-5" /></div>
                    <h2 className="text-gray-900 font-black text-xl tracking-tight uppercase">Recent Campaigns</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="text-[10px] text-gray-400 font-black uppercase tracking-widest border-b border-gray-100 bg-[#f8faff]">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-xl">Name</th>
                                <th className="px-6 py-4">Recipients</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right rounded-tr-xl">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedHistory.map(camp => (
                                <tr key={camp.id} className={`group hover:bg-indigo-50/30 transition-colors cursor-pointer ${selectedJob === camp.jobId ? 'bg-indigo-50/50' : ''}`} onClick={() => fetchJobDetails(camp.jobId)}>
                                    <td className="px-6 py-4 text-gray-900 text-sm font-bold">{camp.name || "Campaign"}</td>
                                    <td className="px-6 py-4 text-gray-500 text-sm font-medium">{camp.imported || 0}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${camp.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                            {camp.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-xs font-bold uppercase tracking-widest">
                                        {new Date(camp.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); fetchJobDetails(camp.jobId); }}
                                            className={`text-[10px] px-4 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all ${selectedJob === camp.jobId ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
                                        >
                                            {selectedJob === camp.jobId ? "Viewing" : "View"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-6 mt-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── VIEW 3: WHATSAPP INBOX (Live Chat) ────────────────────────────────────
function WhatsAppInbox({ token }) {
    const [conversations, setConversations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(false);
    const msgEndRef = useRef(null);

    useEffect(() => {
        if (!token) return;
        // For Zenchat Inbox, we usually need an Assistant ID as well, 
        // but often the Bearer Token works globally for the account.
        // We'll try to fetch all if the API supports it, or use a default.
        const assistantId = "e7da0da3-4de3-4ae1-afd8-d9fadcfdfa46"; // Default
        api.get(`/campaign-proxy/conversations/assistant/${assistantId}`, { headers: { "X-Platform-Token": token } })
            .then(r => {
                const list = (r.data.data || r.data || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                setConversations(list);
            })
            .catch(err => console.error("Inbox load fail:", err));
    }, [token]);

    useEffect(() => {
        if (!selectedId) return;
        setLoading(true);
        api.get(`/campaign-proxy/conversations/${selectedId}/messages`, { headers: { "X-Platform-Token": token } })
            .then(r => setMessages(r.data.data || r.data.messages || []))
            .finally(() => setLoading(false));
    }, [selectedId, token]);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (!reply.trim() || !selectedId) return;
        try {
            const res = await api.post(`/campaign-proxy/conversations/${selectedId}/messages`, { content: reply }, { headers: { "X-Platform-Token": token } });
            setMessages([...messages, { id: Date.now(), content: reply, sender: "assistant", createdAt: new Date() }]);
            setReply("");
        } catch (err) { console.error("Reply fail:", err); }
    };

    return (
        <div className="bg-white border border-gray-100 rounded-[40px] shadow-2xl shadow-black/5 overflow-hidden flex h-[700px] animate-in zoom-in-95 duration-300">
            {/* Conversations Sidebar */}
            <div className="w-[350px] border-r border-gray-50 flex flex-col bg-gray-50/20">
                <div className="p-6 border-b border-gray-50">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-indigo-500" /> Conversations
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {conversations.map(conv => (
                        <button
                            key={conv.id}
                            onClick={() => setSelectedId(conv.id)}
                            className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all text-left group ${selectedId === conv.id ? 'bg-indigo-600 shadow-xl shadow-indigo-100' : 'hover:bg-white border border-transparent hover:border-gray-50'}`}
                        >
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${selectedId === conv.id ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                {conv.contactName?.[0] || conv.contactPhone?.[3] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`text-xs font-black truncate uppercase tracking-tight ${selectedId === conv.id ? 'text-white' : 'text-gray-900'}`}>{conv.contactName || conv.contactPhone}</div>
                                <div className={`text-[10px] truncate font-bold mt-0.5 ${selectedId === conv.id ? 'text-indigo-100' : 'text-gray-400'}`}>{conv.lastMessage || "No messages yet"}</div>
                            </div>
                            <div className={`text-[9px] font-black ${selectedId === conv.id ? 'text-white/60' : 'text-gray-300'}`}>{new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedId ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-gray-50 flex items-center gap-4">
                            <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                                {conversations.find(c => c.id === selectedId)?.contactName?.[0] || "?"}
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">{conversations.find(c => c.id === selectedId)?.contactName || "Active Chat"}</h3>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1.5 animate-pulse"><div className="h-1.5 w-1.5 bg-emerald-500 rounded-full" /> Connected via WhatsApp</p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50/10 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                    <Loader2 className="h-8 w-8 animate-spin opacity-20 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Syncing secure messages...</p>
                                </div>
                            ) : messages.map((m, idx) => (
                                <div key={idx} className={`flex flex-col ${m.sender === 'assistant' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-bold shadow-sm ${m.sender === 'assistant' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-900 rounded-tl-none'}`}>
                                        {m.content}
                                        <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${m.sender === 'assistant' ? 'text-indigo-200' : 'text-gray-400'}`}>
                                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {m.sender === 'assistant' && <CheckCheck className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={msgEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-6 border-t border-gray-50">
                            <div className="relative">
                                <input
                                    value={reply}
                                    onChange={e => setReply(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Type your message here..."
                                    className="w-full bg-gray-50 border border-gray-100 rounded-3xl pl-6 pr-20 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                                />
                                <button
                                    onClick={handleSend}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-20">
                        <div className="bg-indigo-50 h-20 w-20 rounded-[32px] flex items-center justify-center text-indigo-400 mb-6 border-b-4 border-indigo-100 shadow-xl shadow-indigo-50/50">
                            <MessageSquare className="h-10 w-10" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Select a Conversation</h2>
                        <p className="text-sm font-medium">Click on a contact from the list on the left to view messages and start chatting live.</p>
                    </div>
                )}
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }`}</style>
        </div>
    );
}

// ─── VIEW 4: MEETING RECORDINGS (LiveKit Video Calls) ──────────────────────
function MeetingRecordingsView() {
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedVideo, setSelectedVideo] = useState(null); // For modal video player

    const fetchRecordings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/livekit/recordings");
            setRecordings(data || []);
        } catch (err) {
            console.error("Failed to fetch recordings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecordings();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this meeting recording?")) return;
        try {
            await api.delete(`/livekit/recordings/${id}`);
            setRecordings(recordings.filter(rec => rec.id !== id));
        } catch (err) {
            console.error("Failed to delete recording:", err);
            alert("Failed to delete recording");
        }
    };

    const getBackendUrl = () => {
        const baseUrl = import.meta.env.VITE_API_URL || "";
        return baseUrl.replace(/\/api\/?$/, "");
    };

    const filteredRecordings = recordings.filter(rec => {
        const query = searchTerm.toLowerCase();
        const roomMatch = rec.roomName?.toLowerCase().includes(query);
        const creatorMatch = rec.creator?.name?.toLowerCase().includes(query);
        return roomMatch || creatorMatch;
    });

    const formatSize = (bytes) => {
        if (!bytes) return "0 Bytes";
        const k = 1024;
        const dm = 2;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "N/A";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        }
        if (m > 0) {
            return `${m}m ${s}s`;
        }
        return `${s}s`;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Toolbar and Stats */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl shadow-black/5 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Room Name or Host..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                        />
                    </div>
                    <button
                        onClick={fetchRecordings}
                        className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl transition-all"
                        title="Refresh list"
                    >
                        <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex items-center gap-6 text-xs text-gray-500 font-bold uppercase tracking-widest w-full md:w-auto justify-end">
                    <span className="flex items-center gap-1.5"><Video className="h-4 w-4 text-indigo-500" /> {filteredRecordings.length} Recordings</span>
                    <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-indigo-500" /> {formatSize(recordings.reduce((acc, rec) => acc + (rec.fileSize || 0), 0))} Used</span>
                </div>
            </div>

            {/* Recordings List */}
            <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
                {loading && recordings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Loading recordings...</p>
                    </div>
                ) : filteredRecordings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <VideoOff className="h-16 w-16 text-gray-200 mb-4" />
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">No Recordings Found</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
                            {searchTerm ? "No recordings match your search query." : "Recordings will appear here after they are generated in a room."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-[#f8faff] text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Room Name</th>
                                    <th className="px-6 py-4">Date & Time</th>
                                    <th className="px-6 py-4">Duration</th>
                                    <th className="px-6 py-4">File Size</th>
                                    <th className="px-6 py-4">Recorded By</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-xs">
                                {filteredRecordings.map(rec => (
                                    <tr key={rec.id} className="hover:bg-indigo-50/20 transition-all border-b border-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                                            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                                                <Video className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black uppercase tracking-tight">{rec.roomName}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{rec.fileName}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                {new Date(rec.createdAt).toLocaleDateString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                                                <Clock className="h-3.5 w-3.5 text-gray-300" />
                                                {new Date(rec.createdAt).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-700">
                                            {formatDuration(rec.duration)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-bold">
                                            {formatSize(rec.fileSize)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {rec.creator?.profilePhoto ? (
                                                    <img
                                                        src={rec.creator.profilePhoto.startsWith("http") ? rec.creator.profilePhoto : `${getBackendUrl()}${rec.creator.profilePhoto}`}
                                                        alt={rec.creator.name}
                                                        className="h-7 w-7 rounded-full object-cover border border-gray-100"
                                                    />
                                                ) : (
                                                    <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                                        {rec.creator?.name?.[0] || "U"}
                                                    </div>
                                                )}
                                                <span className="font-bold text-gray-700">{rec.creator?.name || "System"}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedVideo(rec)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all"
                                                >
                                                    <Play className="h-3.5 w-3.5 fill-current" /> Play
                                                </button>
                                                <a
                                                    href={`${getBackendUrl()}${rec.fileUrl}`}
                                                    download={rec.fileName}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                                >
                                                    <FileDown className="h-3.5 w-3.5" /> Download
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(rec.id)}
                                                    className="bg-white hover:bg-red-50 border border-red-100 text-red-500 hover:text-red-700 p-2 rounded-xl transition-all"
                                                    title="Delete recording"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Video Player Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative bg-gray-900 border border-gray-800 rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <Video className="h-4 w-4 text-indigo-400" /> {selectedVideo.roomName} Recording
                                </h3>
                                <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tight">
                                    Recorded on {new Date(selectedVideo.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedVideo(null)}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white p-2 rounded-xl transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Player Content */}
                        <div className="relative bg-black aspect-video flex items-center justify-center">
                            <video
                                src={`${getBackendUrl()}${selectedVideo.fileUrl}`}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {/* Footer metadata details */}
                        <div className="p-6 bg-gray-950/50 flex justify-between items-center text-xs text-gray-400 font-bold uppercase tracking-widest border-t border-gray-800">
                            <div className="flex gap-6">
                                <span>File: <span className="text-white font-mono text-[11px] font-normal lowercase">{selectedVideo.fileName}</span></span>
                                <span>Size: <span className="text-white">{formatSize(selectedVideo.fileSize)}</span></span>
                            </div>
                            <div>
                                <span>Recorded by: <span className="text-indigo-400">{selectedVideo.creator?.name || "System"}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
