import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { StreamChat } from "stream-chat";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { io as socketIO } from "socket.io-client";
import { useAuth } from "./AuthContext";
import api from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5001";

const MessageNotificationContext = createContext(null);

export const useMessageNotification = () => {
    const ctx = useContext(MessageNotificationContext);
    if (!ctx) throw new Error("useMessageNotification must be inside MessageNotificationProvider");
    return ctx;
};

export const MessageNotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [chatClient, setChatClient]               = useState(null);
    const [videoClient, setVideoClient]             = useState(null);
    const [totalUnread, setTotalUnread]             = useState(0);
    const [incomingCall, setIncomingCall]           = useState(null);  // Stream video call
    const [acceptedCall, setAcceptedCall]           = useState(null);  // after widget-accept
    const [streamReady, setStreamReady]             = useState(false);
    const [incomingTelecmiCall, setIncomingTelecmiCall] = useState(null); // TeleCMI inbound call

    const videoClientRef = useRef(null);
    const socketRef      = useRef(null);

    useEffect(() => {
        if (!user) return;

        let mounted = true;
        let _chat;
        let _video;

        const init = async () => {
            try {
                const res = await api.post("/chat/token");
                const { token, apiKey, user: streamUser } = res.data;
                if (!mounted) return;

                // Singleton — safe alongside any other StreamChat usage
                _chat = StreamChat.getInstance(apiKey);
                if (_chat.userID !== streamUser.id) {
                    await _chat.connectUser(streamUser, token);
                }

                if (!mounted) return;

                // Seed initial unread count
                try {
                    const { total_unread_count } = await _chat.getUnreadCount();
                    if (mounted) setTotalUnread(total_unread_count || 0);
                } catch {}

                // Track unread changes
                const onNewMessage = () => {
                    _chat.getUnreadCount().then(({ total_unread_count }) => {
                        if (mounted) setTotalUnread(total_unread_count || 0);
                    }).catch(() => {});
                };
                const onMarkRead = () => {
                    _chat.getUnreadCount().then(({ total_unread_count }) => {
                        if (mounted) setTotalUnread(total_unread_count || 0);
                    }).catch(() => {});
                };
                _chat.on("notification.message_new", onNewMessage);
                _chat.on("message.new", onNewMessage);
                _chat.on("notification.mark_read", onMarkRead);
                _chat.on("channel.truncated", onMarkRead);

                // Stream Video client
                _video = new StreamVideoClient({ apiKey, user: streamUser, token });
                videoClientRef.current = _video;

                if (mounted) {
                    setChatClient(_chat);
                    setVideoClient(_video);
                    setStreamReady(true);
                }

                // Incoming ring calls — detectable from any page
                _video.on("call.ring", async (event) => {
                    if (!mounted) return;
                    try {
                        const call = _video.call(event.call_type, event.call_id);
                        await call.get();
                        setIncomingCall({
                            call,
                            callerName: event.user?.name || "Someone",
                            callerId: event.user?.id,
                        });
                    } catch {}
                });

            } catch (err) {
                console.error("MessageNotificationContext init error:", err);
            }
        };

        init();

        // Socket.IO for TeleCMI inbound call notifications
        const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
        const socket = socketIO(SOCKET_URL, {
            auth: { token },
            transports: ["websocket", "polling"],
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            if (user?.workspaceId) socket.emit("join_workspace", user.workspaceId);
        });

        socket.on("inbound_call", (data) => {
            if (!mounted) return;
            setIncomingTelecmiCall(data);
            // Auto-clear after 25s if CDR webhook doesn't fire (TeleCMI timeout is 20s)
            setTimeout(() => {
                setIncomingTelecmiCall((cur) =>
                    cur?.callLogId === data.callLogId ? null : cur
                );
            }, 25000);
        });

        socket.on("inbound_call_ended", (data) => {
            if (!mounted) return;
            setIncomingTelecmiCall((cur) =>
                cur?.callLogId === data.callLogId ? null : cur
            );
        });

        return () => {
            mounted = false;
            if (_chat) {
                _chat.off("notification.message_new");
                _chat.off("message.new");
                _chat.off("notification.mark_read");
                _chat.off("channel.truncated");
                _chat.disconnectUser().catch(() => {});
            }
            if (_video) {
                _video.disconnectUser().catch(() => {});
                videoClientRef.current = null;
            }
            socket.disconnect();
            socketRef.current = null;
            setChatClient(null);
            setVideoClient(null);
            setStreamReady(false);
            setTotalUnread(0);
            setIncomingTelecmiCall(null);
        };
    }, [user]);

    // Called by IncomingCallWidget; navigation is handled by the widget (it has useNavigate)
    const acceptCall = useCallback(async () => {
        if (!incomingCall) return;
        try {
            await incomingCall.call.accept();
            setAcceptedCall(incomingCall.call);
        } catch {}
        setIncomingCall(null);
    }, [incomingCall]);

    const rejectCall = useCallback(async () => {
        if (!incomingCall) return;
        try {
            await incomingCall.call.reject();
        } catch {}
        setIncomingCall(null);
    }, [incomingCall]);

    // Messages.jsx calls this after it picks up acceptedCall
    const clearAcceptedCall = useCallback(() => setAcceptedCall(null), []);

    const dismissTelecmiCall = useCallback(() => setIncomingTelecmiCall(null), []);

    return (
        <MessageNotificationContext.Provider value={{
            chatClient,
            videoClient,
            totalUnread,
            setTotalUnread,
            incomingCall,
            acceptCall,
            rejectCall,
            acceptedCall,
            clearAcceptedCall,
            streamReady,
            incomingTelecmiCall,
            dismissTelecmiCall,
        }}>
            {children}
        </MessageNotificationContext.Provider>
    );
};
