import { useEffect, useState } from "react";
import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { usePlatformAuth } from "../context/PlatformAuthContext";
import { getZXCallRequests } from "../api/platform";
import { LayoutDashboard, Building2, LogOut, Shield, PhoneIncoming, PhoneCall } from "lucide-react";

const NAV = [
    { to: "/platform/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/platform/companies", icon: Building2, label: "Companies" },
];

const PlatformLayout = () => {
    const { isAuthenticated, owner, logout } = usePlatformAuth();
    const location = useLocation();
    const [zxPending, setZxPending] = useState(0);
    const [zxOverdue, setZxOverdue] = useState(0);

    useEffect(() => {
        if (!isAuthenticated) return;
        const SLA_MS = 48 * 60 * 60 * 1000;
        getZXCallRequests()
            .then((d) => {
                setZxPending(d.pendingProvision || 0);
                setZxOverdue(
                    (d.requests || []).filter(
                        (r) => r.status === "PAID" && r.paidAt && Date.now() - new Date(r.paidAt).getTime() > SLA_MS
                    ).length
                );
            })
            .catch(() => {});
    }, [isAuthenticated, location.pathname]);

    if (!isAuthenticated) {
        return <Navigate to="/platform/login" replace />;
    }

    const zenCallActive = location.pathname.startsWith("/platform/zenvoice");
    const zxCallActive  = location.pathname.startsWith("/platform/zxcall");

    return (
        <div className="flex min-h-screen bg-slate-950">
            {/* Sidebar */}
            <aside className="w-60 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
                {/* Logo */}
                <div className="px-5 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-semibold leading-none">ZenxAI</p>
                            <p className="text-slate-500 text-xs mt-0.5">Owner Portal</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {NAV.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                }`
                            }
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </NavLink>
                    ))}

                    {/* ZenVoice section */}
                    <div className="pt-3 pb-1">
                        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                            ZenVoice
                        </p>
                    </div>
                    <NavLink
                        to="/platform/zenvoice"
                        className={() =>
                            `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                zenCallActive
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            }`
                        }
                    >
                        <PhoneIncoming className="h-4 w-4 shrink-0" />
                        Reseller Account
                    </NavLink>

                    {/* ZX Call section */}
                    <div className="pt-3 pb-1">
                        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                            ZX Call
                        </p>
                    </div>
                    <NavLink
                        to="/platform/zxcall"
                        className={() =>
                            `flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                zxCallActive
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            }`
                        }
                    >
                        <span className="flex items-center gap-2.5">
                            <PhoneCall className="h-4 w-4 shrink-0" />
                            Requests
                        </span>
                        {zxPending > 0 && (
                            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold ${zxOverdue > 0 ? "bg-rose-500 animate-pulse" : "bg-amber-500"}`}>
                                {zxPending}
                            </span>
                        )}
                    </NavLink>
                </nav>

                {/* User footer */}
                <div className="px-3 py-3 border-t border-slate-800">
                    <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl">
                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/30 flex items-center justify-center shrink-0">
                            <span className="text-indigo-400 text-xs font-bold">
                                {owner?.name?.[0]?.toUpperCase() || "O"}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-white text-xs font-medium truncate">{owner?.name || "Owner"}</p>
                            <p className="text-slate-500 text-xs truncate">{owner?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/8 rounded-xl text-sm transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-auto bg-slate-950">
                <Outlet />
            </main>
        </div>
    );
};

export default PlatformLayout;
