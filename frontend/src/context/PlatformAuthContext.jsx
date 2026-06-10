import { createContext, useContext, useState } from "react";
import { platformApi } from "../api/platform";

const PlatformAuthContext = createContext(null);

export const usePlatformAuth = () => {
    const ctx = useContext(PlatformAuthContext);
    if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
    return ctx;
};

function readStorage() {
    const token = localStorage.getItem("platform_token");
    if (!token) return { token: null, owner: null };

    const expiry = localStorage.getItem("platform_token_expiry");
    if (expiry && Date.now() > parseInt(expiry)) {
        localStorage.removeItem("platform_token");
        localStorage.removeItem("platform_owner");
        localStorage.removeItem("platform_token_expiry");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("tokenExpiry");
        return { token: null, owner: null };
    }

    const raw = localStorage.getItem("platform_owner");
    const owner = raw ? JSON.parse(raw) : null;

    // Sync CRM token so AppLayout sees the owner as authenticated without re-login
    if (owner && !localStorage.getItem("token")) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(owner));
        if (expiry) localStorage.setItem("tokenExpiry", expiry);
    }

    return { token, owner };
}

export const PlatformAuthProvider = ({ children }) => {
    const init = readStorage();
    const [token, setToken] = useState(init.token);
    const [owner, setOwner] = useState(init.owner);

    const login = async (email, password) => {
        try {
            // Use platformApi directly — avoids CRM axios interceptors
            const res = await platformApi.post("/platform/auth/login", { email, password });
            const { token: t, user } = res.data;

            const expiry = Date.now() + 24 * 60 * 60 * 1000;

            // Platform portal storage
            localStorage.setItem("platform_token", t);
            localStorage.setItem("platform_owner", JSON.stringify(user));
            localStorage.setItem("platform_token_expiry", String(expiry));

            // Also store as CRM token — same JWT, so /zencall (AppLayout) sees the owner as logged in
            localStorage.setItem("token", t);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("tokenExpiry", String(expiry));

            setToken(t);
            setOwner(user);
            return { success: true };
        } catch (err) {
            // Don't let platformApi's 401 interceptor redirect during login itself
            return { success: false, message: err.response?.data?.message || "Login failed" };
        }
    };

    const logout = () => {
        // Clear both platform and CRM session
        localStorage.removeItem("platform_token");
        localStorage.removeItem("platform_owner");
        localStorage.removeItem("platform_token_expiry");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("tokenExpiry");
        setToken(null);
        setOwner(null);
        window.location.href = "/platform/login";
    };

    return (
        <PlatformAuthContext.Provider value={{ owner, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </PlatformAuthContext.Provider>
    );
};
