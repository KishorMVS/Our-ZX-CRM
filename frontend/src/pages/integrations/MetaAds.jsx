import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/axios";
import { Loader2, TrendingUp, Users, Eye, MousePointerClick, Calendar, Filter, ArrowLeft } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

const MetaAds = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("Overview");
    const [selectedAccount, setSelectedAccount] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const syncLeadsMutation = useMutation({
        mutationFn: async () => {
            const res = await api.get("/integrations/meta/fetch-leads");
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["metaAds", "leads"]);
        }
    });

    // Fetch Status/Accounts
    const { data: accounts, isLoading: isLoadingAccounts, error: accountsError } = useQuery({
        queryKey: ["metaAds", "accounts"],
        queryFn: async () => {
            const res = await api.get("/integrations/meta/accounts");
            return res.data.data || [];
        },
        retry: 1,
        staleTime: 1000 * 60 * 15
    });

    // Auto-select first account (onSuccess was removed in React Query v5)
    useEffect(() => {
        if (accounts && accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(accounts[0].id);
        }
    }, [accounts]);

    const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
        queryKey: ["metaAds", "campaigns", selectedAccount],
        queryFn: async () => {
            const res = await api.get(`/integrations/meta/campaigns?accountId=${selectedAccount}`);
            return res.data.data;
        },
        enabled: !!selectedAccount,
        staleTime: 1000 * 60 * 15
    });

    const { data: adSets, isLoading: isLoadingAdSets } = useQuery({
        queryKey: ["metaAds", "adsets", selectedAccount],
        queryFn: async () => {
            const res = await api.get(`/integrations/meta/adsets?accountId=${selectedAccount}`);
            return res.data.data;
        },
        enabled: !!selectedAccount,
        staleTime: 1000 * 60 * 15
    });

    const { data: ads, isLoading: isLoadingAds } = useQuery({
        queryKey: ["metaAds", "ads", selectedAccount],
        queryFn: async () => {
            const res = await api.get(`/integrations/meta/ads?accountId=${selectedAccount}`);
            return res.data.data;
        },
        enabled: !!selectedAccount,
        staleTime: 1000 * 60 * 15
    });

    const { data: leads, isLoading: isLoadingLeads } = useQuery({
        queryKey: ["metaAds", "leads"],
        queryFn: async () => {
            const res = await api.get("/integrations/meta/leads?limit=1000");
            return res.data.data;
        },
        staleTime: 1000 * 60 * 15
    });

    const tabs = ["Overview", "Campaigns", "Ad Sets", "Ads", "Leads"];

    // Aggregated KPI Data
    const aggregatedData = useMemo(() => {
        if (!campaigns) return { spend: 0, impressions: 0, clicks: 0, leads: leads?.length || 0 };
        return campaigns.reduce((acc, c) => {
            if (c.insights && c.insights.data && c.insights.data.length > 0) {
                const ins = c.insights.data[0];
                acc.spend += parseFloat(ins.spend || 0);
                acc.impressions += parseInt(ins.impressions || 0, 10);
                acc.clicks += parseInt(ins.clicks || 0, 10);
            }
            return acc;
        }, { spend: 0, impressions: 0, clicks: 0, leads: leads?.length || 0 });
    }, [campaigns, leads]);

    // Filtered items
    const filterByStatus = (items) => {
        if (!items) return [];
        if (statusFilter === "All") return items;
        return items.filter(i => i.status?.toUpperCase() === statusFilter.toUpperCase());
    };

    if (isLoadingAccounts) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (accountsError) {
        return (
            <div className="text-center mt-20 space-y-3">
                <h2 className="text-xl font-bold text-gray-800">Meta Ads Not Connected</h2>
                <p className="text-gray-500 mt-2">{accountsError.response?.data?.error || "Please connect your Meta Ads account from the Integrations page first."}</p>
                <button
                    onClick={() => navigate("/integrations")}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Go to Integrations
                </button>
            </div>
        );
    }

    if (!accounts || accounts.length === 0) {
        return (
            <div className="text-center mt-20">
                <h2 className="text-xl font-bold text-gray-800">No Ad Accounts Found</h2>
                <p className="text-gray-500 mt-2">Please ensure your Meta account has ad accounts associated with it.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate("/integrations")}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        title="Back to Integrations"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Meta Ads Dashboard</h1>
                        <p className="text-sm text-gray-500">Manage your Facebook and Instagram campaigns.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <select 
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_id})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`${
                                activeTab === tab
                                    ? "border-indigo-500 text-indigo-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {activeTab === "Overview" && (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                                        <TrendingUp className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Spend</dt>
                                            <dd className="text-lg font-semibold text-gray-900">₹{aggregatedData.spend.toFixed(2)}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                                        <Users className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Leads</dt>
                                            <dd className="text-lg font-semibold text-gray-900">{aggregatedData.leads}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                                        <Eye className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Impressions</dt>
                                            <dd className="text-lg font-semibold text-gray-900">{aggregatedData.impressions}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                                        <MousePointerClick className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Clicks</dt>
                                            <dd className="text-lg font-semibold text-gray-900">{aggregatedData.clicks}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Dummy Data (Real chart logic would process daily insights) */}
                        <div className="bg-white shadow rounded-lg p-6 h-96">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Spend vs Leads (Coming Soon)</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[]}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis yAxisId="left" orientation="left" stroke="#4f46e5" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#16a34a" />
                                    <Tooltip />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="spend" fill="#4f46e5" name="Spend (₹)" />
                                    <Line yAxisId="right" type="monotone" dataKey="leads" stroke="#16a34a" name="Leads" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === "Campaigns" && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between">
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border-gray-300 rounded-md text-sm"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Paused">Paused</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                        {isLoadingCampaigns ? <div className="p-10 text-center"><Loader2 className="animate-spin inline h-6 w-6 text-indigo-600" /></div> : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objective</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filterByStatus(campaigns)?.map(camp => {
                                        const ins = camp.insights?.data?.[0] || {};
                                        return (
                                            <tr key={camp.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{camp.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${camp.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{camp.status}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{camp.objective || 'N/A'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{ins.spend || '0.00'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.impressions || '0'}</td>
                                            </tr>
                                        )
                                    })}
                                    {(!campaigns || filterByStatus(campaigns).length === 0) && (
                                        <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-500">No campaigns found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === "Ad Sets" && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border-gray-300 rounded-md text-sm">
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Paused">Paused</option>
                            </select>
                        </div>
                        {isLoadingAdSets ? <div className="p-10 text-center"><Loader2 className="animate-spin inline h-6 w-6 text-indigo-600" /></div> : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Set Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filterByStatus(adSets)?.map(adset => {
                                        const ins = adset.insights?.data?.[0] || {};
                                        return (
                                            <tr key={adset.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{adset.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${adset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{adset.status}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{adset.daily_budget ? (adset.daily_budget / 100).toFixed(0) + '/day' : 'N/A'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{ins.spend || '0.00'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.impressions || '0'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.clicks || '0'}</td>
                                            </tr>
                                        );
                                    })}
                                    {(!adSets || filterByStatus(adSets).length === 0) && (
                                        <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No ad sets found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === "Ads" && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border-gray-300 rounded-md text-sm">
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Paused">Paused</option>
                            </select>
                        </div>
                        {isLoadingAds ? <div className="p-10 text-center"><Loader2 className="animate-spin inline h-6 w-6 text-indigo-600" /></div> : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filterByStatus(ads)?.map(ad => {
                                        const ins = ad.insights?.data?.[0] || {};
                                        return (
                                            <tr key={ad.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ad.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${ad.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{ad.status}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{ins.spend || '0.00'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.impressions || '0'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.clicks || '0'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ins.ctr ? `${parseFloat(ins.ctr).toFixed(2)}%` : '0%'}</td>
                                            </tr>
                                        );
                                    })}
                                    {(!ads || filterByStatus(ads).length === 0) && (
                                        <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No ads found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === "Leads" && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">Recent Leads</h3>
                            <button
                                onClick={() => syncLeadsMutation.mutate()}
                                disabled={syncLeadsMutation.isPending}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {syncLeadsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Sync Leads
                            </button>
                        </div>
                        {isLoadingLeads ? <div className="p-10 text-center"><Loader2 className="animate-spin inline h-6 w-6 text-indigo-600" /></div> : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {leads?.map(lead => (
                                        <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/leads')}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{lead.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.metaPlatform || 'Meta Ads'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.metaCampaignName || 'Unknown'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(lead.createdAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {(!leads || leads.length === 0) && (
                                        <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-500">No Meta leads found yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MetaAds;
