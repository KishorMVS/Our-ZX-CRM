import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/axios";
import { Loader2, ArrowLeft, Mail, RefreshCw, Settings, LayoutDashboard, UserCheck, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

const Gmail = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("overview");

    const { data: status, isLoading: isStatusLoading } = useQuery({
        queryKey: ["gmailStatus"],
        queryFn: async () => {
            const res = await api.get("/integrations/gmail/status");
            return res.data;
        },
    });

    const { data: leadsData, isLoading: isLeadsLoading } = useQuery({
        queryKey: ["gmailLeads"],
        queryFn: async () => {
            const res = await api.get("/integrations/gmail/leads?limit=1000");
            return res.data;
        },
        enabled: !!status?.connected,
        staleTime: 15 * 60 * 1000, // 15 mins
    });

    const { data: teamMembers } = useQuery({
        queryKey: ["team"],
        queryFn: async () => {
            const res = await api.get("/team");
            return res.data;
        },
        enabled: !!status?.connected,
    });

    const syncMutation = useMutation({
        mutationFn: async () => {
            return await api.post("/integrations/gmail/sync");
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["gmailLeads"]);
            alert("Sync completed successfully!");
        },
        onError: (err) => {
            alert(err.response?.data?.message || "Sync failed");
        }
    });

    const settingsMutation = useMutation({
        mutationFn: async (data) => {
            return await api.patch("/integrations/gmail/settings", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["gmailStatus"]);
            alert("Settings saved!");
        }
    });

    // Form state for settings
    const [labels, setLabels] = useState("");
    const [assignee, setAssignee] = useState("");

    // Setup initial settings form
    useMemo(() => {
        if (status?.settings) {
            setLabels(status.settings.labelFilters?.join(", ") || "INBOX");
            setAssignee(status.settings.autoAssignUserId || "");
        }
    }, [status]);

    const handleSaveSettings = (e) => {
        e.preventDefault();
        const labelArr = labels.split(",").map(l => l.trim()).filter(Boolean);
        settingsMutation.mutate({ labelFilters: labelArr.length ? labelArr : ["INBOX"], autoAssignUserId: assignee });
    };

    const leads = leadsData?.data || [];

    // KPI Calc
    const thisWeek = leads.filter(l => dayjs(l.gmailReceivedAt).isAfter(dayjs().subtract(7, 'day'))).length;
    const thisMonth = leads.filter(l => dayjs(l.gmailReceivedAt).isAfter(dayjs().subtract(30, 'day'))).length;
    const unassigned = leads.filter(l => !l.assignedToId).length;

    // Chart Data
    const chartData = useMemo(() => {
        const last30Days = Array.from({ length: 30 }, (_, i) => {
            const d = dayjs().subtract(29 - i, 'day').format('MMM DD');
            return { date: d, count: 0 };
        });
        
        leads.forEach(lead => {
            if (!lead.gmailReceivedAt) return;
            const d = dayjs(lead.gmailReceivedAt).format('MMM DD');
            const found = last30Days.find(item => item.date === d);
            if (found) found.count++;
        });
        return last30Days;
    }, [leads]);

    if (isStatusLoading || (isLeadsLoading && status?.connected)) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
    }

    if (!status?.connected) {
        return (
            <div className="text-center mt-20">
                <h2 className="text-xl font-bold text-gray-800">Gmail Not Connected</h2>
                <button onClick={() => navigate("/integrations")} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md">Go to Integrations</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/integrations")} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <Mail className="h-6 w-6 text-red-500" /> Gmail Leads Dashboard
                        </h1>
                        <p className="text-sm text-gray-500">Manage and track your email enquiries.</p>
                    </div>
                </div>
                <button 
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    {syncMutation.isPending ? "Syncing..." : "Sync Now"}
                </button>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'overview', name: 'Overview', icon: LayoutDashboard },
                        { id: 'leads', name: 'Inbox Leads', icon: Mail },
                        { id: 'settings', name: 'Settings', icon: Settings },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                ${activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                            `}
                        >
                            <tab.icon className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400'}`} />
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <p className="text-sm font-medium text-gray-500">Total Leads Captured</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{leads.length}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <p className="text-sm font-medium text-gray-500">This Week</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{thisWeek}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <p className="text-sm font-medium text-gray-500">This Month</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{thisMonth}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <p className="text-sm font-medium text-gray-500">Unassigned Leads</p>
                            <p className="mt-2 text-3xl font-bold text-red-600">{unassigned}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Leads Captured (Last 30 Days)</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                    <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Leads" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'leads' && (
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden animate-in fade-in">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sender</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Captured</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leads.map((lead) => (
                                <tr key={lead.id} onClick={() => navigate(`/leads`)} className="hover:bg-gray-50 cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{lead.gmailSenderName || lead.name}</div>
                                        <div className="text-sm text-gray-500">{lead.gmailSenderEmail}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 line-clamp-1 max-w-xs">{lead.gmailSubject}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {dayjs(lead.gmailReceivedAt).format('MMM DD, YYYY HH:mm')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {lead.assignedTo?.name || <span className="text-red-500 italic">Unassigned</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                            lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No Gmail leads found. Try clicking "Sync Now".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 max-w-2xl animate-in fade-in">
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Watched Labels/Filters</label>
                            <p className="text-xs text-gray-500 mb-2">Comma separated list of Gmail labels to sync leads from (e.g., INBOX, leads, enquiry)</p>
                            <input 
                                type="text"
                                value={labels}
                                onChange={e => setLabels(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Auto-Assign New Leads</label>
                            <select
                                value={assignee}
                                onChange={e => setAssignee(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            >
                                <option value="">Do not auto-assign (Unassigned)</option>
                                {teamMembers?.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button 
                                type="submit"
                                disabled={settingsMutation.isPending}
                                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {settingsMutation.isPending ? "Saving..." : "Save Settings"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Gmail;
