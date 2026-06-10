import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

const PermissionContext = createContext(null);

export const usePermissions = () => {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error("usePermissions must be used within a PermissionProvider");
    }
    return context;
};

export const PermissionProvider = ({ children }) => {
    const { user, isAuthenticated, refreshUser } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPermissions = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await api.get("/permissions/me");
            setPermissions(res.data);
        } catch (error) {
            console.error("Failed to fetch permissions:", error);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchPermissions();
        } else {
            setPermissions([]);
            setLoading(false);
        }
    }, [isAuthenticated, fetchPermissions]);

    const hasPermission = (resource, action = "view") => {
        // SUPER_ADMIN and ADMIN have all operational permissions
        if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") return true;

        // EMPLOYEE and TEAM_LEAD: leads module requires department leads-access flag
        if (resource === "leads" && !user?.departmentHasLeadsAccess) return false;

        return permissions.some(
            (p) => p.resource === resource && p.action === action
        );
    };

    const updateSidebarPreferences = async (sidebarPrefs) => {
        try {
            const newPrefs = {
                ...(user.preferences || {}),
                sidebar: sidebarPrefs
            };
            const res = await api.patch("/users/preferences", { preferences: newPrefs });
            refreshUser({ preferences: res.data.preferences });
            return { success: true };
        } catch (error) {
            console.error("Failed to update preferences:", error);
            return { success: false, error: error.message };
        }
    };

    const getSidebarItems = (all_items) => {
        const userPrefs = user?.preferences?.sidebar || {};
        
        return all_items.filter(item => {
            // First check RBAC permission
            const resource = item.resource || item.label.toLowerCase().replace(/\s+/g, '-');
            if (!hasPermission(resource, "view")) return false;

            // Then check user customization (default to true if not set)
            if (userPrefs[resource] === false) return false;

            return true;
        });
    };

    const value = {
        permissions,
        loading,
        hasPermission,
        updateSidebarPreferences,
        getSidebarItems,
        refreshPermissions: fetchPermissions
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
};
