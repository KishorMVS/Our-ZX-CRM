import { useState, useEffect, useRef } from "react";
import {
    Chat,
    Channel,
    MessageInput,
    MessageList,
    Thread,
    Window,
    ChannelList,
    useChatContext,
    useChannelStateContext,
    useMessageContext,
    MessageSimple,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useLiveKit } from "../context/LiveKitContext";

import { useAuth } from "../context/AuthContext";
import { useMessageNotification } from "../context/MessageNotificationContext";
import api from "../api/axios";
import { Loader2, Video, Search, Plus, X, User, UserPlus, Users, Check, CheckCheck, Trash2, Phone, Trophy, PhoneMissed, PhoneOutgoing, PhoneIncoming } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Custom Empty State for when no chat is selected
const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
        <div className="bg-indigo-100 p-4 rounded-full mb-4">
            <User className="h-12 w-12 text-indigo-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
        <p className="text-gray-500 max-w-sm">
            Choose a contact from the sidebar or start a new chat to begin messaging.
        </p>
    </div>
);

// WhatsApp-style Message Status Ticks
const CustomMessageStatus = () => {
    const { client } = useChatContext();
    const { message } = useMessageContext();

    if (!message || !client) return null;

    // Only show ticks for own messages
    const isMe = message.user?.id === client.userID;
    if (!isMe) return null;

    const status = message.status;
    // Filter out the sender so we don't count self-read as "read"
    const readBy = (message.read_by || []).filter(u => u.id !== client.userID);
    const isRead = readBy.length > 0;

    if (status === 'sending') {
        return <Check className="h-3 w-3 text-gray-400 opacity-50 flex-shrink-0" strokeWidth={2.5} title="Sending" />;
    }

    if (isRead) {
        return <CheckCheck className="h-3 w-3 text-blue-400 flex-shrink-0" strokeWidth={2.5} title="Read" />;
    }

    return <CheckCheck className="h-3 w-3 text-gray-400 flex-shrink-0" strokeWidth={2.5} title="Delivered" />;
};

// WhatsApp-style inline call bubble (rendered for messages with customType "call")
const CallBubble = ({ message, currentUserId }) => {
    const isOutgoing = message.callerId === currentUserId;
    const status = message.callStatus;
    const isVideo = message.callType === "VIDEO";
    const missed = ["MISSED", "CANCELLED", "BLOCKED_OFFLINE"].includes(status);

    let Icon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
    if (missed) Icon = PhoneMissed;

    const tone = missed ? "text-red-600" : "text-gray-600";
    const time = message.created_at
        ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

    return (
        <div className="flex justify-center my-2">
            <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
                <Icon className={`h-4 w-4 ${tone}`} />
                <span className={`text-sm font-medium ${missed ? "text-red-600" : "text-gray-700"}`}>
                    {isVideo ? "Video" : "Voice"} · {message.text}
                </span>
                {time && <span className="text-[11px] text-gray-400">{time}</span>}
            </div>
        </div>
    );
};

// Thin wrapper — renders call bubbles inline, otherwise the default message.
// MessageStatus is injected via Channel's ComponentContext below.
const CustomMessage = (props) => {
    const { client } = useChatContext();
    if (props.message?.customType === "call") {
        return <CallBubble message={props.message} currentUserId={client?.userID} />;
    }
    return <MessageSimple {...props} />;
};

// WhatsApp-style Typing Indicator
const CustomTypingIndicator = () => {
    const { typing } = useChannelStateContext();
    const { client } = useChatContext();

    if (!typing || !client) return null;

    const typingUsers = Object.values(typing)
        .filter(t => t.user?.id !== client.userID)
        .map(t => t.user?.name || "Someone");

    if (typingUsers.length === 0) return null;

    return (
        <div className="px-4 py-1.5 bg-white/95 backdrop-blur-sm text-[11px] text-indigo-600 font-bold italic animate-pulse border-t border-indigo-50 flex items-center gap-2">
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
            </div>
            <span>
                {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...` 
                    : `${typingUsers.join(", ")} are typing...`}
            </span>
        </div>
    );
};

const Messages = () => {
    const { user } = useAuth();
    const { chatClient, videoClient, streamReady, acceptedCall, clearAcceptedCall } = useMessageNotification();
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);
    // Effective group-creation privilege (server still re-checks on every privileged call).
    const canCreateGroup = isAdmin || !!user?.canCreateGroup;
    const [isCreating, setIsCreating] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [activeChannel, setActiveChannel] = useState(null);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showMemberList, setShowMemberList] = useState(false);
    const [showMessageInfo, setShowMessageInfo] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    // Pick up calls accepted from the IncomingCallWidget on another page.
    // The active call UI is rendered globally by LiveKitContext (CallPopup /
    // CallSession in AppLayout), so here we only clear the one-shot accepted-call
    // state so it doesn't linger across navigations.
    useEffect(() => {
        if (acceptedCall) {
            clearAcceptedCall();
        }
    }, [acceptedCall, clearAcceptedCall]);

    // Fetch users for search
    const { data: allUsers } = useQuery({
        queryKey: ["chatUsers"],
        queryFn: async () => (await api.get("/chat/users")).data,
        enabled: !!user
    });

    if (!chatClient) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white">
                <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-4" />
                <p className="text-gray-500 font-medium animate-pulse">Connecting to chat...</p>
            </div>
        );
    }

    const startDirectChat = async (otherUserId) => {
        try {
            // Call backend to sync users and create channel
            const response = await api.post("/chat/start", { targetUserId: otherUserId });
            const { cid } = response.data;

            // We can now access the channel locally since backend created it
            const channel = chatClient.channel("messaging", cid.split(":")[1]);
            await channel.watch(); // Watch ensures we have latest state

            setActiveChannel(channel);
            setUserSearchTerm(""); // Clear search

        } catch (error) {
            console.error("Failed to start chat:", error);
            alert("Could not start chat. Please try again.");
        }
    };
    
    const handleDeleteChannel = async (channel) => {
        if (!channel) return;
        
        const name = channel.data.name || "this chat";
        
        if (!confirm(`Are you sure you want to permanently delete ${name}? This action cannot be undone.`)) return;
        
        try {
            await api.delete("/chat/delete-channel", {
                data: { channelId: channel.id, type: channel.type }
            });
            
            // Clear active channel if it was the one deleted
            if (activeChannel?.id === channel.id) {
                setActiveChannel(null);
            }
            
            // ChannelList will automatically refresh on channel deletion event
            alert("Group deleted successfully.");
        } catch (error) {
            console.error("Failed to delete channel:", error);
            alert(error.response?.data?.message || "Failed to delete group. Only the creator or an admin can delete groups.");
        }
    };

    const filteredUsers = allUsers?.filter(u =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
    ) || [];

    return (
        <div className="h-full bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
            {/* Unified Chat Provider */}
            <Chat client={chatClient} theme="messaging light">
                <div className="flex w-full h-full">
                        {/* Sidebar */}
                        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                                <h2 className="font-bold text-xl text-gray-800 tracking-tight">Messages</h2>
                                {canCreateGroup && (
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors"
                                        title="New Group"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                )}
                            </div>

                            {/* User Search Bar */}
                            <div className="p-3 bg-white border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search contacts..."
                                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            {isCreating && (
                                <CreateGroupView
                                    onClose={() => setIsCreating(false)}
                                    client={chatClient}
                                    users={allUsers}
                                    currentUser={user}
                                    setActiveChannel={setActiveChannel}
                                />
                            )}
                            {/* Search Results OR Unified Channel List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {userSearchTerm ? (
                                    <div className="p-2 space-y-1">
                                        <h3 className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Contacts</h3>
                                        {filteredUsers.length === 0 && <p className="px-4 py-2 text-sm text-gray-400 text-center">No users found</p>}
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => startDirectChat(u.id)}
                                                className="w-full flex items-center p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-left group"
                                            >
                                                <div className="relative">
                                                    <img src={u.image} alt={u.name} className="h-10 w-10 rounded-full border border-gray-100 object-cover" />
                                                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{u.name}</div>
                                                    <div className="text-xs text-gray-500">{u.role}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <ChannelList
                                        filters={{ members: { $in: [user.id] } }}
                                        sort={{ last_message_at: -1 }}
                                        options={{ state: true, watch: true, presence: true, limit: 50 }}
                                        setActiveChannelOnMount={false}
                                        List={(props) => (
                                            <div className="flex flex-col">
                                                {/* Groups Section */}
                                                <div className="pt-2">
                                                    <div className="px-4 py-2 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        <span>Teams / Groups</span>
                                                        <span className="bg-gray-200 text-gray-600 px-1.5 rounded-full text-[10px]">beta</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {props.children?.props?.children?.filter(c => c.props.channel.type === 'team' || (c.props.channel.data.name && c.props.channel.data.name !== '')).length === 0 ? (
                                                            <div className="px-4 py-2 text-sm text-gray-400 italic">No groups yet</div>
                                                        ) : (
                                                            props.children?.props?.children?.filter(c => c.props.channel.type === 'team' || (c.props.channel.data.name && c.props.channel.data.name !== ''))
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Direct Messages Section */}
                                                <div className="pt-4 border-t border-gray-100 mt-2">
                                                    <h3 className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Direct Messages</h3>
                                                    <div className="space-y-0.5">
                                                        {props.children?.props?.children?.filter(c => c.props.channel.type === 'messaging' && !c.props.channel.data.name).length === 0 ? (
                                                            <div className="px-4 py-2 text-sm text-gray-400 italic">No direct messages</div>
                                                        ) : (
                                                            props.children?.props?.children?.filter(c => c.props.channel.type === 'messaging' && !c.props.channel.data.name)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        Preview={(props) => (
                                            <CustomChannelPreview
                                                {...props}
                                                onSelect={() => {
                                                    props.setActiveChannel(props.channel);
                                                    setActiveChannel(props.channel);
                                                }}
                                                active={activeChannel?.id === props.channel.id}
                                            />
                                        )}
                                    />
                                )}
                            </div>

                        </div>

                        {/* Chat Window */}
                        <div className="flex-1 flex flex-col bg-white min-w-0 relative overflow-hidden h-full">
                            <Channel
                                channel={activeChannel}
                                Message={CustomMessage}
                                MessageStatus={CustomMessageStatus}
                                TypingIndicator={CustomTypingIndicator}
                            >
                                <Window>
                                    {activeChannel ? (
                                        <>
                                            <CustomChannelHeader
                                                onAddMember={() => setShowAddMember(true)}
                                                onShowMembers={() => setShowMemberList(true)}
                                                onDeleteChannel={() => handleDeleteChannel(activeChannel)}
                                            />
                                            <MessageList
                                                messageActions={['react', 'reply', 'edit', 'delete', 'flag', 'pin']}
                                                enableReactionClick={true}
                                                threadList={true}
                                                customMessageActions={{
                                                    'Message Info': (message) => {
                                                        // Only show in group chats
                                                        if (activeChannel?.type === 'team') {
                                                            setSelectedMessage(message);
                                                            setShowMessageInfo(true);
                                                        }
                                                    }
                                                }}
                                            />
                                            {/* Explicitly enable file uploads and focus */}
                                            <MessageInput focus />

                                            {/* Member Management Modals */}
                                            {showAddMember && (
                                                <AddMemberModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowAddMember(false)}
                                                    allUsers={allUsers}
                                                />
                                            )}
                                            {showMemberList && (
                                                <MemberListModal
                                                    channel={activeChannel}
                                                    onClose={() => setShowMemberList(false)}
                                                    currentUser={user}
                                                />
                                            )}
                                            {showMessageInfo && selectedMessage && (
                                                <MessageInfoModal
                                                    message={selectedMessage}
                                                    channel={activeChannel}
                                                    onClose={() => {
                                                        setShowMessageInfo(false);
                                                        setSelectedMessage(null);
                                                    }}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <EmptyState />
                                    )}
                                </Window>
                                <Thread />
                            </Channel>
                        </div>
                    </div>
            </Chat>
        </div>
    );
};

// Helper to get initials from a name (e.g., "Tech Team" -> "TT")
const getInitials = (name) => {
    if (!name) return "";
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

// Custom Channel Preview for the List
const CustomChannelPreview = ({ channel, active, onSelect, latestMessage }) => {
    const { user } = useAuth();
    const isGroup = channel.type === 'team' || !!channel.data.name;
    const members = Object.values(channel.state.members).filter(m => m.user?.id !== user?.id);
    
    // For groups, we only want the group image. For DMs, we take the other person's image.
    const displayImage = isGroup ? channel.data.image : (channel.data.image || members[0]?.user?.image);
    const displayName = channel.data.name || members.map(m => m.user?.name).join(", ");
    const initials = getInitials(displayName);

    // Get the latest message text more reliably with state fallback
    const channelMessages = channel.state.messages;
    const lastMsgFromState = channelMessages[channelMessages.length - 1];
    const messageText = latestMessage?.text || lastMsgFromState?.text || "No messages yet";

    // Format date with fallback to state or creation date
    const lastMessageDate = latestMessage?.created_at ? new Date(latestMessage.created_at) : (lastMsgFromState?.created_at ? new Date(lastMsgFromState.created_at) : new Date(channel.data.created_at));
    const timeString = lastMessageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Check for unread count in Stream Chat
    const unreadCount = channel.countUnread();
    const hasUnread = unreadCount > 0;

    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center p-3 border-b border-gray-50 transition-colors ${active ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"}`}
        >
            <div className={`relative ${active ? "ring-2 ring-indigo-200 rounded-full" : ""}`}>
                {displayImage ? (
                    <img src={displayImage} alt={displayName} className="h-12 w-12 rounded-full object-cover border border-gray-100 shadow-sm" />
                ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner border border-white/20">
                        {initials}
                    </div>
                )}
            </div>
            <div className="ml-3 flex-1 overflow-hidden text-left">
                <div className="flex justify-between items-baseline">
                    <span className={`text-sm truncate ${hasUnread ? "font-extrabold text-slate-950" : active ? "text-indigo-900 font-semibold" : "text-gray-900 font-semibold"}`}>
                        {displayName}
                    </span>
                    <span className={`text-[11px] flex-shrink-0 ${hasUnread ? "text-green-500 font-bold" : "text-gray-400"}`}>
                        {timeString}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <span className={`text-xs truncate mr-2 ${hasUnread ? "font-bold text-slate-900" : "text-gray-500"}`}>
                        {messageText}
                    </span>
                    {hasUnread && (
                        <span className="bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold h-[18px] min-w-[18px] px-1 shadow-sm shrink-0">
                            {unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};


// Custom Header with Audio and Video Call Buttons and Delete Option
const CustomChannelHeader = ({ onAddMember, onShowMembers, onDeleteChannel }) => {
    const { channel } = useChatContext();
    const { user } = useAuth();
    const { startCall } = useLiveKit();
    // A team lead granted group creation may manage members of groups they own.
    const canManageGroup = ["SUPER_ADMIN", "ADMIN"].includes(user?.role) ||
        (user?.canCreateGroup && channel?.data?.created_by_id === user?.id);

    // Derive all display variables from channel state
    const members = Object.values(channel?.state?.members || {}).filter(m => m.user?.id !== user?.id);
    const displayName = channel?.data?.name || members.map(m => m.user?.name).join(", ") || "Chat";
    const isTeamChannel = channel?.type === 'team';
    const isCreator = channel?.data?.created_by_id === user?.id;
    const canDeleteGroup = ["ADMIN", "SUPER_ADMIN"].includes(user?.role);
    const totalMemberCount = Object.values(channel?.state?.members || {}).length;
    const memberSubtext = isTeamChannel
        ? `${totalMemberCount} member${totalMemberCount !== 1 ? 's' : ''}`
        : members[0]?.user?.name || "";

    const handleStartVideoCall = () => {
        console.log("[MESSAGES_HEADER] Video Call icon clicked. Channel:", channel);
        if (!channel) {
            console.error("[MESSAGES_HEADER] Channel is undefined!");
            return;
        }
        startCall(channel, "video");
    };

    const handleStartAudioCall = () => {
        console.log("[MESSAGES_HEADER] Audio Call icon clicked. Channel:", channel);
        if (!channel) {
            console.error("[MESSAGES_HEADER] Channel is undefined!");
            return;
        }
        startCall(channel, "audio");
    };

    // Calculate display status for DMs
    const isDM = channel?.type === 'messaging';
    const otherMember = members[0]?.user;
    const onlineStatus = otherMember?.online_status || (otherMember?.online ? 'ONLINE' : 'OFFLINE');

    const getStatusUI = () => {
        if (!isDM || !otherMember) return null;
        switch (onlineStatus) {
            case 'ONLINE':
                return { text: 'Online', color: 'bg-green-500', textColor: 'text-green-600' };
            case 'BREAK':
                return { text: 'On Break', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
            default:
                return { text: 'Offline', color: 'bg-gray-400', textColor: 'text-gray-400' };
        }
    };

    const statusUI = getStatusUI();

    const initials = getInitials(displayName);

    return (
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
                <div className="relative">
                    {channel?.data?.image ? (
                        <img src={channel.data.image} alt={displayName} className="h-10 w-10 rounded-full object-cover border border-gray-100 shadow-sm" />
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner border border-white/20">
                            {initials}
                        </div>
                    )}
                    {statusUI && (
                        <div className={`absolute bottom-0 right-0 h-3 w-3 ${statusUI.color} border-2 border-white rounded-full shadow-sm`}></div>
                    )}
                </div>
                <div>
                    <div className="font-bold text-gray-900 leading-tight">
                        {displayName}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {statusUI ? (
                            <span className={`text-[11px] font-semibold ${statusUI.textColor} uppercase tracking-wider`}>
                                {statusUI.text}
                            </span>
                        ) : (
                            <div className="text-xs text-gray-500 cursor-pointer hover:text-indigo-600" onClick={onShowMembers}>
                                {memberSubtext}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isTeamChannel && onShowMembers && (
                    <button
                        onClick={onShowMembers}
                        className="p-2.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                        title="View Members"
                    >
                        <Users className="h-5 w-5" />
                    </button>
                )}
                {isTeamChannel && onAddMember && canManageGroup && (
                    <button
                        onClick={onAddMember}
                        className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                        title={`Add Member ${isCreator ? '(Creator)' : '(Admin)'}`}
                    >
                        <UserPlus className="h-5 w-5" />
                    </button>
                )}
                {/* Audio Call Button */}
                <button
                    onClick={handleStartAudioCall}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 hover:shadow-md transition-all active:scale-95 cursor-pointer border border-indigo-100"
                    title="Start Audio Call"
                >
                    <Phone className="h-5 w-5" />
                </button>
                {/* Video Call Button */}
                <button
                    onClick={handleStartVideoCall}
                    className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                    title="Start Video Call"
                >
                    <Video className="h-5 w-5" />
                </button>
                {isTeamChannel && canDeleteGroup && (
                    <button
                        onClick={onDeleteChannel}
                        className="p-2.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                        title="Delete Group"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
};



// Create Group Modal
const CreateGroupView = ({ onClose, client, users, currentUser, setActiveChannel }) => {
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState("");

    // A team lead granted group creation is confined to their own department.
    const isAdminCreator = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);
    const selectableUsers = (isAdminCreator || !currentUser?.department)
        ? users
        : users?.filter((u) => u.department === currentUser.department);

    const handleCreate = async () => {
        if (!groupName) return alert("Please enter a group name");
        if (selectedUsers.length === 0) return alert("Select at least one member");

        try {
            // Step 1: Sync all selected users to Stream Chat first
            console.log("Syncing selected users to Stream Chat:", selectedUsers);
            for (const userId of selectedUsers) {
                try {
                    await api.post("/chat/sync-user", { userId });
                } catch (syncError) {
                    console.error(`Failed to sync user ${userId}:`, syncError);
                    // Continue anyway - user might already be synced
                }
            }

            // Step 2: Generate a unique ID for the team channel
            const channelId = `group-${Date.now()}`;

            // Step 3: Create the channel with all members
            const channel = client.channel("team", channelId, {
                name: groupName,
                members: [currentUser.id, ...selectedUsers],
                created_by_id: currentUser.id
            });

            await channel.create();

            // Immediately set as active channel
            setActiveChannel(channel);
            onClose();
        } catch (error) {
            console.error("Error creating group:", error);
            alert(`Failed to create group: ${error.message || "Please try again."}`);
        }
    };

    const toggleUser = (id) => {
        if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(u => u !== id));
        else setSelectedUsers([...selectedUsers, id]);
    };

    return (
        <div className="p-4 border-b border-gray-200 bg-indigo-50/50 space-y-3 shadow-inner">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm text-indigo-900">Create New Group</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>

            <input
                placeholder="Group Name (e.g. Marketing Team)"
                className="w-full p-2 border border-gray-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />

            <div className="text-xs font-medium text-gray-500 uppercase mt-2">Select Members</div>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded p-1">
                {selectableUsers?.map(u => (
                    <div
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={`p-2 text-sm cursor-pointer rounded flex justify-between items-center ${selectedUsers.includes(u.id) ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50"}`}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">{u.name[0]}</div>
                            <span>{u.name}</span>
                        </div>
                        {selectedUsers.includes(u.id) && <div className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </div>
                ))}
            </div>

            <button onClick={handleCreate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium transition-colors shadow-sm">
                Create Group
            </button>
        </div>
    );
};

// Add Member Modal
const AddMemberModal = ({ channel, onClose, allUsers }) => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const currentMemberIds = Object.keys(channel?.state?.members || {});
    
    const availableUsers = allUsers?.filter(u => 
        !currentMemberIds.includes(u.id) && 
        (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const handleAddMember = async (userId) => {
        setLoading(true);
        try {
            // Step 1: Sync user to Stream Chat first
            await api.post("/chat/sync-user", { userId });

            // Step 2: Add member to channel
            await channel.addMembers([userId]);

            alert("Member added successfully!");
        } catch (error) {
            console.error("Failed to add member:", error);
            alert(`Failed to add member: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Add Members</h2>
                        <p className="text-xs text-gray-500 mt-1">Select team members to join this group</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-white border-b border-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white">
                    {availableUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <div className="bg-gray-50 p-4 rounded-full mb-3">
                                <Users className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="text-gray-900 font-semibold mb-1">
                                {searchTerm ? "No matches found" : "All clear!"}
                            </p>
                            <p className="text-sm text-gray-500 max-w-[200px]">
                                {searchTerm 
                                    ? `Could not find any users matching "${searchTerm}"` 
                                    : "Everyone from your team is already in this group."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {availableUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 hover:bg-indigo-50/50 rounded-xl transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={user.image} alt={user.name} className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm" />
                                            {/* Status indicator could go here */}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{user.name}</div>
                                            <div className="text-xs text-gray-500 font-medium">{user.role}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAddMember(user.id)}
                                        disabled={loading}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Member List Modal
const MemberListModal = ({ channel, onClose, currentUser }) => {
    const [loading, setLoading] = useState(false);

    const members = Object.values(channel?.state?.members || {});
    const isOwner = channel?.data?.created_by_id === currentUser?.id;
    const isCrmAdmin = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    const handleRemoveMember = async (userId) => {
        if (!confirm("Are you sure you want to remove this member from the group?")) return;

        setLoading(true);
        try {
            await channel.removeMembers([userId]);
        } catch (error) {
            console.error("Failed to remove member:", error);
            alert("Failed to remove member. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Group Members</h2>
                        <p className="text-xs text-gray-500 mt-1">{members.length} people in this conversation</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Member List */}
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div className="space-y-1">
                        {members.sort((a, b) => {
                            const isACreator = a.user_id === channel?.data?.created_by_id;
                            const isBCreator = b.user_id === channel?.data?.created_by_id;
                            return isBCreator - isACreator;
                        }).map(member => {
                            const isCreator = member.user_id === channel?.data?.created_by_id;
                            const isSelf = member.user_id === currentUser?.id;
                            // Owners or CRM Admins can remove anyone EXCEPT the creator or themselves
                            const canRemove = (isOwner || isCrmAdmin) && !isCreator && !isSelf;

                            return (
                                <div key={member.user_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                                alt={member.user?.name}
                                                className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm"
                                            />
                                            {member.user?.online && (
                                                <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full transition-colors animate-pulse"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                                {member.user?.name}
                                                {isSelf && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">You</span>}
                                                {isCreator && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-sm border border-amber-200/50">
                                                        <Trophy className="h-2.5 w-2.5" />
                                                        Owner
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 font-medium">{member.user?.role || "Member"}</div>
                                        </div>
                                    </div>
                                    {canRemove && (
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            disabled={loading}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                            title="Remove from group"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Message Info Modal - Shows who read the message in groups
const MessageInfoModal = ({ message, channel, onClose }) => {
    const allMembers = Object.values(channel?.state?.members || {});
    const readBy = message?.readBy || [];

    // Get members who have read the message
    const readMembers = allMembers.filter(member =>
        readBy.some(reader => reader.id === member.user_id)
    );

    // Get members who haven't read yet
    const unreadMembers = allMembers.filter(member =>
        !readBy.some(reader => reader.id === member.user_id) &&
        member.user_id !== message?.user?.id // Exclude message sender
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Message Info</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Read Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <span className="text-blue-600">✓✓</span> Read ({readMembers.length})
                        </h3>
                        {readMembers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic pl-6">No one has read this message yet</p>
                        ) : (
                            <div className="space-y-2">
                                {readMembers.map(member => {
                                    const readInfo = readBy.find(r => r.id === member.user_id);
                                    return (
                                        <div key={member.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                                            <img
                                                src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                                alt={member.user?.name}
                                                className="h-8 w-8 rounded-full object-cover border border-gray-200"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">{member.user?.name}</div>
                                                {readInfo?.last_read && (
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(readInfo.last_read).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Unread Section */}
                    {unreadMembers.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <span className="text-gray-400">○</span> Not Read Yet ({unreadMembers.length})
                            </h3>
                            <div className="space-y-2">
                                {unreadMembers.map(member => (
                                    <div key={member.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg opacity-60">
                                        <img
                                            src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}`}
                                            alt={member.user?.name}
                                            className="h-8 w-8 rounded-full object-cover border border-gray-200 grayscale"
                                        />
                                        <div className="text-sm font-medium text-gray-500">{member.user?.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
