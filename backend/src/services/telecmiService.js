const axios = require("axios");
const prisma = require("../utils/prisma");

const TELECMI_ADD_USER_URL    = "https://rest.telecmi.com/v3/user/add";
const TELECMI_UPDATE_USER_URL = "https://rest.telecmi.com/v3/user/update";
const TELECMI_REMOVE_USER_URL = "https://rest.telecmi.com/v3/user/remove";
const TELECMI_LIST_ALL_URL    = "https://rest.telecmi.com/v3/user/all";
const TELECMI_USER_INFO_URL   = "https://rest.telecmi.com/v3/user/get";
const TELECMI_CLICK2CALL_URL  = "https://rest.telecmi.com/v2/webrtc/click2call";

// appid + secret for a workspace come from its activated ZX Call request.
// The activation "App ID" IS the TeleCMI appid (a number). A C2C user's
// "User ID" is the TeleCMI extension (4-digit). agent_id = {userId}_{appId}.
// (Legacy rows may store a composite "{ext}_{appid}" — handle both.)
async function getWorkspaceTelecmiCreds(workspaceId) {
    if (!workspaceId) return null;
    const request = await prisma.zXCallRequest.findFirst({
        where: { workspaceId, status: "ACTIVE" },
        orderBy: { activatedAt: "desc" },
    });
    if (!request?.appId || !request?.secretKey) return null;
    const raw = String(request.appId).trim();
    const appid = Number(raw.includes("_") ? raw.split("_").pop() : raw);
    if (!appid) return null;
    return { appid, secret: request.secretKey, didNumber: request.didNumber };
}

// Next 4-digit C2C "User ID" (TeleCMI extension) for the workspace — starts at 1000.
async function nextExtension(workspaceId) {
    const top = await prisma.user.findFirst({
        where: { workspaceId, telecmiUserId: { not: null } },
        orderBy: { telecmiUserId: "desc" },
        select: { telecmiUserId: true },
    });
    return top?.telecmiUserId ? top.telecmiUserId + 1 : 1000;
}

function formatPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length === 10 ? `91${digits}` : digits;
}

// Provisions a click-to-call user in TeleCMI.
// Sends only the mandatory params + followme:true. Returns { extension, agentId }.
async function addC2CUser({ workspaceId, name, email, phone, password }) {
    const creds = await getWorkspaceTelecmiCreds(workspaceId);
    if (!creds) throw new Error("No active ZX Call (TeleCMI) credentials for this workspace.");

    const [first_name, ...rest] = String(name || "").trim().split(/\s+/);
    const last_name = rest.join(" ") || first_name || "-";

    let extension = await nextExtension(workspaceId);

    // Retry a few times if TeleCMI reports the extension is taken
    for (let attempt = 0; attempt < 5; attempt++) {
        const payload = {
            appid: creds.appid,
            secret: creds.secret,
            extension,
            first_name,
            last_name,
            email_id: email,
            phone_number: formatPhone(phone),
            password,
            followme: true,
        };

        const { data } = await axios.post(TELECMI_ADD_USER_URL, payload, {
            validateStatus: () => true,
        });

        if (data?.status === "success" || data?.code === 200) {
            return {
                extension: data?.agent?.extension || extension,
                agentId: data?.agent?.agent_id || `${extension}_${creds.appid}`,
            };
        }
        if (data?.msg && /Extension Already Exists/i.test(data.msg)) {
            extension += 1;
            continue;
        }
        throw new Error(data?.msg || "TeleCMI user creation failed");
    }
    throw new Error("Could not allocate a free extension in TeleCMI.");
}

// C2C quota for a workspace — aggregates userLimit across ALL active requests
// (so re-onboarding adds seats, and multiple active requests sum rather than overwrite).
async function getC2CQuota(workspaceId) {
    if (!workspaceId) return { hasActive: false, limit: 0, used: 0, remaining: 0 };
    const actives = await prisma.zXCallRequest.findMany({
        where: { workspaceId, status: "ACTIVE" },
        select: { userLimit: true },
    });
    const hasActive = actives.length > 0;
    const limit = actives.reduce((sum, r) => sum + (r.userLimit || 0), 0);
    const used = await prisma.user.count({ where: { workspaceId, isC2C: true } });
    return { hasActive, limit, used, remaining: Math.max(0, limit - used) };
}

// Best-effort de-provision of a TeleCMI agent. Never throws — deletion of the
// CRM user must not be blocked if the remote call fails.
async function removeC2CUser({ workspaceId, extension }) {
    try {
        if (!extension) return;
        const creds = await getWorkspaceTelecmiCreds(workspaceId);
        if (!creds) return;
        await axios.post(
            TELECMI_REMOVE_USER_URL,
            { appid: creds.appid, secret: creds.secret, extension },
            { validateStatus: () => true }
        );
    } catch (err) {
        console.error("[TeleCMI] removeC2CUser failed:", err.message);
    }
}

// Update a TeleCMI user's details (phone, name). Best-effort — never throws.
async function updateC2CUser({ workspaceId, agentId, phone, name }) {
    try {
        if (!agentId) return;
        const creds = await getWorkspaceTelecmiCreds(workspaceId);
        if (!creds) return;

        const updates = { appid: creds.appid, secret: creds.secret, agent_id: agentId };
        if (phone) updates.phone_number = formatPhone(phone);
        if (name) {
            const [first_name, ...rest] = String(name).trim().split(/\s+/);
            updates.first_name = first_name;
            updates.last_name = rest.join(" ") || first_name || "-";
        }

        const { data } = await axios.post(TELECMI_UPDATE_USER_URL, updates, { validateStatus: () => true });
        if (data?.status !== "success" && data?.code !== 200) {
            console.warn("[TeleCMI] updateC2CUser:", data?.msg || "non-success response");
        }
    } catch (err) {
        console.error("[TeleCMI] updateC2CUser failed:", err.message);
    }
}

// Fetch all TeleCMI agents for a workspace.
async function listAllTelecmiUsers(workspaceId) {
    const creds = await getWorkspaceTelecmiCreds(workspaceId);
    if (!creds) throw new Error("No active ZX Call credentials for this workspace.");
    const { data } = await axios.post(TELECMI_LIST_ALL_URL, { appid: creds.appid, secret: creds.secret }, { validateStatus: () => true });
    if (data?.status !== "success" && data?.code !== 200) {
        throw new Error(data?.msg || "Failed to fetch TeleCMI users");
    }
    return data?.agents || [];
}

// Click-to-call: rings the agent's own mobile (followme) first, then connects
// the lead. user_id = the agent's telecmiAgentId ({userId}_{appId}).
async function clickToCall({ workspaceId, agentUserId, toNumber }) {
    if (!agentUserId) throw new Error("This user is not provisioned for C2C calling.");
    const creds = await getWorkspaceTelecmiCreds(workspaceId);
    if (!creds) throw new Error("No active ZX Call (TeleCMI) credentials for this workspace.");

    const payload = {
        user_id: agentUserId,
        secret: creds.secret,
        to: Number(formatPhone(toNumber)),
        extra_params: { crm: true },
        webrtc: false,    // followme=true requires webrtc=false
        followme: true,   // ring the agent's mobile device first
        ...(creds.didNumber ? { callerid: Number(formatPhone(creds.didNumber)) } : {}),
    };

    const { data } = await axios.post(TELECMI_CLICK2CALL_URL, payload, { validateStatus: () => true });
    if (data?.code === 200 || /initiated/i.test(data?.msg || "")) {
        return { requestId: data?.request_id, msg: data?.msg || "Call initiated" };
    }
    throw new Error(data?.msg || "Click-to-call failed");
}

module.exports = { addC2CUser, updateC2CUser, removeC2CUser, getC2CQuota, clickToCall, getWorkspaceTelecmiCreds, listAllTelecmiUsers };
