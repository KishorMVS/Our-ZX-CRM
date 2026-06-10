import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from "../api/axios";

const VoiceLinkContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useVoiceLink = () => useContext(VoiceLinkContext);

export const VoiceLinkProvider = ({ children }) => {
    const { user } = useAuth();
    const role = user?.role;

    const [hasClient, setHasClient]         = useState(false);
    const [isKycComplete, setIsKycComplete] = useState(false);
    const [isKycSubmitted, setIsKycSubmitted] = useState(false);
    const [clientId, setClientId]           = useState(null);
    const [checking, setChecking]           = useState(true);
    const [hasZXCall, setHasZXCall]         = useState(false);

    const markKycAsSubmitted = useCallback((cid) => {
        if (!cid) return;
        localStorage.setItem(`vlKycSubmitted_${cid}`, "1");
        setIsKycSubmitted(true);
    }, []);

    const refresh = useCallback(async () => {
        // Only SUPER_ADMIN has a ZenCall client account or ZX Call access
        if (role !== "SUPER_ADMIN") {
            setChecking(false);
            return;
        }

        // Check ZX Call activation status
        try {
            const zxRes = await api.get("/zxcall/my");
            setHasZXCall(zxRes.data?.request?.status === "ACTIVE");
        } catch {
            setHasZXCall(false);
        }
        setChecking(true);
        try {
            const res = await api.get("/voicelink/my-account");
            const c = res.data?.client;
            if (!c) {
                setHasClient(false);
                setIsKycComplete(false);
                setIsKycSubmitted(false);
                setClientId(null);
            } else {
                setHasClient(true);
                setClientId(c.clientId);
                
                // Check local submission flag
                const subKey = `vlKycSubmitted_${c.clientId}`;
                setIsKycSubmitted(!!localStorage.getItem(subKey));

                try {
                    const kycRes = await api.get(`/voicelink/kyc/status?client_id=${c.clientId}`);
                    const kData = kycRes.data?.data || kycRes.data || {};
                    const done = !!(
                        kData.is_complete || 
                        kData.is_kyc_complete || 
                        kData.kyc_status === 1 || 
                        kData.kyc_status_label === "Verified" ||
                        kData.is_verified || 
                        kData.is_kyc_verified || 
                        kData.kyc_verified ||
                        kData.kyc === "Verified" ||
                        kData.kyc === "verified" ||
                        (kData.kyc_status && String(kData.kyc_status).toLowerCase() === "verified") ||
                        (kData.status && String(kData.status).toLowerCase() === "verified")
                    );
                    setIsKycComplete(done);

                    if (done) {
                        // If truly done, clear the local submission flag
                        localStorage.removeItem(subKey);
                        setIsKycSubmitted(false);

                        const notifyKey = `vlKycNotified_${c.clientId}`;
                        if (!localStorage.getItem(notifyKey)) {
                            localStorage.setItem(notifyKey, "1");
                            api.post("/voicelink/kyc/notify-completed").catch(() => {});
                        }
                    }
                } catch {
                    setIsKycComplete(false);
                }
            }
        } catch {
            setHasClient(false);
            setIsKycComplete(false);
        } finally {
            setChecking(false);
        }
    }, [role]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <VoiceLinkContext.Provider value={{
            hasClient, isKycComplete, isKycSubmitted, clientId,
            checking, refresh, markKycAsSubmitted, hasZXCall,
        }}>
            {children}
        </VoiceLinkContext.Provider>
    );
};
