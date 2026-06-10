import {
    LayoutDashboard, Users, UserCog, CheckSquare, Settings, Puzzle, BarChart,
    Building, MessageSquare, Clock, Calendar, LogOut, Trophy, SearchCheck,
    Linkedin, KanbanSquare, Zap, Receipt, PhoneCall, Megaphone, Phone,
    FileCheck2, PhoneIncoming, BarChart2, CreditCard,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import { useVoiceLink } from "../context/VoiceLinkContext";
import { useMessageNotification } from "../context/MessageNotificationContext";
import Avatar from "./Avatar";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard",         path: "/dashboard",      resource: "dashboard"      },
    { icon: SearchCheck,     label: "Search Leads",      path: "/search-leads",   resource: "search-leads"   },
    { icon: Linkedin,        label: "LinkedIn Leads",    path: "/linkedin-leads", resource: "linkedin-leads" },
    { icon: KanbanSquare,    label: "Kanban Board",      path: "/kanban",         resource: "kanban"         },
    { icon: Zap,             label: "Sprints",           path: "/sprints",        resource: "sprints"        },
    { icon: Users,           label: "Leads",             path: "/leads",          resource: "leads"          },
    { icon: UserCog,         label: "User Management",   path: "/team",           resource: "team"           },
    { icon: CheckSquare,     label: "Tasks",             path: "/tasks",          resource: "tasks"          },
    { icon: Megaphone,       label: "Campaigns",         path: "/campaigns",      resource: "campaigns"      },
    { icon: Phone,           label: "Activity Hub",      path: "/call-logs",      resource: "call-logs"      },
    { icon: BarChart,        label: "Reports",           path: "/reports",        resource: "reports"        },
    { icon: Trophy,          label: "Leaderboard",       path: "/leaderboard",    resource: "leaderboard"    },
    { icon: Building,        label: "Departments",       path: "/departments",    resource: "departments"    },
    { icon: MessageSquare,   label: "Teams",             path: "/messages",       resource: "messages"       },
    { icon: Clock,           label: "Attendance",        path: "/attendance",     resource: "attendance"     },
    { icon: Calendar,        label: "Leave",             path: "/leave",          resource: "leave"          },
    { icon: Receipt,         label: "Invoices & Billing",path: "/invoices",       resource: "invoices"       },
    { icon: FileCheck2,      label: "SLA",               path: "/sla",            resource: "sla"            },
    { icon: Zap,             label: "FasterQ",           path: "/fasterq",        resource: "fasterq"        },
    { icon: Puzzle,          label: "Integrations",      path: "/integrations",   resource: "integrations"   },
    { icon: Settings,        label: "Settings",          path: "/settings",       resource: "settings"       },
];

const NavLink = ({ item, isActive, badge }) => (
    <Link
        to={item.path}
        className={cn(
            "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
            isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
    >
        <item.icon
            className={cn(
                "mr-3 h-5 w-5 transition-colors",
                isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
            )}
        />
        <span className="flex-1">{item.label}</span>
        {badge > 0 && (
            <span className="ml-auto min-w-[20px] px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white text-center leading-tight">
                {badge > 99 ? "99+" : badge}
            </span>
        )}
    </Link>
);

const Sidebar = () => {
    const location = useLocation();
    const { user, logout, onlineStatus } = useAuth();
    const { getSidebarItems } = usePermissions();
    const isPlatformOwner = user?.role === "PLATFORM_OWNER";
    const isSuperAdmin    = user?.role === "SUPER_ADMIN";

    const { hasClient } = useVoiceLink() || {};
    const { totalUnread } = useMessageNotification();
    const filteredItems = getSidebarItems(sidebarItems);

    // PLATFORM_OWNER always sees ZenVoice; SUPER_ADMIN only after they've purchased a client account
    const showZenCall = isPlatformOwner || (isSuperAdmin && hasClient);
    const zenCallActive = location.pathname.startsWith("/zenvoice");

    // ZX Call: always visible to SUPER_ADMIN (page guards its own access)
    const showZXCall = isSuperAdmin;
    const zxCallActive = location.pathname.startsWith("/zxcall-management");

    // Call Analytics: visible to SUPER_ADMIN, ADMIN, TEAM_LEAD
    const showCallAnalytics = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"].includes(user?.role);
    const callAnalyticsActive = location.pathname.startsWith("/team/call-analytics");

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-10 hidden md:flex flex-col">
            <div className="flex items-center h-16 px-6 border-b border-gray-200">
                <img src="/zenxai-logo.png" alt="ZenxAI Logo" className="h-30 w-30 object-contain" />
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        item={item}
                        isActive={location.pathname === item.path}
                        badge={item.resource === "messages" ? totalUnread : 0}
                    />
                ))}

                {showZenCall && (
                    <>
                        <div className="pt-3 pb-1">
                            <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400">ZenVoice</p>
                        </div>
                        <Link
                            to="/zenvoice"
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                                zenCallActive
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <PhoneIncoming
                                className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    zenCallActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                                )}
                            />
                            ZenVoice
                        </Link>
                    </>
                )}

                {showZXCall && (
                    <>
                        <div className="pt-3 pb-1">
                            <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400">ZX Call</p>
                        </div>
                        <Link
                            to="/zxcall-management"
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                                zxCallActive
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <PhoneCall
                                className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    zxCallActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                                )}
                            />
                            ZX Call
                        </Link>
                    </>
                )}

                {showCallAnalytics && (
                    <Link
                        to="/team/call-analytics"
                        className={cn(
                            "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                            callAnalyticsActive
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                    >
                        <BarChart2
                            className={cn(
                                "mr-3 h-5 w-5 transition-colors",
                                callAnalyticsActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                            )}
                        />
                        Call Analytics
                    </Link>
                )}

                {isSuperAdmin && (
                    <>
                        <div className="pt-3 pb-1">
                            <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Account</p>
                        </div>
                        <Link
                            to="/subscription"
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                                location.pathname === "/subscription"
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <CreditCard
                                className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    location.pathname === "/subscription" ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                                )}
                            />
                            Subscription
                        </Link>
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Avatar user={user} size="sm" status={onlineStatus} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.name || "User"}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email || "No Email"}</p>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors group"
                >
                    <LogOut className="mr-3 h-5 w-5 text-red-500 group-hover:text-red-600" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
