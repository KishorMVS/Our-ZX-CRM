/**
 * One-time script: re-score all already-transcribed calls using the current callScoringConfig.
 * Run after setting up scoring parameters in Super Admin → Settings → Call Scoring.
 *
 * Usage: node scripts/rescoreLeads.js
 */

require("dotenv").config();
const prisma = require("../src/utils/prisma");
const { scoreCallConversation } = require("../src/services/transcriptionService");
const calculateLeadScore = require("../src/utils/leadScorer");

async function main() {
    // Load scoring configs per workspace
    const allSettings = await prisma.companySettings.findMany({
        select: { workspaceId: true, callScoringConfig: true },
    });

    const configByWorkspace = {};
    for (const s of allSettings) {
        if (Array.isArray(s.callScoringConfig) && s.callScoringConfig.length > 0) {
            configByWorkspace[s.workspaceId] = s.callScoringConfig;
        }
    }

    const workspaceIds = Object.keys(configByWorkspace);
    if (workspaceIds.length === 0) {
        console.log("No scoring config found in any workspace. Set it up first in Super Admin → Settings → Call Scoring.");
        process.exit(0);
    }

    console.log(`Found scoring config in ${workspaceIds.length} workspace(s).`);

    // Find all transcribed callLogs linked to a lead with plainText
    const callLogs = await prisma.callLog.findMany({
        where: { isTranscribed: true },
        include: { lead: { select: { id: true, score: true, status: true, workspaceId: true } } },
        orderBy: { transcribedAt: "asc" },
    });

    console.log(`Found ${callLogs.length} transcribed call(s) to re-score.`);

    let updated = 0;
    let skipped = 0;

    // Accumulate scores per lead across multiple calls
    const leadScoreAccumulator = {}; // leadId → current score (from DB)

    for (const log of callLogs) {
        const lead = log.lead;
        if (!lead || lead.status === "CONVERTED") { skipped++; continue; }

        const wsId = lead.workspaceId;
        const params = configByWorkspace[wsId];
        if (!params) { skipped++; continue; }
        if (!log.plainText?.trim()) { skipped++; continue; }

        // Use accumulated score if this lead was already updated in this run
        if (!(lead.id in leadScoreAccumulator)) {
            leadScoreAccumulator[lead.id] = lead.score || 0;
        }

        try {
            const { callScore, scoreBreakdown } = await scoreCallConversation(log.plainText, params);
            console.log(`  callLog ${log.id} → callScore=${callScore} (${scoreBreakdown?.map(b => `${b.name}:${b.score}/${b.maxPoints}`).join(", ")})`);

            if (callScore > 0) {
                const currentScore = leadScoreAccumulator[lead.id];
                const newScore = Math.min(currentScore + callScore, 99);
                leadScoreAccumulator[lead.id] = newScore;
            }
        } catch (err) {
            console.error(`  Failed to score callLog ${log.id}:`, err.message);
            skipped++;
        }
    }

    // Write final accumulated scores
    for (const [leadId, newScore] of Object.entries(leadScoreAccumulator)) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { score: true, status: true } });
        if (!lead || lead.status === "CONVERTED") continue;

        const { category } = calculateLeadScore({ score: newScore, scoreUpdated: true });
        await prisma.lead.update({
            where: { id: leadId },
            data: { score: newScore, scoreUpdated: true, category },
        });
        console.log(`✅ Lead ${leadId}: score → ${newScore} (${category})`);
        updated++;
    }

    console.log(`\nDone. Updated ${updated} lead(s), skipped ${skipped} call(s).`);
    await prisma.$disconnect();
}

main().catch(err => {
    console.error("Script failed:", err);
    prisma.$disconnect();
    process.exit(1);
});
