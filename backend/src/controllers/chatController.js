const { StreamChat } = require("stream-chat");
const prisma = require("../utils/prisma");
const { getWorkspaceFilter } = require("../utils/workspaceScope");
const { canCreateGroup } = require("../utils/chatPermissions");

// Initialize Stream Client lazily or ensure env vars are loaded
const getStreamClient = () => {
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_SECRET_KEY) {
        throw new Error("MISSING STREAM CREDENTIALS");
    }
    return StreamChat.getInstance(
        process.env.STREAM_API_KEY,
        process.env.STREAM_SECRET_KEY,
        { timeout: 15000 } // Increase timeout to 15s to prevent timeouts
    );
};

// Create Token & Sync User
const createToken = async (req, res) => {
    try {
        console.log("Chat Token Request Initiated");
        // console.log("User in Request:", req.user); // Debug: Check if user exists

        if (!req.user || !req.user.userId) {
            console.error("User ID missing from request token payload");
            return res.status(401).json({ message: "User authentication failed" });
        }

        const { userId } = req.user;

        // Fetch fresh user data from DB
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const streamClient = getStreamClient();

        // Upsert user in Stream
        const profilePhotoUrl = user.profilePhoto
            ? `${process.env.BACKEND_URL || 'http://localhost:5001'}${user.profilePhoto}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

        const upsertData = {
            id: user.id,
            name: user.name,
            role: user.role === "SUPER_ADMIN" ? "admin" : "user",
            image: profilePhotoUrl,
            online_status: user.onlineStatus,
            last_seen: user.lastSeen ? user.lastSeen.toISOString() : null
        };

        try {
            await streamClient.upsertUser(upsertData);
        } catch (upsertError) {
            console.error("Stream Integration Warning: Failed to upsert user", upsertError.message);
        }

        // Create token
        const token = streamClient.createToken(user.id);

        res.json({
            token,
            apiKey: process.env.STREAM_API_KEY,
            user: {
                id: user.id,
                name: user.name,
                image: upsertData.image,
                role: user.role
            }
        });
    } catch (error) {
        console.error("CRITICAL ERROR creating stream token:", error);
        if (error.response) {
            console.error("Stream API Response Error:", error.response.data);
        }
        res.status(500).json({ message: "Failed to create chat token", error: error.message });
    }
};

// Create Channel (Optional - mostly handled frontend side for DMs, but good for Admin groups)
const createGroupChannel = async (req, res) => {
    try {
        const { name, members, image } = req.body; // members = array of userIds
        const creatorId = req.user.userId;

        if (!members || members.length === 0) {
            return res.status(400).json({ message: "Members are required" });
        }
        if (!name) {
            return res.status(400).json({ message: "Group name is required" });
        }

        // Load a FRESH creator row so a just-toggled privilege flag is respected.
        const creator = await prisma.user.findUnique({ where: { id: creatorId } });
        if (!creator) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!canCreateGroup(creator)) {
            return res.status(403).json({ message: "You don't have permission to create groups." });
        }

        // Restrict group members to the creator's workspace.
        const { workspaceId } = req.user;
        if (workspaceId) {
            const sameWsCount = await prisma.user.count({
                where: { id: { in: members }, workspaceId },
            });
            if (sameWsCount !== members.length) {
                return res.status(403).json({ message: "All members must belong to your workspace" });
            }
        }

        // A TEAM_LEAD granted group creation is confined to their own department.
        if (creator.role === "TEAM_LEAD" && creator.departmentId) {
            const sameDeptCount = await prisma.user.count({
                where: { id: { in: members }, departmentId: creator.departmentId },
            });
            if (sameDeptCount !== members.length) {
                return res.status(403).json({ message: "You can only add members from your own department." });
            }
        }

        const streamClient = getStreamClient();
        const channel = streamClient.channel("team", name.toLowerCase().replace(/\s+/g, "-"), {
            name,
            image,
            created_by_id: creatorId,
            members: [...members, creatorId],
        });

        await channel.create();

        res.json({ message: "Channel created successfully", channelId: channel.id });
    } catch (error) {
        console.error("Error creating channel:", error);
        res.status(500).json({ message: "Failed to create channel" });
    }
};

// Get All Users (For Search Bar) - reusing existing logic effectively, but specific format might be useful
const getUsersForChat = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            console.error("User ID missing from request in getUsersForChat");
            return res.status(401).json({ message: "User authentication failed" });
        }

        const currentUserId = req.user.userId;
        const { workspaceId } = req.user;

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                // Restrict messaging to the same workspace — no cross-workspace contacts
                ...(workspaceId ? { workspaceId } : {}),
                NOT: { id: currentUserId } // Exclude self
            },
            select: {
                id: true,
                name: true,
                role: true,
                department: true,
                jobTitle: true,
                profilePhoto: true
            }
        });

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';

        const formattedUsers = users.map(u => ({
            id: u.id,
            name: u.name || "Unknown User",
            role: u.role,
            department: u.department,
            jobTitle: u.jobTitle,
            image: u.profilePhoto 
                ? `${backendUrl}${u.profilePhoto}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "Unknown")}`
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error("Error in getUsersForChat:", error);
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
};

// Helper: Upsert User to Stream
const upsertUserToStream = async (user) => {
    const streamClient = getStreamClient();
    const profilePhotoUrl = user.profilePhoto
        ? `${process.env.BACKEND_URL || 'http://localhost:5001'}${user.profilePhoto}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;
    const upsertData = {
        id: user.id,
        name: user.name,
        role: user.role === "SUPER_ADMIN" ? "admin" : "user",
        image: profilePhotoUrl,
        online_status: user.onlineStatus // Custom field for WhatsApp presence
    };
    await streamClient.upsertUser(upsertData);
    return upsertData;
};

// Start Direct Chat (Syncs users first)
const startDirectChat = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user?.userId;
        console.log(`[CHAT_START] Request from ${currentUserId} to ${targetUserId}`);

        if (!targetUserId) {
            return res.status(400).json({ message: "Target user ID is required" });
        }
        if (!currentUserId) {
            return res.status(401).json({ message: "User not authenticated correctly" });
        }

        // Fetch both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({ where: { id: currentUserId } }),
            prisma.user.findUnique({ where: { id: targetUserId } })
        ]);

        if (!currentUser || !targetUser) {
            console.error(`[CHAT_START] User missing: currentUser=${!!currentUser}, targetUser=${!!targetUser}`);
            return res.status(404).json({ message: "One or more users not found in database" });
        }

        // Restrict messaging to the same workspace — cannot DM users in another workspace
        if (currentUser.workspaceId && currentUser.workspaceId !== targetUser.workspaceId) {
            return res.status(403).json({ message: "You can only message users within your workspace" });
        }

        // Sync both users to Stream to ensure they exist
        await Promise.all([
            upsertUserToStream(currentUser),
            upsertUserToStream(targetUser)
        ]);

        const streamClient = getStreamClient();

        // Create or get channel without explicit ID (Stream handles DMs logic)
        const channel = streamClient.channel("messaging", {
            members: [currentUserId, targetUserId],
            created_by_id: currentUserId,
            category: 'dm' // Explicitly tag as DM
        });

        await channel.create();

        res.json({
            message: "Chat started successfully",
            channelId: channel.id,
            cid: channel.cid
        });

    } catch (error) {
        console.error("CRITICAL [CHAT_START] error:", error);
        res.status(500).json({ message: "Failed to start chat", error: error.message });
    }
};

// Sync user to Stream (helper exposed as endpoint)
const syncUserToStream = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await upsertUserToStream(user);

        res.status(200).json({
            message: "User synced to Stream successfully",
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error syncing user to Stream:", error);
        res.status(500).json({ message: "Failed to sync user" });
    }
};

// Sync ALL users to Stream (run once after deployment)
const syncAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true }
        });

        console.log(`Syncing ${users.length} users to Stream...`);

        const results = [];
        for (const user of users) {
            try {
                await upsertUserToStream(user);
                results.push({ id: user.id, name: user.name, status: 'success' });
                console.log(`Synced user: ${user.name}`);
            } catch (error) {
                console.error(`Failed to sync user ${user.id}:`, error.message);
                results.push({ id: user.id, name: user.name, status: 'failed', error: error.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`Sync complete: ${successCount}/${users.length} users synced successfully`);

        res.status(200).json({
            message: `Synced ${successCount}/${users.length} users to Stream`,
            results
        });
    } catch (error) {
        console.error("Error syncing all users:", error);
        res.status(500).json({ message: "Failed to sync users", error: error.message });
    }
};

// Delete Channel (Group only)
const deleteChannel = async (req, res) => {
    try {
        const { channelId, type } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!channelId) {
            return res.status(400).json({ message: "Channel ID is required" });
        }

        const streamClient = getStreamClient();
        const channel = streamClient.channel(type || 'team', channelId);

        // Fetch channel state to check permissions
        const state = await channel.query();
        const createdById = state.channel.created_by.id;

        // Only Admins or Super Admins can delete channels
        if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
            return res.status(403).json({ message: "You don't have permission to delete this channel. Only Admins can perform this action." });
        }

        await channel.delete();
        res.json({ message: "Channel deleted successfully" });
    } catch (error) {
        console.error("Error deleting channel:", error);
        res.status(500).json({ message: "Failed to delete channel", error: error.message });
    }
};

// Rename Group (team channel) — creator or CRM admin only
const renameGroup = async (req, res) => {
    try {
        const { channelId, type, name } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!channelId) return res.status(400).json({ message: "Channel ID is required" });
        const trimmed = (name || "").trim();
        if (!trimmed) return res.status(400).json({ message: "Group name is required" });

        const streamClient = getStreamClient();
        const channel = streamClient.channel(type || "team", channelId);

        const state = await channel.query();
        const createdById = state.channel.created_by?.id;

        const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
        const isCreator = createdById === userId;
        if (!isAdmin && !isCreator) {
            return res.status(403).json({ message: "Only the group creator or an admin can rename this group." });
        }

        await channel.update({ name: trimmed }, { text: `Group renamed to "${trimmed}"`, user_id: userId });

        res.json({ message: "Group renamed successfully", name: trimmed });
    } catch (error) {
        console.error("Error renaming group:", error);
        res.status(500).json({ message: "Failed to rename group", error: error.message });
    }
};

// ── Call precheck — presence gate before ringing a 1:1 call ──────────────────
// Returns the target's live presence so the caller can decide whether to ring.
// Enforces same-workspace (you can only call contacts in your workspace).
const callPrecheck = async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = req.user.userId;

        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({ where: { id: currentUserId } }),
            prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, name: true, onlineStatus: true, breakStartedAt: true, workspaceId: true, isActive: true },
            }),
        ]);

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: "User not found" });
        }
        if (currentUser.workspaceId && currentUser.workspaceId !== targetUser.workspaceId) {
            return res.status(403).json({ message: "You can only call users within your workspace" });
        }

        res.json({
            id: targetUser.id,
            name: targetUser.name,
            onlineStatus: targetUser.isActive ? targetUser.onlineStatus : "OFFLINE",
            breakStartedAt: targetUser.breakStartedAt,
        });
    } catch (error) {
        console.error("[CALL_PRECHECK_ERROR]", error);
        res.status(500).json({ message: "Failed to check user status", error: error.message });
    }
};

// ── Log a call event — persists history + posts an inline call bubble ─────────
// Body: { channelCid, calleeId?, callType, status, startedAt, answeredAt?, endedAt? }
const VALID_CALL_TYPES = ["AUDIO", "VIDEO"];
const VALID_CALL_STATUSES = ["ANSWERED", "MISSED", "DECLINED", "CANCELLED", "BLOCKED_OFFLINE"];

const logCallEvent = async (req, res) => {
    try {
        const callerId = req.user.userId;
        const { channelCid, calleeId, callType, status, startedAt, answeredAt, endedAt } = req.body;

        if (!channelCid || !callType || !status) {
            return res.status(400).json({ message: "channelCid, callType and status are required" });
        }
        if (!VALID_CALL_TYPES.includes(callType) || !VALID_CALL_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid callType or status" });
        }

        const caller = await prisma.user.findUnique({ where: { id: callerId } });
        if (!caller) return res.status(404).json({ message: "Caller not found" });

        // If a 1:1 callee is supplied, enforce same-workspace.
        if (calleeId) {
            const callee = await prisma.user.findUnique({
                where: { id: calleeId },
                select: { id: true, workspaceId: true },
            });
            if (!callee) return res.status(404).json({ message: "Callee not found" });
            if (caller.workspaceId && caller.workspaceId !== callee.workspaceId) {
                return res.status(403).json({ message: "Callee is not in your workspace" });
            }
        }

        const start = startedAt ? new Date(startedAt) : new Date();
        const answered = answeredAt ? new Date(answeredAt) : null;
        const ended = endedAt ? new Date(endedAt) : new Date();
        const durationSec = answered ? Math.max(0, Math.round((ended - answered) / 1000)) : 0;

        // 1. Persist to DB (workspace-scoped via the caller's workspace).
        const event = await prisma.callEvent.create({
            data: {
                workspaceId: caller.workspaceId || null,
                channelCid,
                callerId,
                calleeId: calleeId || null,
                callType,
                status,
                startedAt: start,
                answeredAt: answered,
                endedAt: ended,
                durationSec,
            },
        });

        // 2. Post an inline "call bubble" message into the Stream channel so it
        //    shows in the conversation (WhatsApp-style) for everyone, persisted by Stream.
        try {
            const [type, id] = channelCid.split(":");
            const streamClient = getStreamClient();
            const channel = streamClient.channel(type, id);
            const label = callBubbleText(callType, status, durationSec);
            await channel.sendMessage({
                text: label,
                user_id: callerId,
                customType: "call",
                callType,
                callStatus: status,
                durationSec,
                callerId,
            });
        } catch (streamErr) {
            console.error("[CALL_EVENT] Stream message post failed:", streamErr.message);
            // DB row is already saved; don't fail the request over the chat bubble.
        }

        res.json({ message: "Call event logged", event });
    } catch (error) {
        console.error("[LOG_CALL_EVENT_ERROR]", error);
        res.status(500).json({ message: "Failed to log call event", error: error.message });
    }
};

// Human-readable text for the inline call bubble.
const callBubbleText = (callType, status, durationSec) => {
    const kind = callType === "VIDEO" ? "Video call" : "Voice call";
    if (status === "ANSWERED") {
        const m = Math.floor(durationSec / 60);
        const s = String(durationSec % 60).padStart(2, "0");
        return `${kind} · ${m}:${s}`;
    }
    if (status === "BLOCKED_OFFLINE") return `Missed ${kind.toLowerCase()} — was offline`;
    if (status === "DECLINED") return `${kind} declined`;
    // MISSED / CANCELLED
    return `Missed ${kind.toLowerCase()}`;
};

// ── Stream Webhook — creates in-app notifications for messages + video calls ──
// Stream signs each request with HMAC-SHA256; we verify before processing.
const crypto = require("crypto");
const { createNotification } = require("../services/notificationService");

const streamWebhook = async (req, res) => {
    try {
        const secret = process.env.STREAM_SECRET_KEY || "";
        const signature = req.headers["x-signature"] || "";
        const body = JSON.stringify(req.body);

        // Verify signature to ensure the request came from Stream
        const expectedSig = crypto
            .createHmac("sha256", secret)
            .update(body)
            .digest("hex");

        if (secret && signature !== expectedSig) {
            return res.status(401).json({ message: "Invalid webhook signature" });
        }

        const { type, message, channel, call, members = [] } = req.body;

        // ── New chat message ────────────────────────────────────────────────────
        if (type === "message.new" && message) {
            const senderId = message.user?.id;
            const senderName = message.user?.name || "Someone";
            const preview = message.text
                ? message.text.slice(0, 80)
                : "(attachment)";

            // Notify all channel members except the sender
            const recipientIds = (channel?.members || members)
                .map((m) => m.user_id || m.userId || m.id)
                .filter((id) => id && id !== senderId);

            await Promise.all(
                recipientIds.map((userId) =>
                    createNotification({
                        userId,
                        title: `💬 New message from ${senderName}`,
                        message: preview,
                        type: "MESSAGE",
                        link: "/chat",
                    }).catch(() => {})
                )
            );
        }

        // ── Video call started / ringing ────────────────────────────────────────
        if ((type === "call.ring" || type === "call.started") && call) {
            const callerName = call.created_by?.name || "Someone";
            const recipientIds = (call.members || members)
                .map((m) => m.user_id || m.userId || m.id)
                .filter((id) => id && id !== call.created_by?.id);

            await Promise.all(
                recipientIds.map((userId) =>
                    createNotification({
                        userId,
                        title: `📹 Incoming video call from ${callerName}`,
                        message: "Click to join the call.",
                        type: "VIDEO_CALL",
                        link: "/chat",
                    }).catch(() => {})
                )
            );
        }

        return res.status(200).json({ message: "ok" });
    } catch (error) {
        console.error("[Stream Webhook] error:", error.message);
        return res.status(500).json({ message: "Webhook processing error" });
    }
};

module.exports = {
    createToken,
    createGroupChannel,
    getUsersForChat,
    startDirectChat,
    syncUserToStream,
    syncAllUsers,
    upsertUserToStream,
    deleteChannel,
    renameGroup,
    streamWebhook,
    callPrecheck,
    logCallEvent,
};
