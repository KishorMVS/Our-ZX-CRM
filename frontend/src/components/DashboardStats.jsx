import { Users, UserPlus, CheckCircle, TrendingUp, DollarSign, Target, Bot, XCircle, Clock } from "lucide-react";
import { cn } from "../lib/utils";

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }) => {
    return (
        <div className="bg-white/80 backdrop-blur-xl overflow-hidden rounded-3xl border border-white/40 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 group relative h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent rounded-full -mr-8 -mt-8 opacity-50"></div>
            <div className="p-6">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className={cn("p-4 rounded-2xl transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-lg", colorClass)}>
                            <Icon className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 truncate">{title}</dt>
                            <dd className="flex items-baseline justify-between">
                                <div className="text-2xl font-black text-gray-900 tracking-tight">{value}</div>
                                {trend && (
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold",
                                        trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                        {trend > 0 ? `+${trend}%` : `${trend}%`}
                                    </span>
                                )}
                            </dd>
                            {subtext && (
                                <dd className="mt-2">
                                    <p className="text-[11px] text-gray-400 font-bold italic opacity-80 group-hover:opacity-100 transition-opacity truncate">
                                        {subtext}
                                    </p>
                                </dd>
                            )}
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardStats = ({ leads = [], tasks = [], analytics = {} }) => {
    const totalLeads = analytics.totalLeads || leads.length;
    const convertedLeads = analytics.convertedLeads || leads.filter(l => l.status === "CONVERTED").length;
    const lostLeads = analytics.lostLeads || leads.filter(l => l.status === "LOST").length;
    const aiQualifiedLeads = analytics.aiQualifiedLeads || leads.filter(l => l.tags?.some(t => ["ai qualified", "ai call qualified"].includes(t.toLowerCase()))).length;
    const aiHandoffCount = analytics.aiHandoffCount || (totalLeads - aiQualifiedLeads);

    const conversionRate = analytics.conversionRate || (totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0);
    const totalRevenue = analytics.totalRevenue || 0;
    const avgConversionDays = analytics.avgConversionDays || 0;

    const newLeadsToday = leads.filter(l => {
        const today = new Date().toISOString().split('T')[0];
        const created = new Date(l.createdAt).toISOString().split('T')[0];
        return today === created;
    }).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value={`₹${totalRevenue.toLocaleString()}`}
                    subtext="Net generated revenue"
                    icon={DollarSign}
                    colorClass="bg-emerald-500 shadow-emerald-200"
                />
                <StatCard
                    title="Conversion Rate"
                    value={`${conversionRate}%`}
                    subtext={`${avgConversionDays}d avg. conversion`}
                    icon={TrendingUp}
                    colorClass="bg-indigo-600 shadow-indigo-200"
                />
                <StatCard
                    title="Total Leads"
                    value={totalLeads}
                    subtext={`${newLeadsToday} new opportunities today`}
                    icon={Users}
                    colorClass="bg-blue-500 shadow-blue-200"
                />
                <StatCard
                    title="Won Deals"
                    value={convertedLeads}
                    subtext="Successfully closed"
                    icon={Target}
                    colorClass="bg-purple-500 shadow-purple-200"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <StatCard
                    title="AI Qualified"
                    value={aiQualifiedLeads}
                    subtext="Handed over by AI"
                    icon={Bot}
                    colorClass="bg-amber-500 shadow-amber-200"
                />
                <StatCard
                    title="AI → Human Handoff"
                    value={aiHandoffCount}
                    subtext="Waiting for human action"
                    icon={UserPlus}
                    colorClass="bg-orange-500 shadow-orange-200"
                />
                <StatCard
                    title="Lost Leads"
                    value={lostLeads}
                    subtext="Dropped from funnel"
                    icon={XCircle}
                    colorClass="bg-rose-500 shadow-rose-200"
                />
            </div>
        </div>
    );
};

export default DashboardStats;
