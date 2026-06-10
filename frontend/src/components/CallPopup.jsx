import { useLiveKit } from "../context/LiveKitContext";
import { Phone, PhoneOff, Video, User } from "lucide-react";

export default function CallPopup() {
    const { callState, acceptCall, declineCall } = useLiveKit();

    if (callState.status !== "incoming") return null;

    const isVideo = callState.type === "video";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 border border-gray-200 shadow-2xl rounded-2xl p-6 max-w-sm w-full text-center relative overflow-hidden transition-all duration-300 transform scale-100 hover:scale-[1.02]">
                {/* Visual decorative ring background */}
                <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl"></div>

                {/* Ringing Animation Avatar */}
                <div className="relative mx-auto w-24 h-24 mb-4">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                    <div className="absolute inset-2 rounded-full bg-indigo-500/30 animate-pulse"></div>
                    <div className="absolute inset-4 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg border-2 border-white">
                        <User className="h-10 w-10" />
                    </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-1">
                    {callState.callerName}
                </h3>
                <p className="text-sm font-medium text-gray-500 mb-6 flex items-center justify-center gap-1.5 animate-pulse">
                    {isVideo ? (
                        <>
                            <Video className="h-4 w-4 text-indigo-500" />
                            Incoming Video Call...
                        </>
                    ) : (
                        <>
                            <Phone className="h-4 w-4 text-indigo-500" />
                            Incoming Audio Call...
                        </>
                    )}
                </p>

                {/* Call Action Buttons */}
                <div className="flex gap-4 justify-center items-center">
                    <button
                        onClick={declineCall}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-500/20 cursor-pointer"
                    >
                        <PhoneOff className="h-5 w-5" />
                        Decline
                    </button>
                    <button
                        onClick={acceptCall}
                        className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-green-500/20 cursor-pointer"
                    >
                        {isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
