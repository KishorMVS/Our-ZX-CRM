import axios from "axios";

export const platformApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:5001/api"}`,
});

platformApi.interceptors.request.use((config) => {
    const token = localStorage.getItem("platform_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

platformApi.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
            // Do not redirect if the request was to the login endpoint
            if (!err.config?.url?.includes("/auth/login")) {
                localStorage.removeItem("platform_token");
                localStorage.removeItem("platform_owner");
                window.location.href = "/platform/login";
            }
        }
        return Promise.reject(err);
    }
);

export const getPlatformStats = () => platformApi.get("/platform/stats").then(r => r.data);
export const getWorkspaces = (params) => platformApi.get("/platform/workspaces", { params }).then(r => r.data);
export const getWorkspaceDetail = (id) => platformApi.get(`/platform/workspaces/${id}`).then(r => r.data);
export const toggleWorkspaceStatus = (id) => platformApi.patch(`/platform/workspaces/${id}/toggle-status`).then(r => r.data);
export const deleteWorkspace = (id) => platformApi.delete(`/platform/workspaces/${id}`).then(r => r.data);
export const getZXCallRequests = () => platformApi.get("/platform/zxcall-requests").then(r => r.data);
export const activateZXCallRequest = (id, payload) => platformApi.patch(`/platform/zxcall-requests/${id}/activate`, payload).then(r => r.data);

// Absolute URL for uploaded documents (strips the trailing /api from the base)
export const fileUrl = (p) => {
    if (!p) return "";
    const base = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/api\/?$/, "");
    return `${base}${p}`;
};
