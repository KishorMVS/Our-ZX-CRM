import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { StreamChat } from "stream-chat";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

const LiveKitContext = createContext(null);

export const useLiveKit = () => {
    const context = useContext(LiveKitContext);
    if (!context) {
        throw new Error("useLiveKit must be used within a LiveKitProvider");
    }
    return context;
};

export const LiveKitProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [chatClient, setChatClient] = useState(null);
    const [callState, setCallState] = useState({
        status: "idle", // idle | incoming | outgoing | connected
        roomName: null,
        token: null,
        serverUrl: null,
        type: "video", // video | audio
        callerName: "",
        callerId: "",
        inviteeId: "",
    });

    const ringtoneInterval = useRef(null);
    const audioContextRef = useRef(null);

    // Metadata for the in-progress call, used to write history when it ends.
    // Only the CALLER writes the CallEvent (role: "caller") to avoid duplicates.
    const callMetaRef = useRef(null);
    const loggedRef = useRef(false);
    // Mirror of callState.status so the once-created Stream event listeners can read
    // the live status (their closures would otherwise capture a stale callState).
    const callStatusRef = useRef("idle");

    // Post a call-history record (and inline chat bubble) to the backend.
    const postCallLog = useCallback(async (status, overrides = {}) => {
        const meta = callMetaRef.current;
        // Only the caller logs, and only once per call.
        if (!meta || meta.role !== "caller" || loggedRef.current) return;
        if (!meta.channelCid) return;
        loggedRef.current = true;
        try {
            await api.post("/chat/call-event", {
                channelCid: meta.channelCid,
                calleeId: meta.calleeId || null,
                callType: (meta.type || "video").toUpperCase(),
                status,
                startedAt: meta.startedAt,
                answeredAt: meta.answeredAt || null,
                endedAt: new Date().toISOString(),
                ...overrides,
            });
        } catch (err) {
            console.error("[CALL_LOG_ERROR]", err);
        }
    }, []);

    // Initialize AudioContext lazily for synthesized ringtone
    const playRingtone = useCallback(() => {
        if (ringtoneInterval.current) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const playTones = () => {
                if (ctx.state === "suspended") {
                    ctx.resume();
                }

                // Teams-style double ring tone: 440Hz + 480Hz
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gainNode = ctx.createGain();

                osc1.type = "sine";
                osc2.type = "sine";
                osc1.frequency.value = 440;
                osc2.frequency.value = 480;

                gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
                // Ramp down to soften ending
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

                osc1.connect(gainNode);
                osc2.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc1.start();
                osc2.start();

                osc1.stop(ctx.currentTime + 1.2);
                osc2.stop(ctx.currentTime + 1.2);
            };

            // Play immediately then every 2 seconds
            playTones();
            ringtoneInterval.current = setInterval(playTones, 2000);
        } catch (e) {
            console.error("Failed to play synthesized ringtone:", e);
        }
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneInterval.current) {
            clearInterval(ringtoneInterval.current);
            ringtoneInterval.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.error);
            audioContextRef.current = null;
        }
    }, []);

    // Global Stream Chat initialization (shared)
    useEffect(() => {
        if (!isAuthenticated || !user) {
            if (chatClient) {
                chatClient.disconnectUser().catch(console.error);
                setChatClient(null);
            }
            return;
        }

        let active = true;
        const connectStream = async () => {
            try {
                const response = await api.post("/chat/token");
                const { token, apiKey, user: streamUser } = response.data;

                if (!active) return;

                const client = StreamChat.getInstance(apiKey, { timeout: 10000 });
                if (client.userID !== streamUser.id) {
                    await client.connectUser(streamUser, token);
                }

                setChatClient(client);

                // Listen to client-wide custom events
                client.on("call_invite", async (event) => {
                    if (event.user.id === user.id) return; // Ignore own events

                    // Already in/placing a call → tell the caller we're busy and don't
                    // ring. Our ongoing call is left untouched. Works for audio + video.
                    if (["incoming", "outgoing", "connected"].includes(callStatusRef.current)) {
                        try {
                            const channelResponse = await api.post("/chat/start", { targetUserId: event.user.id });
                            const { cid } = channelResponse.data;
                            const channel = client.channel("messaging", cid.split(":")[1]);
                            await channel.watch();
                            await channel.sendEvent({ type: "call_busy", roomName: event.roomName });
                        } catch (err) {
                            console.error("[CALL_BUSY_SEND_ERROR]", err);
                        }
                        return;
                    }

                    console.log("[LIVEKIT] Received call invite:", event);
                    setCallState({
                        status: "incoming",
                        roomName: event.roomName,
                        type: event.callType || "video",
                        callerName: event.user.name || "Someone",
                        callerId: event.user.id,
                    });
                });

                // Callee is busy — caller is told and the outgoing call is aborted.
                client.on("call_busy", (event) => {
                    if (event.user.id === user.id) return;
                    if (callMetaRef.current?.roomName === event.roomName) {
                        const name = callMetaRef.current.calleeName || "This user";
                        loggedRef.current = true; // a busy attempt is a notice, not call history
                        callMetaRef.current = null;
                        stopRingtone();
                        setCallState({ status: "idle", roomName: null, token: null, serverUrl: null });
                        alert(`${name} is already in a call.`);
                    }
                });

                // Callee accepted — caller marks the answer time for duration tracking.
                client.on("call_accept", (event) => {
                    if (event.user.id === user.id) return;
                    const meta = callMetaRef.current;
                    if (meta && meta.roomName === event.roomName && !meta.answeredAt) {
                        meta.answeredAt = new Date().toISOString();
                    }
                });

                client.on("call_decline", (event) => {
                    console.log("[LIVEKIT] Call declined by", event.user.name);
                    if (callMetaRef.current?.roomName === event.roomName) {
                        postCallLog("DECLINED");
                    }
                    setCallState((prev) => {
                        if (prev.roomName === event.roomName) {
                            return { status: "idle", roomName: null, token: null, serverUrl: null };
                        }
                        return prev;
                    });
                });

                client.on("call_end", (event) => {
                    console.log("[LIVEKIT] Call ended remotely for room", event.roomName);
                    // Caller logs the terminal state (callee hung up). Answered → duration; else cancelled.
                    if (callMetaRef.current?.roomName === event.roomName) {
                        postCallLog(callMetaRef.current.answeredAt ? "ANSWERED" : "CANCELLED");
                    }
                    setCallState((prev) => {
                        if (prev.roomName === event.roomName) {
                            return { status: "idle", roomName: null, token: null, serverUrl: null };
                        }
                        return prev;
                    });
                });
            } catch (err) {
                console.error("[LIVEKIT_STREAM_INIT_FAILED]", err);
            }
        };

        connectStream();

        return () => {
            active = false;
        };
    }, [isAuthenticated, user]);

    // Keep the status ref in sync for the Stream event listeners (busy detection).
    useEffect(() => {
        callStatusRef.current = callState.status;
    }, [callState.status]);

    // Handle ringtone audio play/stop depending on call state
    useEffect(() => {
        if (callState.status === "incoming" || callState.status === "outgoing") {
            playRingtone();
        } else {
            stopRingtone();
        }
        return () => stopRingtone();
    }, [callState.status, playRingtone, stopRingtone]);

    /**
     * Start a call with another user or channel.
     */
    const startCall = async (channelOrUserId, type = "video") => {
        console.log("[LIVEKIT_CONTEXT] startCall triggered with:", channelOrUserId, "Type:", type);
        let roomName;
        let targetUserId = null;
        let channel = null;

        if (typeof channelOrUserId === "string") {
            targetUserId = channelOrUserId;
            roomName = `room-${user.id}-${targetUserId}-${Date.now()}`;
        } else {
            channel = channelOrUserId;
            const isGroup = channel.type === "team" || !!channel.data.name;
            if (isGroup) {
                roomName = `room-${channel.id}-${Date.now()}`;
            } else {
                const members = Object.keys(channel.state.members || {});
                targetUserId = members.find((id) => id !== user.id);
                roomName = `room-${user.id}-${targetUserId}-${Date.now()}`;
            }
        }

        console.log("[LIVEKIT_CONTEXT] Room Name generated:", roomName, "Target User ID:", targetUserId);

        // ── Resolve callee name (1:1 calls only) ──────────────────────────────
        // Presence no longer gates the call: a user can be reached in any state
        // (online, on break, or offline). We only fetch the name for later notices.
        let calleeName = null;
        if (targetUserId) {
            try {
                const { data: presence } = await api.get(`/chat/call-precheck/${targetUserId}`);
                calleeName = presence.name || null;
            } catch (precheckErr) {
                console.error("[CALL_PRECHECK] error (continuing):", precheckErr);
            }
        }

        // Reset history-logging guards for this new call.
        loggedRef.current = false;
        callMetaRef.current = {
            role: "caller",
            roomName,
            type,
            calleeId: targetUserId,
            calleeName,
            channelCid: null,
            startedAt: new Date().toISOString(),
            answeredAt: null,
        };

        setCallState({
            status: "outgoing",
            roomName,
            type,
            callerName: user.name,
            callerId: user.id,
            inviteeId: targetUserId,
        });

        try {
            console.log("[LIVEKIT_CONTEXT] Fetching join token from backend /api/livekit/token...");
            const response = await api.post("/livekit/token", {
                roomName,
                participantName: user.name,
            });
            console.log("[LIVEKIT_CONTEXT] Backend token response:", response.data);

            // Get or create channel if we only have targetUserId
            if (!channel && targetUserId) {
                console.log("[LIVEKIT_CONTEXT] Channel not provided. Initiating chat/start with target:", targetUserId);
                const channelResponse = await api.post("/chat/start", { targetUserId });
                const { cid } = channelResponse.data;
                channel = chatClient.channel("messaging", cid.split(":")[1]);
                await channel.watch();
            }

            // Record the channel for history logging once we know it.
            if (channel && callMetaRef.current) {
                callMetaRef.current.channelCid = channel.cid;
            }

            // Send call invite custom event
            if (channel) {
                console.log("[LIVEKIT_CONTEXT] Sending 'call_invite' event via Stream Chat channel:", channel.id);
                await channel.sendEvent({
                    type: "call_invite",
                    roomName,
                    callType: type,
                });
                console.log("[LIVEKIT_CONTEXT] Event sent successfully.");
            }

            setCallState((prev) => ({
                ...prev,
                token: response.data.token,
                serverUrl: response.data.serverUrl,
                status: "connected",
            }));
            console.log("[LIVEKIT_CONTEXT] Call state updated to connected.");
        } catch (error) {
            console.error("[LIVEKIT_CONTEXT] [START_CALL_ERROR]", error);
            setCallState({ status: "idle", roomName: null, token: null, serverUrl: null });
            alert("Could not start call: " + (error.response?.data?.message || error.message));
        }
    };

    /**
     * Invite another user while currently in an active call.
     */
    const inviteUser = async (targetUserId) => {
        if (callState.status !== "connected" || !callState.roomName) return;
        try {
            const channelResponse = await api.post("/chat/start", { targetUserId });
            const { cid } = channelResponse.data;
            const channel = chatClient.channel("messaging", cid.split(":")[1]);
            await channel.watch();

            await channel.sendEvent({
                type: "call_invite",
                roomName: callState.roomName,
                callType: callState.type,
            });
        } catch (err) {
            console.error("[INVITE_USER_ERROR]", err);
            alert("Failed to send invitation to user.");
        }
    };

    /**
     * Accept incoming call.
     */
    const acceptCall = async () => {
        if (callState.status !== "incoming" || !callState.roomName) return;

        try {
            const response = await api.post("/livekit/token", {
                roomName: callState.roomName,
                participantName: user.name,
            });

            // Mark ourselves as the callee so we DON'T also log the call (the caller
            // is the sole logger), and tell the caller we answered (for duration).
            callMetaRef.current = { role: "callee", roomName: callState.roomName };
            try {
                if (chatClient && callState.callerId) {
                    const channelResponse = await api.post("/chat/start", { targetUserId: callState.callerId });
                    const { cid } = channelResponse.data;
                    const channel = chatClient.channel("messaging", cid.split(":")[1]);
                    await channel.watch();
                    await channel.sendEvent({ type: "call_accept", roomName: callState.roomName });
                }
            } catch (acceptEvtErr) {
                console.error("[CALL_ACCEPT_EVENT_ERROR]", acceptEvtErr);
            }

            setCallState((prev) => ({
                ...prev,
                token: response.data.token,
                serverUrl: response.data.serverUrl,
                status: "connected",
            }));
        } catch (error) {
            console.error("[ACCEPT_CALL_ERROR]", error);
            setCallState({ status: "idle", roomName: null, token: null, serverUrl: null });
            alert("Could not join call: " + (error.response?.data?.message || error.message));
        }
    };

    /**
     * Decline incoming call.
     */
    const declineCall = async () => {
        if (!callState.roomName) return;

        try {
            if (chatClient && callState.callerId) {
                const channelResponse = await api.post("/chat/start", { targetUserId: callState.callerId });
                const { cid } = channelResponse.data;
                const channel = chatClient.channel("messaging", cid.split(":")[1]);
                await channel.watch();

                await channel.sendEvent({
                    type: "call_decline",
                    roomName: callState.roomName,
                });
            }
        } catch (err) {
            console.error("[DECLINE_CALL_ERROR]", err);
        } finally {
            setCallState({ status: "idle", roomName: null, token: null, serverUrl: null });
        }
    };

    /**
     * Hang up/End the call.
     */
    const endCall = useCallback(async () => {
        if (!callState.roomName) return;

        try {
            const targetId = callState.callerId === user.id ? callState.inviteeId : callState.callerId;
            if (chatClient && targetId) {
                const channelResponse = await api.post("/chat/start", { targetUserId: targetId });
                const { cid } = channelResponse.data;
                const channel = chatClient.channel("messaging", cid.split(":")[1]);
                await channel.watch();

                await channel.sendEvent({
                    type: "call_end",
                    roomName: callState.roomName,
                });
            }
        } catch (err) {
            console.error("[END_CALL_ERROR]", err);
        } finally {
            // Caller logs the terminal state. Answered → duration; hung up before
            // the callee answered → cancelled (shows as a missed call to the callee).
            if (callMetaRef.current?.role === "caller") {
                postCallLog(callMetaRef.current.answeredAt ? "ANSWERED" : "CANCELLED");
            }
            setCallState({ status: "idle", roomName: null, token: null, serverUrl: null });
        }
    }, [callState, chatClient, user, postCallLog]);

    return (
        <LiveKitContext.Provider
            value={{
                chatClient,
                callState,
                startCall,
                inviteUser,
                acceptCall,
                declineCall,
                endCall,
            }}
        >
            {children}
        </LiveKitContext.Provider>
    );
};
