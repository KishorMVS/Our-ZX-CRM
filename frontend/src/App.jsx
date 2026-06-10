import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PermissionProvider } from "./context/PermissionContext";
import { PlatformAuthProvider } from "./context/PlatformAuthContext";
import AppLayout from "./layouts/AppLayout";
import PlatformLayout from "./layouts/PlatformLayout";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Leads from "./pages/Leads";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Departments from "./pages/Departments";
import DepartmentDetails from "./pages/DepartmentDetails";
import Messages from "./pages/Messages";
import Calendar from "./pages/Calendar";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Leaderboard from "./pages/Leaderboard";
import SearchLeads from "./pages/SearchLeads";
import LinkedInLeads from "./pages/LinkedInLeads";
import Kanban from "./pages/Kanban";
import Sprints from "./pages/Sprints";
import SprintAnalytics from "./pages/SprintAnalytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetail from "./pages/TaskDetail";
import Campaigns from "./pages/Campaigns";
import CallLogs from "./pages/CallLogs";
import InvoiceBilling from "./pages/InvoiceBilling";
import SLA from "./pages/SLA";
import FasterQCalls from "./pages/FasterQCalls";
import MetaAds from "./pages/integrations/MetaAds";
import Gmail from "./pages/integrations/Gmail";
import PlatformLogin from "./pages/platform/PlatformLogin";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformCompanies from "./pages/platform/PlatformCompanies";
import PlatformCompanyDetail from "./pages/platform/PlatformCompanyDetail";
import PlatformZXCall from "./pages/platform/PlatformZXCall";
import ZenCallPage, { ZenCallResellerView } from "./pages/ZenCallPage";
import ZenCallPurchasePage from "./pages/ZenCallPurchasePage";
import ZXCallOnboardPage from "./pages/ZXCallOnboardPage";
import VoiceAgentsPage from "./pages/VoiceAgentsPage";
import UserCallAnalytics from "./pages/UserCallAnalytics";
import ZXCallManagement from "./pages/ZXCallManagement";
import RoleRoute from "./components/RoleRoute";
import Subscription from "./pages/Subscription";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, staleTime: 0, refetchOnMount: "always" } },
});
queryClient.clear();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Toaster position="top-right" reverseOrder={false} />
            <PlatformAuthProvider>
                <Routes>
                    {/* ── Platform owner portal ── */}
                    <Route path="/platform/login" element={<PlatformLogin />} />
                    <Route path="/platform" element={<PlatformLayout />}>
                        <Route index element={<Navigate to="/platform/dashboard" replace />} />
                        <Route path="dashboard" element={<PlatformDashboard />} />
                        <Route path="companies" element={<PlatformCompanies />} />
                        <Route path="companies/:id" element={<PlatformCompanyDetail />} />
                        <Route path="zenvoice" element={<ZenCallResellerView />} />
                        <Route path="zxcall" element={<PlatformZXCall />} />
                    </Route>

                    {/* ── Company CRM ── */}
                    <Route
                        path="/*"
                        element={
                            <AuthProvider>
                                <PermissionProvider>
                                    <Routes>
                                        <Route path="/" element={<LandingPage />} />
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/register" element={<Register />} />

                                        <Route element={<AppLayout />}>
                                            <Route path="/dashboard" element={<Dashboard />} />
                                            <Route path="/search-leads" element={<SearchLeads />} />
                                            <Route path="/linkedin-leads" element={<LinkedInLeads />} />
                                            <Route path="/kanban" element={<Kanban />} />
                                            <Route path="/sprints" element={<Sprints />} />
                                            <Route path="/sprint-analytics/:id" element={<SprintAnalytics />} />
                                            <Route path="/campaigns" element={<Campaigns />} />
                                            <Route path="/call-logs" element={<CallLogs />} />
                                            <Route path="/leads" element={<Leads />} />
                                            <Route path="/team" element={<Team />} />
                                            <Route path="/team/call-analytics" element={<UserCallAnalytics />} />
                                            <Route path="/team/call-analytics/:userId" element={<UserCallAnalytics />} />
                                            <Route path="/zxcall-management" element={<ZXCallManagement />} />
                                            <Route path="/tasks" element={<Tasks />} />
                                            <Route path="/tasks/:id" element={<TaskDetail />} />
                                            <Route path="/integrations" element={<Integrations />} />
                                            <Route path="/integrations/meta-ads" element={<MetaAds />} />
                                            <Route path="/integrations/gmail" element={<Gmail />} />
                                            <Route path="/reports" element={<Reports />} />
                                            <Route path="/departments" element={<Departments />} />
                                            <Route path="/departments/:id" element={<DepartmentDetails />} />
                                            <Route path="/messages" element={<Messages />} />
                                            <Route path="/calendar" element={<Calendar />} />
                                            <Route path="/attendance" element={<Attendance />} />
                                            <Route path="/leave" element={<Leave />} />
                                            <Route path="/leaderboard" element={<Leaderboard />} />
                                            <Route path="/settings" element={<Settings />} />
                                            <Route path="/invoices" element={<InvoiceBilling />} />
                                            <Route path="/sla" element={<SLA />} />
                                            <Route path="/fasterq" element={<FasterQCalls />} />
                                            <Route path="/voice-agents" element={<VoiceAgentsPage />} />
                                            <Route path="/zxcall/onboard" element={<ZXCallOnboardPage />} />

                                            {/* ZenVoice — purchase flow for new SUPER_ADMIN */}
                                            <Route path="/subscription" element={
                                                <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
                                                    <Subscription />
                                                </RoleRoute>
                                            } />
                                            <Route path="/zenvoice/purchase" element={
                                                <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
                                                    <ZenCallPurchasePage />
                                                </RoleRoute>
                                            } />

                                            {/* ZenVoice — unified page for PLATFORM_OWNER and SUPER_ADMIN */}
                                            <Route path="/zenvoice" element={
                                                <RoleRoute allowedRoles={["PLATFORM_OWNER", "SUPER_ADMIN"]}>
                                                    <ZenCallPage />
                                                </RoleRoute>
                                            } />

                                            {/* Legacy VoiceLink routes → redirect to /zenvoice */}
                                            <Route path="/voicelink/*" element={<Navigate to="/zenvoice" replace />} />
                                        </Route>

                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </PermissionProvider>
                            </AuthProvider>
                        }
                    />
                </Routes>
            </PlatformAuthProvider>
        </QueryClientProvider>
    );
}

export default App;
