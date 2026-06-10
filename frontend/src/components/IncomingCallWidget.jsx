import { Phone, PhoneOff, PhoneIncoming, Video, X, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessageNotification } from "../context/MessageNotificationContext";
import Avatar from "./Avatar";

// ── Stream Video incoming call (peer-to-peer from Messages page) ──────────────
function StreamCallCard({ incomingCall, acceptCall, rejectCall }) {
    const navigate = useNavigate();
    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="text-xs font-semibold text-white tracking-wide uppercase">Incoming Video Call</span>
            </div>

            <div className="px-5 py-4">
                <div className="flex items-center gap-4 mb-5">
                    <Avatar user={{ name: incomingCall.callerName }} size="lg" />
                    <div>
                        <p className="font-semibold text-gray-900 text-base">{incomingCall.callerName}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Video className="h-3.5 w-3.5" />
                            Video call
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={rejectCall}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
                    >
                        <PhoneOff className="h-4 w-4" />
                        Decline
                    </button>
                    <button
                        onClick={async () => { await acceptCall(); navigate("/messages"); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-md shadow-green-200"
                    >
                        <Phone className="h-4 w-4" />
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── TeleCMI inbound call (client called the DID number) ──────────────────────
function TelecmiCallCard({ call, dismiss }) {
    const navigate = useNavigate();

    const displayNumber = call.from
        ? call.from.replace(/^91/, "+91 ").replace(/(\d{5})(\d{5})$/, "$1 $2")
        : "Unknown";

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Pulsing green bar */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="text-xs font-semibold text-white tracking-wide uppercase flex-1">Incoming Phone Call</span>
                <button onClick={dismiss} className="text-white/70 hover:text-white transition-colors">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="px-5 py-4">
                <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <PhoneIncoming className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                        {call.leadName ? (
                            <>
                                <p className="font-semibold text-gray-900 text-base truncate">{call.leadName}</p>
                                <p className="text-sm text-gray-500 font-mono">{displayNumber}</p>
                            </>
                        ) : (
                            <>
                                <p className="font-semibold text-gray-900 text-base font-mono">{displayNumber}</p>
                                <p className="text-sm text-gray-400">Unknown caller</p>
                            </>
                        )}
                    </div>
                </div>

                <p className="text-xs text-gray-400 mb-4 text-center">
                    Your phone is ringing — pick it up to connect
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={dismiss}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                        Dismiss
                    </button>
                    {call.leadId && (
                        <button
                            onClick={() => { navigate(`/leads/${call.leadId}`); dismiss(); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-colors"
                        >
                            <ExternalLink className="h-4 w-4" />
                            View Lead
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main widget — renders whichever card is active ────────────────────────────
export default function IncomingCallWidget() {
    const { incomingCall, acceptCall, rejectCall, incomingTelecmiCall, dismissTelecmiCall } = useMessageNotification();

    // TeleCMI call takes visual precedence if both fire simultaneously
    if (incomingTelecmiCall) {
        return <TelecmiCallCard call={incomingTelecmiCall} dismiss={dismissTelecmiCall} />;
    }

    if (incomingCall) {
        return <StreamCallCard incomingCall={incomingCall} acceptCall={acceptCall} rejectCall={rejectCall} />;
    }

    return null;
}
