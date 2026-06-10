/**
 * Auto-transcribe completed calls that have a recording but haven't been transcribed yet.
 * Handles both:
 *   - PIOPIY / AI outbound calls (agentNumber === ZENVOICE_FROM_PHONE) → api.piopiy.com
 *   - C2C / TeleCMI calls (all others with a filename) → rest.telecmi.com/v2/play
 *
 * Runs on a schedule. Safe to run concurrently — marks a call as transcribing before
 * starting so parallel runs skip it.
 */

const prisma = require("../utils/prisma");

const saveTranscription = async (callLog, result) => {
    await prisma.callLog.update({
        where: { id: callLog.id },
        data: {
            transcription: result.transcription,
            plainText: result.plainText,
            summary: result.summary,
            tone: result.tone,
            urgency: result.urgency,
            emotion: result.emotion,
            callCategory: result.category,
            sentiment: result.sentiment,
            feedback: result.feedback,
            conclusion: result.conclusion,
            isTranscribed: true,
            transcribedAt: new Date(),
            ...(result.duration ? { duration: result.duration } : callLog.duration ? { duration: callLog.duration } : {}),
        },
    });

    // Apply scoring to the lead if config exists and lead is not already converted
    if (!callLog.leadId) {
        console.log(`[Auto-Transcribe] Scoring skipped for callLog ${callLog.id} — no leadId`);
        return;
    }
    if (!result.plainText) {
        console.log(`[Auto-Transcribe] Scoring skipped for callLog ${callLog.id} — plainText is empty`);
        return;
    }
    try {
        const { scoreCallConversation } = require("../services/transcriptionService");
        const calculateLeadScore = require("../utils/leadScorer");

        // If lead not included, fetch workspaceId directly
        let workspaceId = callLog.lead?.workspaceId;
        if (!workspaceId) {
            const lead = await prisma.lead.findUnique({ where: { id: callLog.leadId }, select: { workspaceId: true } });
            workspaceId = lead?.workspaceId;
        }

        console.log(`[Auto-Transcribe] Scoring callLog ${callLog.id}, leadId=${callLog.leadId}, workspaceId=${workspaceId}`);

        const settings = workspaceId
            ? await prisma.companySettings.findFirst({ where: { workspaceId } })
            : null;
        const scoringParams = settings?.callScoringConfig;
        const paramArray = Array.isArray(scoringParams) ? scoringParams : [];

        console.log(`[Auto-Transcribe] scoringParams count: ${paramArray.length}`);

        if (paramArray.length === 0) {
            console.log(`[Auto-Transcribe] No scoring params configured — skipping score update for lead ${callLog.leadId}`);
            return;
        }

        const { callScore, scoreBreakdown } = await scoreCallConversation(result.plainText, paramArray);
        console.log(`[Auto-Transcribe] callScore=${callScore}, breakdown=${JSON.stringify(scoreBreakdown?.map(b => `${b.name}:${b.score}/${b.maxPoints}`))}`);

        if (callScore > 0) {
            const lead = await prisma.lead.findUnique({ where: { id: callLog.leadId }, select: { score: true, status: true } });
            if (lead && lead.status !== "CONVERTED") {
                const newScore = Math.min((lead.score || 0) + callScore, 99);
                const { category } = calculateLeadScore({ score: newScore, scoreUpdated: true });
                await prisma.lead.update({
                    where: { id: callLog.leadId },
                    data: { score: newScore, scoreUpdated: true, category },
                });
                console.log(`[Auto-Transcribe] ✅ Lead ${callLog.leadId} score: ${lead.score} → ${newScore} (+${callScore})`);
            } else if (lead?.status === "CONVERTED") {
                console.log(`[Auto-Transcribe] Lead ${callLog.leadId} is CONVERTED — score not updated`);
            }
        } else {
            console.log(`[Auto-Transcribe] callScore=0 for lead ${callLog.leadId} — no update`);
        }
    } catch (scoringErr) {
        console.error(`[Auto-Transcribe] Scoring error for lead ${callLog.leadId} (non-fatal):`, scoringErr.message);
    }
};

const autoTranscribePendingCalls = async () => {
    const { transcribeFromUrl } = require("../services/transcriptionService");
    const { getWorkspaceTelecmiCreds } = require("../services/telecmiService");

    const zenvoiceFromLast10 = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);
    const piopiyKey = process.env.PIOPIY_API_KEY;

    // Find completed calls with a recording that haven't been transcribed yet
    const pending = await prisma.callLog.findMany({
        where: {
            callStatus: "COMPLETED",
            isTranscribed: false,
            recordingUrl: { not: null },
        },
        include: { lead: { select: { workspaceId: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 10, // process up to 10 per run to avoid overload
    });

    if (!pending.length) return;

    console.log(`[Auto-Transcribe] ${pending.length} pending call(s) to transcribe...`);

    for (const callLog of pending) {
        const storedUrl = callLog.recordingUrl;
        const agentLast10 = String(callLog.agentNumber || "").replace(/\D/g, "").slice(-10);
        const isAiCall = zenvoiceFromLast10 && agentLast10 && agentLast10 === zenvoiceFromLast10;

        try {
            // Mark as transcribed immediately to prevent duplicate runs picking it up
            await prisma.callLog.update({
                where: { id: callLog.id },
                data: { isTranscribed: true, transcribedAt: new Date() },
            });

            let result;

            if (storedUrl.startsWith("/uploads/")) {
                // Local file — skip (transcribeFromFile needs a filesystem path, handle manually)
                console.log(`[Auto-Transcribe] Skipping local file for callLog ${callLog.id}`);
                await prisma.callLog.update({ where: { id: callLog.id }, data: { isTranscribed: false, transcribedAt: null } });
                continue;

            } else if (isAiCall) {
                // ── PIOPIY / AI outbound ───────────────────────────────────────
                if (!piopiyKey) {
                    console.warn(`[Auto-Transcribe] PIOPIY_API_KEY not set — skipping callLog ${callLog.id}`);
                    await prisma.callLog.update({ where: { id: callLog.id }, data: { isTranscribed: false, transcribedAt: null } });
                    continue;
                }

                if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
                    console.log(`[Auto-Transcribe] ZenVoice direct URL: ${callLog.id}`);
                    result = await transcribeFromUrl(storedUrl);
                } else {
                    const downloadUrl = `https://api.piopiy.com/sip/app/call/recording/play/${encodeURIComponent(storedUrl)}`;
                    console.log(`[Auto-Transcribe] PIOPIY callLog ${callLog.id}: ${downloadUrl}`);
                    result = await transcribeFromUrl(downloadUrl, { Authorization: `Bearer ${piopiyKey}` });
                }

            } else {
                // ── C2C / TeleCMI recording ────────────────────────────────────
                const workspaceId = callLog.lead?.workspaceId;
                const creds = workspaceId ? await getWorkspaceTelecmiCreds(workspaceId) : null;

                let filename = storedUrl;
                if (filename.startsWith("http")) {
                    const m = filename.match(/\/([^/]+)$/);
                    filename = m?.[1] || null;
                }

                if (!creds?.appid || !creds?.secret || !filename) {
                    console.warn(`[Auto-Transcribe] Missing TeleCMI creds for callLog ${callLog.id} — skipping`);
                    await prisma.callLog.update({ where: { id: callLog.id }, data: { isTranscribed: false, transcribedAt: null } });
                    continue;
                }

                const downloadUrl = `https://rest.telecmi.com/v2/play?appid=${creds.appid}&secret=${creds.secret}&file=${encodeURIComponent(filename)}`;
                console.log(`[Auto-Transcribe] TeleCMI callLog ${callLog.id}: ${filename}`);
                result = await transcribeFromUrl(downloadUrl);
            }

            await saveTranscription(callLog, result);
            console.log(`[Auto-Transcribe] ✅ callLog ${callLog.id} transcribed successfully.`);

        } catch (err) {
            console.error(`[Auto-Transcribe] ❌ Failed for callLog ${callLog.id}:`, err.message);
            // Un-mark so it will be retried next run
            await prisma.callLog.update({ where: { id: callLog.id }, data: { isTranscribed: false, transcribedAt: null } }).catch(() => {});
        }
    }
};

module.exports = autoTranscribePendingCalls;
module.exports.saveTranscription = saveTranscription;
