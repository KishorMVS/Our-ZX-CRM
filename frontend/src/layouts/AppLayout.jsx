import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import IncomingCallWidget from "../components/IncomingCallWidget";
import { useAuth } from "../context/AuthContext";
import { VoiceLinkProvider } from "../context/VoiceLinkContext";
import { LiveKitProvider } from "../context/LiveKitContext";
import { MessageNotificationProvider } from "../context/MessageNotificationContext";
import CallPopup from "../components/CallPopup";
import CallSession from "../components/CallSession";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";

export default function AppLayout() {
    const { isAuthenticated, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <LiveKitProvider>
            <MessageNotificationProvider>
            <VoiceLinkProvider>
                <div className="h-screen bg-gray-50 flex overflow-hidden">
                    {/* Sidebar Desktop */}
                    <Sidebar />

                    <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 min-h-0 overflow-hidden">
                        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

                        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-h-0">
                            <ErrorBoundary>
                                <Outlet />
                            </ErrorBoundary>
                        </main>
                    </div>
                </div>

                {/* Global LiveKit Calling Overlays */}
                <CallPopup />
                <CallSession />
            </VoiceLinkProvider>
            </MessageNotificationProvider>
        </LiveKitProvider>
    );
}
