import { useState, useEffect, useRef, useCallback } from "react";
import JsSIP from "jssip";
import {
    Phone, PhoneOff, PhoneIncoming, Mic, MicOff,
    Loader2, AlertCircle, Volume2,
} from "lucide-react";
import api from "../api/axios";

const DIALER_KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];

export default function ZenDialer() {
    const [creds, setCreds]           = useState(null);   // { wsUri, sipDomain, username, password, techPrefix }
    const [credsErr, setCredsErr]     = useState("");
    const [status, setStatus]         = useState("idle"); // idle | connecting | registered | calling | ringing | active | failed
    const [callNumber, setCallNumber] = useState("");
    const [muted, setMuted]           = useState(false);
    const [error, setError]           = useState("");
    const [callDuration, setCallDuration] = useState(0);

    const uaRef       = useRef(null);
    const sessionRef  = useRef(null);
    const remoteAudio = useRef(null);
    const timerRef    = useRef(null);

    // Fetch SIP credentials from backend on mount
    useEffect(() => {
        api.get("/voicelink/sip-credentials")
            .then(res => setCreds(res.data))
            .catch(() => setCredsErr("Could not load SIP credentials. Check your ZenCall account."));
    }, []);

    const cleanup = useCallback(() => {
        clearInterval(timerRef.current);
        setCallDuration(0);
        sessionRef.current = null;
    }, []);

    // Register UA once credentials are available
    useEffect(() => {
        if (!creds?.username || !creds?.password) return;

        JsSIP.debug.disable("JsSIP:*");

        const socket = new JsSIP.WebSocketInterface(creds.wsUri);
        const ua = new JsSIP.UA({
            sockets:          [socket],
            uri:              `sip:${creds.username}@${creds.sipDomain}`,
            password:         creds.password,
            register:         true,
            register_expires: 300,
            connection_recovery_min_interval: 2,
            connection_recovery_max_interval: 30,
        });

        ua.on("connecting",   () => setStatus("connecting"));
        ua.on("connected",    () => {});
        ua.on("disconnected", () => { setStatus("idle"); setError("WebSocket disconnected."); });
        ua.on("registered",   () => { setStatus("registered"); setError(""); });
        ua.on("unregistered", () => setStatus("idle"));
        ua.on("registrationFailed", (e) => {
            setStatus("failed");
            setError(`Registration failed: ${e.cause}`);
        });

        ua.on("newRTCSession", ({ session }) => {
            sessionRef.current = session;

            if (session.direction === "incoming") {
                setStatus("ringing");
                session.on("ended",  () => { setStatus("registered"); cleanup(); });
                session.on("failed", () => { setStatus("registered"); cleanup(); });
            }

            session.on("confirmed", () => {
                setStatus("active");
                const conn = session.connection;
                if (conn && remoteAudio.current) {
                    conn.getReceivers().forEach(r => {
                        if (r.track?.kind === "audio") {
                            const stream = new MediaStream([r.track]);
                            remoteAudio.current.srcObject = stream;
                            remoteAudio.current.play().catch(() => {});
                        }
                    });
                }
                timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
            });
        });

        ua.start();
        uaRef.current = ua;

        return () => {
            ua.stop();
            uaRef.current = null;
            cleanup();
        };
    }, [creds, cleanup]);

    const dial = useCallback(() => {
        if (!uaRef.current || status !== "registered" || !callNumber) return;
        setError("");
        const prefix = creds?.techPrefix ?? "45454";
        const domain = creds?.sipDomain  ?? "app.voicelink.co.in";
        const target = `sip:${prefix}${callNumber.replace(/\D/g, "")}@${domain}`;
        const session = uaRef.current.call(target, {
            mediaConstraints: { audio: true, video: false },
            pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
        });
        sessionRef.current = session;
        setStatus("calling");

        session.on("progress",  () => setStatus("calling"));
        session.on("accepted",  () => setStatus("active"));
        session.on("confirmed", () => setStatus("active"));
        session.on("ended",     () => { setStatus("registered"); cleanup(); });
        session.on("failed",    (e) => {
            setStatus("registered");
            setError(`Call failed: ${e.cause}`);
            cleanup();
        });
    }, [status, callNumber, creds, cleanup]);

    const hangup = useCallback(() => {
        sessionRef.current?.terminate();
        setStatus("registered");
        cleanup();
    }, [cleanup]);

    const answer = useCallback(() => {
        sessionRef.current?.answer({ mediaConstraints: { audio: true, video: false } });
        setStatus("active");
    }, []);

    const toggleMute = useCallback(() => {
        const s = sessionRef.current;
        if (!s) return;
        muted ? s.unmute() : s.mute();
        setMuted(m => !m);
    }, [muted]);

    const sendDTMF = (key) => {
        if (status === "active") sessionRef.current?.sendDTMF(key);
        else setCallNumber(n => n + key);
    };

    const fmtDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const statusLabel = {
        idle:       "Not connected",
        connecting: "Connecting…",
        registered: "Ready",
        calling:    "Calling…",
        ringing:    "Incoming call",
        active:     fmtDuration(callDuration),
        failed:     "Connection failed",
    }[status] ?? status;

    const statusColor = {
        registered: "text-green-600 bg-green-50",
        active:     "text-indigo-700 bg-indigo-50",
        ringing:    "text-amber-700 bg-amber-50",
        calling:    "text-blue-600 bg-blue-50",
        failed:     "text-red-600 bg-red-50",
    }[status] ?? "text-gray-500 bg-gray-100";

    return (
        <div className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-5 text-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        <span className="text-sm font-semibold">ZenDialer</span>
                        {creds?.username && (
                            <span className="text-[10px] text-indigo-200 font-mono">{creds.username}</span>
                        )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColor}`}>
                        {["connecting", "calling"].includes(status)
                            ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{statusLabel}</span>
                            : statusLabel
                        }
                    </span>
                </div>

                {/* Number display */}
                <div className="bg-indigo-800/40 rounded-xl px-4 py-3 min-h-[48px] flex items-center justify-between">
                    <span className="text-xl font-mono tracking-widest text-white/90 flex-1">
                        {callNumber || <span className="text-white/40 text-base">Enter number…</span>}
                    </span>
                    {callNumber && (
                        <button onClick={() => setCallNumber(n => n.slice(0, -1))}
                            className="text-white/60 hover:text-white text-lg leading-none ml-2">⌫</button>
                    )}
                </div>
            </div>

            {(error || credsErr) && (
                <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex gap-1.5 items-start">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{error || credsErr}
                </div>
            )}

            {/* Incoming call banner */}
            {status === "ringing" && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PhoneIncoming className="h-4 w-4 animate-pulse" />
                        <span className="font-medium">Incoming call</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={answer}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                            Answer
                        </button>
                        <button onClick={hangup}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                            Decline
                        </button>
                    </div>
                </div>
            )}

            {/* Dial pad */}
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                    {DIALER_KEYS.map(key => (
                        <button key={key} onClick={() => sendDTMF(key)}
                            className="h-12 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-semibold text-lg transition-colors border border-gray-100 active:scale-95">
                            {key}
                        </button>
                    ))}
                </div>

                {/* Action row */}
                <div className="flex items-center justify-center gap-4 pt-1">
                    {status === "active" && (
                        <button onClick={toggleMute}
                            className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                                muted ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </button>
                    )}

                    {(status === "registered" || status === "idle") ? (
                        <button onClick={dial} disabled={status !== "registered" || !callNumber}
                            className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white flex items-center justify-center shadow-lg transition-all active:scale-95">
                            <Phone className="h-6 w-6" />
                        </button>
                    ) : (status === "calling" || status === "active") ? (
                        <button onClick={hangup}
                            className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-95">
                            <PhoneOff className="h-6 w-6" />
                        </button>
                    ) : null}

                    {status === "active" && (
                        <div className="h-11 w-11 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Volume2 className="h-5 w-5" />
                        </div>
                    )}
                </div>

                {!creds && !credsErr && (
                    <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading credentials…
                    </p>
                )}
            </div>

            <audio ref={remoteAudio} autoPlay />
        </div>
    );
}
