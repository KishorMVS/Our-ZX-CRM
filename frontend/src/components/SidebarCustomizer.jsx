import { useState } from "react";
import { usePermissions } from "../context/PermissionContext";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, UserCog, CheckSquare, Settings, Puzzle, BarChart, Building, MessageSquare, Clock, Calendar, Trophy, SearchCheck, Linkedin, KanbanSquare, Zap, Receipt, PhoneCall, Megaphone, Phone, Loader2, Save } from "lucide-react";

const allSidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", resource: "dashboard" },
    { icon: SearchCheck, label: "Search Leads", resource: "search-leads" },
    { icon: Linkedin, label: "LinkedIn Leads", resource: "linkedin-leads" },
    { icon: KanbanSquare, label: "Kanban Board", resource: "kanban" },
    { icon: Zap, label: "Sprints", resource: "sprints" },
    { icon: Users, label: "Leads", resource: "leads" },
    { icon: UserCog, label: "Team", resource: "team" },
    { icon: CheckSquare, label: "Tasks", resource: "tasks" },
    { icon: Megaphone, label: "Campaigns", resource: "campaigns" },
    { icon: Phone, label: "Activity Hub", resource: "call-logs" },
    { icon: BarChart, label: "Reports", resource: "reports" },
    { icon: Trophy, label: "Leaderboard", resource: "leaderboard" },
    { icon: Building, label: "Departments", resource: "departments" },
    { icon: MessageSquare, label: "Messages", resource: "messages" },
    { icon: Clock, label: "Attendance", resource: "attendance" },
    { icon: Calendar, label: "Leave", resource: "leave" },
    { icon: Receipt, label: "Invoices & Billing", resource: "invoices" },
    { icon: Puzzle, label: "Integrations", resource: "integrations" },
    { icon: Settings, label: "Settings", resource: "settings" },
];

const SidebarCustomizer = () => {
    const { user } = useAuth();
    const { hasPermission, updateSidebarPreferences } = usePermissions();
    const [isSaving, setIsSaving] = useState(false);
    const [prefs, setPrefs] = useState(user?.preferences?.sidebar || {});

    const availableItems = allSidebarItems.filter(item => hasPermission(item.resource, "view"));

    const handleToggle = (resource) => {
        setPrefs(prev => ({
            ...prev,
            [resource]: prev[resource] === false ? true : false
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await updateSidebarPreferences(prefs);
        setIsSaving(false);
        alert("Sidebar settings saved!");
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Sidebar Customization</h3>
                    <p className="text-sm text-gray-500">Choose which tabs you want to see in your sidebar.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Preferences
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableItems.map((item) => (
                    <div key={item.resource} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={prefs[item.resource] !== false}
                                onChange={() => handleToggle(item.resource)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SidebarCustomizer;
