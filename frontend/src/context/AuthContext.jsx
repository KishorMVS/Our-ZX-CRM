import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as loginApi, registerCompany as registerCompanyApi } from "../api/auth";
import api from "../api/axios";

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(sessionStorage.getItem("token"));
    const [loading, setLoading] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState("OFFLINE");
    const [statusLoading, setStatusLoading] = useState(false);

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        const tokenExpiry = sessionStorage.getItem("tokenExpiry");

        if (token && tokenExpiry) {
            const now = new Date().getTime();
            if (now > parseInt(tokenExpiry)) {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("tokenExpiry");
                setToken(null);
                setUser(null);
                setLoading(false);
                return;
            }
        }

        if (token && storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setOnlineStatus(parsed.onlineStatus || "OFFLINE");
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        try {
            const data = await loginApi({ email, password });
            const { token, user } = data;

            const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000);

            sessionStorage.setItem("token", token);
            sessionStorage.setItem("user", JSON.stringify(user));
            sessionStorage.setItem("tokenExpiry", expiryTime.toString());

            setToken(token);
            setUser(user);
            setOnlineStatus(user.onlineStatus || "OFFLINE");
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || "Login failed",
            };
        }
    };

    const registerCompany = async ({ companyName, adminName, adminEmail, adminPassword }) => {
        try {
            const data = await registerCompanyApi({ companyName, adminName, adminEmail, adminPassword });
            const { token, user } = data;

            const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000);

            sessionStorage.setItem("token", token);
            sessionStorage.setItem("user", JSON.stringify(user));
            sessionStorage.setItem("tokenExpiry", expiryTime.toString());

            setToken(token);
            setUser(user);
            setOnlineStatus("ONLINE");
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || "Registration failed",
            };
        }
    };

    const logout = async () => {
        try {
            if (token) {
                await api.post("/auth/logout");
            }
        } catch (error) {
            console.error("Backend logout notification failed:", error);
        } finally {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("tokenExpiry");
            sessionStorage.removeItem("streamToken");
            setToken(null);
            setUser(null);
            setOnlineStatus("OFFLINE");
            window.location.href = "/login";
        }
    };

    // Update the user's online presence status
    const updateStatus = useCallback(async (status) => {
        if (statusLoading) return;
        setStatusLoading(true);
        try {
            const res = await api.patch("/user-status/me", { status });
            const updatedUser = { ...user, onlineStatus: status, breakStartedAt: res.data.user.breakStartedAt };
            setUser(updatedUser);
            setOnlineStatus(status);
            sessionStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setStatusLoading(false);
        }
    }, [user, statusLoading]);

    // Expose a way for other parts of the app to sync user object (e.g. after profile update)
    const refreshUser = useCallback((updatedUser) => {
        const merged = { ...user, ...updatedUser };
        setUser(merged);
        setOnlineStatus(merged.onlineStatus || onlineStatus);
        sessionStorage.setItem("user", JSON.stringify(merged));
    }, [user, onlineStatus]);

    const value = {
        user,
        token,
        loading,
        login,
        registerCompany,
        logout,
        isAuthenticated: !!token,
        onlineStatus,
        updateStatus,
        statusLoading,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
