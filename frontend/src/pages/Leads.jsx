import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Edit, Plus, Upload, Phone, PhoneCall, Play, Pause, SearchCheck, Users, Calendar, GitBranch, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Merge, History, Rocket, MessageSquare, ChevronDown, Shuffle, Mail, BotIcon } from "lucide-react";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import AddLeadForm from "../components/AddLeadForm";
import MergeLeadModal from "../components/MergeLeadModal";
import LeadActivityModal from "../components/LeadActivityModal";
import DistributeLeadsModal from "../components/DistributeLeadsModal";
import CallDetailModal from "../components/CallDetailModal";
import calendlyLogo from "../assets/calendly.png";
import { useAuth } from "../context/AuthContext";

const Leads = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("leads"); // "leads" | "search-leads" | "converted"
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [layerFilter, setLayerFilter] = useState("ALL");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const csvInputRef = useRef(null);
    const queryClient = useQueryClient();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const { data: leads, isLoading } = useQuery({
        queryKey: ["leads"],
        queryFn: async () => {
            const res = await api.get("/leads");
            return res.data;
        },
    });

    const { data: settings } = useQuery({
        queryKey: ["companySettings"],
        queryFn: async () => {
            const res = await api.get("/company-settings");
            return res.data;
        },
    });

    const toggleAutoCallMutation = useMutation({
        mutationFn: async (enabled) => {
            const res = await api.patch("/company-settings", { autoCallEnabled: enabled });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companySettings"] });
        },
        onError: (error) => {
            alert(error.response?.data?.message || "Failed to update auto-call setting");
        }
    });

    const { data: integrations } = useQuery({
        queryKey: ["integrations"],
        queryFn: async () => {
            const res = await api.get("/integrations");
            return res.data;
        },
    });

    const calendlyIntegration = integrations?.find(i => i.platform === "Calendly" && i.isConnected);
    const calendlyLink = calendlyIntegration?.config?.link;

    const handleScheduleMeeting = (lead) => {
        if (!calendlyLink) {
            alert("Please connect Calendly in Integrations first.");
            return;
        }

        // Construct Calendly URL with prefilled data
        const url = new URL(calendlyLink);
        url.searchParams.append("name", lead.name);
        if (lead.email) url.searchParams.append("email", lead.email);

        window.open(url.toString(), "_blank");
    };

    const getLeadLayer = (lead) => {
        const score = lead.score || 0;
        const hasFailedCall = lead.callLogs?.some(log => log.callStatus === "FAILED");
        if (score >= 100 || lead.status === "CONVERTED") return "Converted";
        if (score >= 80) return "Layer 3";
        if (score >= 50) return "Layer 2";
        return "Layer 1";
    };

    // Converted leads — shown in dedicated Converted main tab
    const convertedLeads = leads?.filter((lead) =>
        lead.status === "CONVERTED" || (lead.score || 0) === 100
    );

    const tabLeads = leads?.filter((lead) => {
        if (activeTab === "converted") return false;
        return activeTab === "search-leads" ? lead.isSearchLead : !lead.isSearchLead;
    });

    const layerCounts = {
        "ALL": tabLeads?.length ?? 0,
        "Layer 1": tabLeads?.filter(l => getLeadLayer(l) === "Layer 1").length ?? 0,
        "Layer 2": tabLeads?.filter(l => getLeadLayer(l) === "Layer 2").length ?? 0,
        "Layer 3": tabLeads?.filter(l => getLeadLayer(l) === "Layer 3").length ?? 0,
        "Converted": tabLeads?.filter(l => getLeadLayer(l) === "Converted").length ?? 0,
    };

    const layerLeads = activeTab === "converted"
        ? convertedLeads
        : tabLeads?.filter((lead) => {
            if (activeTab !== "leads" || layerFilter === "ALL") return true;
            return getLeadLayer(lead) === layerFilter;
        });

    const filteredLeads = layerLeads?.filter((lead) => {
        const matchesSearch =
            lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Bulk Actions
    const [selectedLeads, setSelectedLeads] = useState([]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLeads(filteredLeads.map(l => l.id));
        } else {
            setSelectedLeads([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    const handleLaunchCampaign = (tab) => {
        const selectedData = leads.filter(l => selectedLeads.includes(l.id));
        navigate("/campaigns", { state: { leads: selectedData, tab } });
    };

    const handleBulkUpdate = async (status) => {
        if (!confirm(`Update ${selectedLeads.length} leads to ${status}?`)) return;
        try {
            await api.patch("/leads/bulk-update", { leadIds: selectedLeads, status });
            alert("Leads updated successfully");
            setSelectedLeads([]);
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (error) {
            alert("Failed to update leads");
        }
    };

    const handleBulkAutoRoute = async () => {
        if (!confirm(`Automatically route ${selectedLeads.length} leads based on workload split?`)) return;
        try {
            await api.patch("/leads/bulk-auto-route", { leadIds: selectedLeads });
            alert("Leads assigned successfully based on current workload.");
            setSelectedLeads([]);
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Failed to auto-route leads. Ensure leads have score 25+.";
            alert(`⚠️ Assignment Blocked: ${errorMsg}`);
        }
    };

    // Merge Modal
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    // Distribute Modal
    const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);

    // Activity Modal
    const [selectedLeadForActivity, setSelectedLeadForActivity] = useState(null);

    // Call Detail Modal
    const [selectedLeadForCalls, setSelectedLeadForCalls] = useState(null);

    // Click2Call state
    const { user } = useAuth();
    const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
    const [callingLeadId, setCallingLeadId] = useState(null);
    const [playingRecording, setPlayingRecording] = useState(null);
    const audioRef = useRef(null);

    const handleClick2Call = async (lead) => {
        if (callingLeadId) {
            alert("A call is already in progress.");
            return;
        }
        if (!confirm(`Call ${lead.name} at ${lead.phone}? Your phone will ring first.`)) return;

        setCallingLeadId(lead.id);
        try {
            await api.post("/zxcall/click2call", { to: lead.phone });
        } catch (error) {
            alert(error.response?.data?.message || "Failed to initiate call");
        } finally {
            setTimeout(() => setCallingLeadId(null), 5000);
        }
    };

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

    const getAudioSrc = (url, callLogId) => {
        if (!url) return "";
        if (url.startsWith("/uploads/")) {
            return `${API_URL.replace("/api", "")}${url}`;
        }
        if (callLogId) {
            return `${API_URL}/calls/stream-recording/${callLogId}`;
        }
        return url;
    };

    const handlePlayRecording = (callLog) => {
        if (playingRecording === callLog.id) {
            audioRef.current?.pause();
            setPlayingRecording(null);
        } else {
            setPlayingRecording(callLog.id);
        }
    };

    // Convert lead to Converted (Layer 3 → Converted)
    const handleConvertLead = async (lead) => {
        if (!confirm(`Convert "${lead.name}" to Converted?`)) return;
        try {
            await api.patch(`/leads/${lead.id}/status`, { status: "CONVERTED" });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (error) {
            alert(error.response?.data?.message || "Failed to convert lead");
        }
    };

    // Trigger auto-call for a lead that was missed
    const [triggeringCallId, setTriggeringCallId] = useState(null);
    const handleTriggerCall = async (lead) => {
        if (!confirm(`Trigger auto-call for "${lead.name}" (${lead.phone})?`)) return;
        setTriggeringCallId(lead.id);
        try {
            await api.post(`/leads/${lead.id}/trigger-call`);
            alert(`Auto-call triggered for ${lead.name}. You'll receive a call shortly.`);
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (error) {
            alert(error.response?.data?.message || "Failed to trigger call");
        } finally {
            setTriggeringCallId(null);
        }
    };

    // CSV Import
    const handleImportCSV = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";

        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append("csv", file);
            const res = await api.post("/leads/import", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            alert(res.data.message);
        } catch (error) {
            alert(error.response?.data?.message || "Failed to import CSV");
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const regularCount = leads?.filter((l) => !l.isSearchLead).length ?? 0;
    const searchCount = leads?.filter((l) => l.isSearchLead).length ?? 0;
    const convertedCount = convertedLeads?.length ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leads</h1>
                    <p className="text-sm text-gray-500">Manage your potential customers</p>
                </div>
                <div className="flex gap-2">
                    {/* Auto Call Toggle */}
                    <div className="inline-flex items-center gap-2.5 bg-white border border-gray-200 px-3.5 py-2 rounded-lg shadow-sm">
                        <PhoneCall className={`h-4 w-4 ${settings?.autoCallEnabled ? "text-indigo-600 animate-pulse" : "text-gray-400"}`} />
                        <span className="text-xs font-bold text-gray-700 select-none">Auto Call</span>
                        {isAdmin ? (
                            <button
                                onClick={() => toggleAutoCallMutation.mutate(!settings?.autoCallEnabled)}
                                disabled={toggleAutoCallMutation.isPending}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                    settings?.autoCallEnabled ? "bg-indigo-600" : "bg-gray-200"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        settings?.autoCallEnabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        ) : (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                settings?.autoCallEnabled ? "bg-indigo-100 text-indigo-700 animate-pulse" : "bg-gray-100 text-gray-600"
                            }`}>
                                {settings?.autoCallEnabled ? "ON" : "OFF"}
                            </span>
                        )}
                    </div>

                    <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportCSV}
                    />
                    <button
                        onClick={() => csvInputRef.current?.click()}
                        disabled={isImporting}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        {isImporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4 mr-2" />
                        )}
                        Import File
                    </button>
                    <button
                        onClick={() => {
                            const unqualified = filteredLeads.filter(l => (l.score || 0) < 25);
                            if (unqualified.length > 0) {
                                if (confirm(`${unqualified.length} leads have a score below 25 and cannot be assigned to sales. Proceed with only the ${filteredLeads.length - unqualified.length} qualified leads?`)) {
                                    const qualifiedIds = filteredLeads.filter(l => (l.score || 0) >= 25).map(l => l.id);
                                    setSelectedLeads(qualifiedIds);
                                    if (qualifiedIds.length > 0) setIsDistributeModalOpen(true);
                                }
                            } else if (filteredLeads.length > 0) {
                                setSelectedLeads(filteredLeads.map(l => l.id));
                                setIsDistributeModalOpen(true);
                            } else {
                                alert("No leads available to distribute.");
                            }
                        }}
                        className="inline-flex items-center px-4 py-2 border border-orange-200 rounded-lg shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                        <Shuffle className="h-4 w-4 mr-2" />
                        Distribute
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Lead
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setActiveTab("leads"); setSearchTerm(""); setStatusFilter("ALL"); setLayerFilter("ALL"); setSelectedLeads([]); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "leads"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <Users className="h-4 w-4" />
                    Leads
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === "leads" ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"
                        }`}>
                        {regularCount}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab("search-leads"); setSearchTerm(""); setStatusFilter("ALL"); setLayerFilter("ALL"); setSelectedLeads([]); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "search-leads"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <SearchCheck className="h-4 w-4" />
                    Search Leads
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === "search-leads" ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"
                        }`}>
                        {searchCount}
                    </span>
                </button>

            </div>

            {/* Layer Sub-Tabs (only for regular leads) */}
            {activeTab === "leads" && (
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: "ALL", label: "All Leads", sub: "", color: "indigo" },
                        { key: "Layer 1", label: "Layer 1", sub: "0–49 Cold", color: "blue" },
                        { key: "Layer 2", label: "Layer 2", sub: "50–70 Warm", color: "amber" },
                        { key: "Layer 3", label: "Layer 3", sub: "80–90 Hot", color: "red" },
                        { key: "Converted", label: "Converted 100", sub: "100 (exact)", color: "purple" },
                    ].map(({ key, label, sub, color }) => {
                        const isActive = layerFilter === key;
                        const colorMap = {
                            indigo: { active: "bg-indigo-600 text-white border-indigo-600", inactive: "bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400", badge: isActive ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-600" },
                            blue: { active: "bg-blue-600 text-white border-blue-600", inactive: "bg-white text-blue-700 border-blue-200 hover:border-blue-400", badge: isActive ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600" },
                            amber: { active: "bg-amber-500 text-white border-amber-500", inactive: "bg-white text-amber-700 border-amber-200 hover:border-amber-400", badge: isActive ? "bg-amber-400 text-white" : "bg-amber-100 text-amber-700" },
                            red: { active: "bg-red-600 text-white border-red-600", inactive: "bg-white text-red-700 border-red-200 hover:border-red-400", badge: isActive ? "bg-red-500 text-white" : "bg-red-100 text-red-600" },
                            purple: { active: "bg-purple-600 text-white border-purple-600", inactive: "bg-white text-purple-700 border-purple-200 hover:border-purple-400", badge: isActive ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-600" },
                        };
                        const c = colorMap[color];
                        return (
                            <button
                                key={key}
                                onClick={() => { setLayerFilter(key); setSelectedLeads([]); setCurrentPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${isActive ? c.active : c.inactive}`}
                            >
                                <span>{label}</span>
                                {sub && <span className="text-[10px] font-normal opacity-75">{sub}</span>}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${c.badge}`}>
                                    {layerCounts[key]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search leads by name or email..."
                        className="pl-10 w-full border border-gray-300 rounded-lg py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="relative w-full sm:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                        className="pl-10 w-full border border-gray-300 rounded-lg py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="ALL">All Status</option>
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="FOLLOW_UP">Follow Up</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="LOST">Lost</option>
                    </select>
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedLeads.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-indigo-900 px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-10 z-50 min-w-max border border-white/10 backdrop-blur-md">
                    <div className="flex flex-col">
                        <span className="text-white text-sm font-black tracking-widest uppercase">{selectedLeads.length} Leads Selected</span>
                        <button onClick={() => setSelectedLeads([])} className="text-[10px] text-white/50 font-bold hover:text-white transition-colors text-left uppercase tracking-tighter">Deselect All</button>
                    </div>

                    <div className="h-8 w-px bg-white/10" />

                    <div className="flex gap-4">
                        <button
                            onClick={() => handleLaunchCampaign("call")}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/40"
                        >
                            <Rocket className="h-3.5 w-3.5" /> Launch Call Campaign
                        </button>

                        <button
                            onClick={() => handleLaunchCampaign("chat")}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40"
                        >
                            <MessageSquare className="h-3.5 w-3.5" /> Launch Chat Campaign
                        </button>

                        <button
                            onClick={handleBulkAutoRoute}
                            className="bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase hover:bg-indigo-400 transition-all flex items-center gap-2 shadow-lg border border-white/20"
                        >
                            <Rocket className="h-3.5 w-3.5" /> Auto Assign
                        </button>

                        <button
                            onClick={() => {
                                const selectedData = leads?.filter(l => selectedLeads.includes(l.id)) || [];
                                const unqualified = selectedData.filter(l => (l.score || 0) < 25);

                                if (unqualified.length > 0) {
                                    if (confirm(`${unqualified.length} leads have a score below 25 and cannot be assigned to sales. Proceed with only the ${selectedLeads.length - unqualified.length} qualified leads?`)) {
                                        const qualifiedIds = selectedData.filter(l => (l.score || 0) >= 25).map(l => l.id);
                                        setSelectedLeads(qualifiedIds);
                                        if (qualifiedIds.length > 0) setIsDistributeModalOpen(true);
                                    }
                                } else {
                                    setIsDistributeModalOpen(true);
                                }
                            }}
                            className="bg-orange-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-900/40"
                        >
                            <Shuffle className="h-3.5 w-3.5" /> Distribute
                        </button>

                        <div className="relative group">
                            <select
                                className="bg-white/10 text-white border border-white/20 rounded-2xl px-5 py-3 text-xs font-black uppercase appearance-none outline-none hover:bg-white/20 transition-all pr-10 cursor-pointer"
                                onChange={(e) => { if (e.target.value) handleBulkUpdate(e.target.value); }}
                                value=""
                            >
                                <option value="" disabled className="text-gray-900">Update Status</option>
                                <option value="NEW" className="text-gray-900">New</option>
                                <option value="CONTACTED" className="text-gray-900">Contacted</option>
                                <option value="FOLLOW_UP" className="text-gray-900">Follow Up</option>
                                <option value="CONVERTED" className="text-gray-900">Converted</option>
                                <option value="LOST" className="text-gray-900">Lost</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3 w-3 text-white pointer-events-none" />
                        </div>

                        {selectedLeads.length === 2 && (
                            <button
                                onClick={() => setIsMergeModalOpen(true)}
                                className="bg-white/10 text-white border border-white/20 px-5 py-3 rounded-2xl text-xs font-black uppercase hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <Merge className="h-3.5 w-3.5" /> Merge
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        onChange={handleSelectAll}
                                        checked={filteredLeads?.length > 0 && selectedLeads.length === filteredLeads.length}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Biodata</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Notes</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLeads?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((lead) => (
                                <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selectedLeads.includes(lead.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedLeads.includes(lead.id)}
                                            onChange={() => handleSelectOne(lead.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                                        <div className="text-xs text-gray-500 capitalize">{lead.enquiryType.toLowerCase().replace("_", " ")}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {lead.email || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-gray-900 font-medium">{lead.phone}</span>
                                            <button
                                                onClick={() => handleClick2Call(lead)}
                                                disabled={callingLeadId === lead.id}
                                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${callingLeadId === lead.id
                                                    ? "bg-green-100 text-green-600 animate-pulse"
                                                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                                    }`}
                                                title={callingLeadId === lead.id ? "Calling..." : "Call this lead"}
                                            >
                                                {callingLeadId === lead.id ? (
                                                    <PhoneCall className="h-3 w-3" />
                                                ) : (
                                                    <Phone className="h-3 w-3" />
                                                )}
                                            </button>
                                        </div>
                                        {/* Latest recording */}
                                        {lead.callLogs?.find(c => c.recordingUrl) && (() => {
                                            const latestRecording = lead.callLogs.find(c => c.recordingUrl);
                                            return (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <button
                                                        onClick={() => handlePlayRecording(latestRecording)}
                                                        className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700"
                                                        title="Play recording"
                                                    >
                                                        {playingRecording === latestRecording.id ? (
                                                            <Pause className="h-2.5 w-2.5" />
                                                        ) : (
                                                            <Play className="h-2.5 w-2.5" />
                                                        )}
                                                        <span>{latestRecording.duration > 0 ? `${Math.floor(latestRecording.duration / 60)}m ${latestRecording.duration % 60}s` : "Recording"}</span>
                                                    </button>
                                                    {playingRecording === latestRecording.id && (
                                                        <audio
                                                            ref={audioRef}
                                                            src={getAudioSrc(latestRecording.recordingUrl, latestRecording.id)}
                                                            autoPlay
                                                            onEnded={() => setPlayingRecording(null)}
                                                            className="hidden"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        {lead.biodata ? (
                                            <p
                                                className="text-xs text-gray-600 line-clamp-2 cursor-default"
                                                title={lead.biodata}
                                            >
                                                {lead.biodata}
                                            </p>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        {lead.salesNotes ? (
                                            <p
                                                className="text-xs text-indigo-600 font-medium line-clamp-2 cursor-default"
                                                title={lead.salesNotes}
                                            >
                                                {lead.salesNotes}
                                            </p>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm font-bold
                                                        ${lead.category === 'Converted' ? 'text-purple-600' :
                                                        lead.category === 'Hot' ? 'text-red-600' :
                                                            lead.category === 'Warm' ? 'text-amber-600' :
                                                                lead.category === 'Cold' ? 'text-blue-600' :
                                                                    lead.category === 'Rejected' ? 'text-gray-500' :
                                                                        'text-gray-400'}`}>
                                                    {lead.score || 0}
                                                </span>
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                        ${lead.category === 'Converted' ? 'bg-purple-100 text-purple-800' :
                                                        lead.category === 'Hot' ? 'bg-red-100 text-red-800' :
                                                            lead.category === 'Warm' ? 'bg-amber-100 text-amber-800' :
                                                                lead.category === 'Cold' ? 'bg-blue-100 text-blue-800' :
                                                                    lead.category === 'Rejected' ? 'bg-gray-100 text-gray-800' :
                                                                        'bg-gray-50 text-gray-500'}`}>
                                                    {lead.category || "Not Interested"}
                                                </span>
                                            </div>
                                            {lead.tags?.includes("ai call qualified") && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-600 text-white w-fit">
                                                    <span>🤖</span> AI Call Qualified
                                                </span>
                                            )}
                                            {lead.tags?.includes("ai qualified") && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white w-fit">
                                                    <span>⭐</span> AI Qualified
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.source === "GMAIL" ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                                <Mail className="h-3 w-3 text-red-600" />
                                                Gmail
                                            </span>
                                        ) : lead.source === "META_ADS" ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                Meta Ads
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 capitalize">
                                                {lead.source.toLowerCase().replace("_", " ")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{lead.assignedTo?.name || "Unassigned"}</div>
                                        {lead.assignedTo && (
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                                                {lead.assignedTo.role.replace("_", " ")}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                                lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                                                    lead.status === 'LOST' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => setSelectedLeadForCalls(lead)}
                                            className="text-indigo-500 hover:text-indigo-700 mr-3"
                                            title="Call Details"
                                        >
                                            <Phone className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedLeadForActivity(lead)}
                                            className="text-gray-400 hover:text-gray-600 mr-3"
                                            title="View Timeline"
                                        >
                                            <History className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedLead(lead); setIsEditModalOpen(true); }}
                                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleScheduleMeeting(lead)}
                                            className="text-orange-500 hover:text-orange-700 mr-3"
                                            title="Schedule Meeting (Google Meet)"
                                        >
                                            <img src={calendlyLogo} alt="Calendly" className="h-4 w-4 object-contain" />
                                        </button>
                                        {getLeadLayer(lead) === "Layer 3" && (
                                            <button
                                                onClick={() => handleConvertLead(lead)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors border border-emerald-200"
                                                title="Mark as Converted"
                                            >
                                                <CheckCheck className="h-3.5 w-3.5" />
                                                Convert
                                            </button>
                                        )}
                                        {!lead.callStatus || lead.callStatus === "failed" ? (
                                            <button
                                                onClick={() => handleTriggerCall(lead)}
                                                disabled={triggeringCallId === lead.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-bold transition-colors border border-violet-200 disabled:opacity-50 ml-1"
                                                title="Trigger AI auto-call"
                                            >
                                                {triggeringCallId === lead.id
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : <BotIcon className="h-3.5 w-3.5" />}
                                                AI Call
                                            </button>
                                        ) : (
                                            <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                lead.callStatus === "completed" ? "bg-green-100 text-green-700" :
                                                lead.callStatus === "calling"   ? "bg-blue-100 text-blue-700 animate-pulse" :
                                                lead.callStatus === "queued"    ? "bg-amber-100 text-amber-700" :
                                                "bg-gray-100 text-gray-500"
                                            }`}>
                                                {lead.callStatus}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredLeads?.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="px-6 py-10 text-center text-sm text-gray-500">
                                        No leads found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredLeads?.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredLeads.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Lead"
            >
                <AddLeadForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>

            {/* Merge Modal - Render directly without generic Modal wrapper for custom layout if needed, or wrap */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsMergeModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <MergeLeadModal
                                leads={filteredLeads.filter(l => selectedLeads.includes(l.id))}
                                onClose={() => setIsMergeModalOpen(false)}
                                onSuccess={() => {
                                    setSelectedLeads([]);
                                    window.location.reload(); // Simple reload for now
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Distribute Modal */}
            <Modal
                isOpen={isDistributeModalOpen}
                onClose={() => setIsDistributeModalOpen(false)}
                title="Distribute Leads"
            >
                <DistributeLeadsModal
                    leadIds={selectedLeads}
                    onClose={() => setIsDistributeModalOpen(false)}
                    onSuccess={() => {
                        setSelectedLeads([]);
                        alert("Leads distributed successfully");
                    }}
                />
            </Modal>

            {/* Call Detail Modal */}
            {selectedLeadForCalls && (
                <CallDetailModal
                    lead={selectedLeadForCalls}
                    callLogs={selectedLeadForCalls.callLogs || []}
                    onClose={() => setSelectedLeadForCalls(null)}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
                />
            )}

            {/* Activity Modal */}
            {selectedLeadForActivity && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setSelectedLeadForActivity(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <LeadActivityModal
                                lead={selectedLeadForActivity}
                                onClose={() => setSelectedLeadForActivity(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setSelectedLead(null); }}
                title="Edit Lead"
            >
                <AddLeadForm initialData={selectedLead} onClose={() => { setIsEditModalOpen(false); setSelectedLead(null); }} />
            </Modal>
        </div>
    );
};

export default Leads;
