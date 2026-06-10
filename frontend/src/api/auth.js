import api from "./axios";

export const login = async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
};

export const registerCompany = async (data) => {
    const response = await api.post("/auth/register-company", data);
    return response.data;
};

export const register = async (userData) => {
    const response = await api.post("/users/register", userData);
    return response.data;
};

export const getZenvoiceSSO = () => api.get("/auth/sso/zenvoice-token");
