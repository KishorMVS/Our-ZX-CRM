import { useState, useEffect } from "react";
import { LiveKitRoom, VideoConference, RoomAudioRenderer, useLocalParticipant, useParticipants, useTracks, VideoTrack, ControlBar } from "@livekit/components-react";
import "@livekit/components-styles";
import { useLiveKit } from "../context/LiveKitContext";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { X, Users, Disc, Send, UserPlus, Loader2, User, Mic, MicOff, PhoneOff, MonitorUp } from "lucide-react";
import toast from "react-hot-toast";
import { Track } from "livekit-client";

export default function CallSession() {
    const { callState, endCall, inviteUser } = useLiveKit();
    const { user } = useAuth();
    
    const [isRecording, setIsRecording] = useState(false);
    const [egressId, setEgressId] = useState(null);
    const [recordingLoading, setRecordingLoading] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Fetch active users to invite
    useEffect(() => {
        if (showInviteModal) {
            setLoadingUsers(true);
            api.get("/chat/users")
                .then((res) => {
                    // Filter out current user
                    setOnlineUsers(res.data.filter((u) => u.id !== user?.id));
                })
                .catch((err) => {
                    console.error("Failed to fetch users to invite:", err);
                    toast.error("Failed to load users list");
                })
                .finally(() => {
                    setLoadingUsers(false);
                });
        }
    }, [showInviteModal, user]);

    if (callState.status !== "connected" || !callState.token || !callState.serverUrl) {
        return null;
    }

    // Toggle server-side Egress recording
    const toggleRecording = async () => {
        if (recordingLoading) return;
        setRecordingLoading(true);

        try {
            if (!isRecording) {
                // Start Server-Side Egress Recording
                const response = await api.post("/livekit/recording/start", {
                    roomName: callState.roomName,
                });
                setEgressId(response.data.egressId);
                setIsRecording(true);
                toast.success("Server-side call recording started");
            } else {
                // Stop Server-Side Recording
                if (egressId) {
                    await api.post("/livekit/recording/stop", {
                        egressId,
                    });
                }
                setIsRecording(false);
                setEgressId(null);
                toast.success("Recording stopped. File is processing...");
            }
        } catch (error) {
            console.error("Recording error:", error);
            toast.error(error.response?.data?.message || "Failed to toggle call recording");
        } finally {
            setRecordingLoading(false);
        }
    };

    // Auto-stop recording on hanging up
    const handleLeave = async () => {
        if (isRecording && egressId) {
            try {
                await api.post("/livekit/recording/stop", { egressId });
            } catch (e) {
                console.error("Failed to stop recording on exit:", e);
            }
        }
        endCall();
    };

    const handleSendInvite = (targetId, targetName) => {
        inviteUser(targetId);
        toast.success(`Sent call invite to ${targetName}`);
    };

    return (
        <div className="fixed inset-0 z-[8888] bg-gray-950 flex flex-col animate-fade-in">
            {/* LiveKit Video Room */}
            <LiveKitRoom
                video={callState.type === "video"}
                audio={true}
                token={callState.token}
                serverUrl={callState.serverUrl}
                connect={true}
                onDisconnected={handleLeave}
                data-lk-theme="default"
                className="flex-1 flex flex-col relative min-h-0"
            >
                {/* Custom Overlay Controls */}
                <div className="absolute top-4 right-4 z-[999] flex items-center gap-3">
                    {/* Recording Button */}
                    <button
                        onClick={toggleRecording}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95 border cursor-pointer ${
                            isRecording
                                ? "bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse"
                                : "bg-white/10 hover:bg-white/20 text-white border-white/10"
                        }`}
                    >
                        {recordingLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Disc className={`h-4 w-4 ${isRecording ? "text-white fill-white" : "text-red-500 fill-red-500"}`} />
                        )}
                        {isRecording ? "Stop Recording" : "Record"}
                    </button>

                    {/* Invite Button */}
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-lg cursor-pointer"
                    >
                        <UserPlus className="h-4 w-4" />
                        Invite Participant
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={handleLeave}
                        className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                        title="End Call"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Conference Layout */}
                <div className="flex-1 min-h-0">
                    {callState.type === "video" ? (
                        <CustomVideoConference onLeave={handleLeave} />
                    ) : (
                        <CustomAudioConference onLeave={handleLeave} />
                    )}
                </div>

                {/* Room Audio Renderer (important to hear others) */}
                <RoomAudioRenderer />
            </LiveKitRoom>

            {/* Invite Participants Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[80vh] animate-scale-in">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-600" />
                                Invite Users
                            </h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-2 min-h-0">
                            {loadingUsers ? (
                                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                                    <span>Loading active contacts...</span>
                                </div>
                            ) : onlineUsers.length === 0 ? (
                                <p className="text-gray-400 text-center py-6">No online users available</p>
                            ) : (
                                onlineUsers.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition border border-transparent hover:border-gray-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img
                                                    src={u.image}
                                                    alt={u.name}
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                                />
                                                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 text-sm">{u.name}</div>
                                                <div className="text-xs text-gray-500">{u.role}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSendInvite(u.id, u.name)}
                                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <Send className="h-3 w-3" />
                                            Invite
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CustomVideoConference({ onLeave }) {
    const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
    const isScreenSharingActive = screenShareTracks.length > 0;

    if (isScreenSharingActive) {
        return <CustomScreenShareConference onLeave={onLeave} screenShareTracks={screenShareTracks} />;
    }

    return <VideoConference />;
}

function CustomScreenShareConference({ onLeave, screenShareTracks }) {
    const { localParticipant } = useLocalParticipant();
    const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

    const localScreenShare = screenShareTracks.find(t => t.participant.isLocal);
    const remoteScreenShare = screenShareTracks.find(t => !t.participant.isLocal);

    const handleStopScreenShare = async () => {
        if (localParticipant) {
            try {
                await localParticipant.setScreenShareEnabled(false);
                toast.success("Stopped screen sharing");
            } catch (err) {
                console.error("Failed to stop screen sharing:", err);
                toast.error("Could not stop screen sharing");
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-slate-950 text-white h-full p-4 pb-24 gap-4 overflow-hidden relative select-none">
            {/* Main Content Area (Screen Share or Presentation Card) */}
            <div className="flex-1 flex items-center justify-center min-w-0 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner aspect-video md:aspect-auto">
                {localScreenShare ? (
                    // Presenter Mode (Google Meet Style Presentation Card)
                    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 mb-4 animate-pulse">
                            <MonitorUp className="h-10 w-10 text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-100">You're presenting your screen</h3>
                        <p className="text-sm text-slate-400 mt-1 mb-6 font-medium">Everyone in the call can see your screen</p>
                        <button
                            onClick={handleStopScreenShare}
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl active:scale-95 transition-all shadow-lg shadow-red-600/10 cursor-pointer"
                        >
                            Stop Presenting
                        </button>
                    </div>
                ) : remoteScreenShare ? (
                    // Receiver Mode (Display remote screen share track)
                    <div className="w-full h-full flex flex-col justify-between relative">
                        <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200">
                            {remoteScreenShare.participant.name || remoteScreenShare.participant.identity}'s screen
                        </div>
                        <VideoTrack trackRef={remoteScreenShare} className="w-full h-full object-contain" />
                    </div>
                ) : null}
            </div>

            {/* Sidebar / Participant Videos Column (Google Meet Style Column) */}
            <div className="w-full md:w-80 flex md:flex-col gap-3 overflow-x-auto md:overflow-x-visible md:overflow-y-auto pr-1 shrink-0 scrollbar-thin">
                {cameraTracks.map((trackRef) => {
                    const participant = trackRef.participant;
                    const isSpeaking = participant.isSpeaking;
                    const isMuted = !participant.isMicrophoneEnabled;

                    return (
                        <div
                            key={participant.sid || participant.identity}
                            className={`w-48 md:w-full aspect-video rounded-xl bg-slate-900 border overflow-hidden relative flex-shrink-0 transition-all duration-200 ${
                                isSpeaking
                                    ? "border-green-500 ring-2 ring-green-500/20"
                                    : "border-slate-800"
                            }`}
                        >
                            {/* Render Camera Stream */}
                            <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />

                            {/* Participant Label & Status Overlays */}
                            <div className="absolute bottom-2 left-2 bg-slate-950/70 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 max-w-[70%] truncate">
                                {participant.name || participant.identity} {participant.isLocal && "(You)"}
                            </div>

                            {/* Mute Overlay Icon */}
                            {isMuted && (
                                <div className="absolute top-2 right-2 bg-red-600/90 p-1 rounded-full shadow-md">
                                    <MicOff className="h-3 w-3 text-white" />
                                </div>
                            )}

                            {/* Speaking Overlay Icon */}
                            {!isMuted && isSpeaking && (
                                <div className="absolute top-2 right-2 bg-green-500/95 p-1 rounded-full shadow-md animate-bounce">
                                    <Mic className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Floating Control Bar at the bottom */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur flex items-center gap-2">
                <ControlBar controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: false }} />
            </div>
        </div>
    );
}

function CustomAudioConference({ onLeave }) {
    const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
    const participants = useParticipants();

    const handleToggleMic = async () => {
        if (localParticipant) {
            try {
                await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
            } catch (err) {
                console.error("Failed to toggle microphone:", err);
                toast.error("Could not toggle microphone");
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white relative p-6 h-full select-none">
            {/* Background decorative glowing circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            {/* Title / Header */}
            <div className="text-center z-10 mb-8">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Voice Call
                </span>
                <h2 className="text-2xl font-bold text-slate-100 mt-3">Connected Session</h2>
                <p className="text-sm text-slate-400 mt-1">
                    {participants.length} {participants.length === 1 ? "participant" : "participants"} in call
                </p>
            </div>

            {/* Participants Grid / List */}
            <div className="flex flex-wrap items-center justify-center gap-8 max-w-4xl z-10 mb-12">
                {participants.map((p) => {
                    const isSpeaking = p.isSpeaking;
                    const isMuted = !p.isMicrophoneEnabled;
                    
                    return (
                        <div
                            key={p.sid || p.identity}
                            className="flex flex-col items-center gap-3 transition-all duration-300 transform"
                        >
                            {/* Avatar Container */}
                            <div className="relative">
                                {/* Speaking indicator ring */}
                                <div
                                    className={`absolute inset-0 rounded-full transition-all duration-300 ${
                                        isSpeaking
                                            ? "ring-4 ring-green-500 ring-offset-4 ring-offset-slate-950 scale-105 animate-pulse"
                                            : "ring-2 ring-slate-800 ring-offset-2 ring-offset-slate-950"
                                    }`}
                                ></div>

                                {/* Avatar Circle */}
                                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center shadow-xl relative z-10 border border-slate-600/30">
                                    <User className="h-12 w-12 text-slate-300" />
                                    
                                    {/* Mute indicator overlay */}
                                    {isMuted && (
                                        <div className="absolute -bottom-1 -right-1 bg-red-600 border-2 border-slate-950 p-1.5 rounded-full z-20 shadow-md">
                                            <MicOff className="h-3.5 w-3.5 text-white" />
                                        </div>
                                    )}
                                    
                                    {/* Unmuted, speaking indicator overlay */}
                                    {!isMuted && isSpeaking && (
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-slate-950 p-1.5 rounded-full z-20 shadow-md animate-bounce">
                                            <Mic className="h-3.5 w-3.5 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Participant Identity */}
                            <div className="text-center">
                                <p className="font-semibold text-slate-200 text-sm max-w-[150px] truncate">
                                    {p.name || p.identity}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {p.isLocal ? "You" : "Remote Participant"}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Call Action Bar / Floating Controls */}
            <div className="z-10 flex items-center justify-center gap-6 bg-slate-900/90 border border-slate-800/80 px-8 py-4 rounded-3xl shadow-2xl backdrop-blur-md">
                {/* Mute/Unmute Toggle */}
                <button
                    onClick={handleToggleMic}
                    className={`p-4 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 ${
                        isMicrophoneEnabled
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50"
                            : "bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30"
                    }`}
                    title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
                >
                    {isMicrophoneEnabled ? (
                        <Mic className="h-6 w-6" />
                    ) : (
                        <MicOff className="h-6 w-6 text-red-500 animate-pulse" />
                    )}
                </button>

                {/* Hang up Button */}
                <button
                    onClick={onLeave}
                    className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-lg shadow-red-600/10 hover:shadow-red-600/25 transition-all duration-200 active:scale-95 border border-red-500/20"
                    title="Leave Call"
                >
                    <PhoneOff className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
}
