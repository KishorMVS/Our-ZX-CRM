import axios from "axios";

// Create Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        let token = null;

        // Prioritize platform token for platform/reseller API requests
        const isPlatformReq = config.url?.includes("/voicelink/reseller") ||
                              config.url?.includes("/voicelink/client/create") ||
                              config.url?.includes("/platform");

        if (isPlatformReq) {
            token = localStorage.getItem("platform_token");
        }

        if (!token) {
            token = sessionStorage.getItem("token") || localStorage.getItem("token");
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Auth Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            if (window.location.pathname.startsWith("/platform")) {
                localStorage.removeItem("platform_token");
                localStorage.removeItem("platform_owner");
                localStorage.removeItem("platform_token_expiry");
                window.location.href = "/platform/login";
            } else {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("tokenExpiry");
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
