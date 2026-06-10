const prisma = require("../utils/prisma");

// Detailed call analytics for a single user, with optional date range filter.
// GET /api/analytics/user-calls/:userId?from=YYYY-MM-DD&to=YYYY-MM-DD
const getUserCallAnalytics = async (req, res) => {
    try {
        const { userId } = req.params;
        const { workspaceId } = req.user;

        // Date range defaults: last 30 days
        const to   = req.query.to   ? new Date(req.query.to)   : new Date();
        const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        to.setHours(23, 59, 59, 999);
        from.setHours(0, 0, 0, 0);

        // Verify user belongs to the same workspace
        const targetUser = await prisma.user.findFirst({
            where: { id: userId, workspaceId },
            select: { id: true, name: true, email: true, role: true, department: true, profilePhoto: true, telecmiAgentId: true, isC2C: true },
        });
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        const callWhere = {
            userId,
            createdAt: { gte: from, lte: to },
        };

        const calls = await prisma.callLog.findMany({
            where: callWhere,
            select: {
                id: true,
                callType: true,
                callStatus: true,
                duration: true,
                callDate: true,
                createdAt: true,
                sentiment: true,
                tone: true,
                callCategory: true,
                isTranscribed: true,
                toNumber: true,
                agentNumber: true,
                recordingUrl: true,
                summary: true,
                lead: { select: { id: true, name: true, phone: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const total = calls.length;
        const answered = calls.filter(c => c.callStatus === "COMPLETED").length;
        const noAnswer = calls.filter(c => c.callStatus === "NO_ANSWER").length;
        const busy     = calls.filter(c => c.callStatus === "BUSY").length;
        const failed   = calls.filter(c => c.callStatus === "FAILED").length;

        const answeredCalls = calls.filter(c => c.callStatus === "COMPLETED" && c.duration > 0);
        const totalTalkSec  = calls.reduce((s, c) => s + (c.duration || 0), 0);
        const avgDuration   = answeredCalls.length ? Math.round(totalTalkSec / answeredCalls.length) : 0;
        const answerRate    = total ? Math.round((answered / total) * 100) : 0;

        // Inbound vs Outbound
        const outbound = calls.filter(c => c.callType === "OUTBOUND").length;
        const inbound  = calls.filter(c => c.callType === "INBOUND").length;

        // Sentiment breakdown (only transcribed calls)
        const sentimentMap = {};
        calls.forEach(c => {
            if (!c.isTranscribed || !c.sentiment) return;
            const key = c.sentiment.toLowerCase();
            sentimentMap[key] = (sentimentMap[key] || 0) + 1;
        });

        // Tone breakdown
        const toneMap = {};
        calls.forEach(c => {
            if (!c.isTranscribed || !c.tone) return;
            const key = c.tone.toLowerCase();
            toneMap[key] = (toneMap[key] || 0) + 1;
        });

        // Category breakdown
        const categoryMap = {};
        calls.forEach(c => {
            if (!c.callCategory) return;
            const key = c.callCategory;
            categoryMap[key] = (categoryMap[key] || 0) + 1;
        });

        // Daily trend — group by date string
        const dailyMap = {};
        calls.forEach(c => {
            const day = (c.callDate || c.createdAt).toISOString().slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = { date: day, total: 0, answered: 0, duration: 0 };
            dailyMap[day].total += 1;
            if (c.callStatus === "COMPLETED") dailyMap[day].answered += 1;
            dailyMap[day].duration += c.duration || 0;
        });
        const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        // Top 5 leads contacted most
        const leadCallCount = {};
        calls.forEach(c => {
            if (!c.lead) return;
            const key = c.lead.id;
            if (!leadCallCount[key]) leadCallCount[key] = { lead: c.lead, count: 0 };
            leadCallCount[key].count += 1;
        });
        const topLeads = Object.values(leadCallCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Conversion rate: leads that were CONVERTED whose calls were made by this user
        const convertedLeadIds = new Set(
            calls.filter(c => c.lead?.status === "CONVERTED").map(c => c.lead.id)
        );
        const uniqueLeadIds = new Set(calls.filter(c => c.lead).map(c => c.lead.id));
        const conversionRate = uniqueLeadIds.size
            ? Math.round((convertedLeadIds.size / uniqueLeadIds.size) * 100)
            : 0;

        res.json({
            user: targetUser,
            period: { from: from.toISOString(), to: to.toISOString() },
            summary: {
                total,
                answered,
                noAnswer,
                busy,
                failed,
                answerRate,
                totalTalkSec,
                avgDuration,
                outbound,
                inbound,
                transcribed: calls.filter(c => c.isTranscribed).length,
                uniqueLeadsContacted: uniqueLeadIds.size,
                convertedLeads: convertedLeadIds.size,
                conversionRate,
            },
            breakdowns: {
                byStatus: { answered, noAnswer, busy, failed },
                byType: { outbound, inbound },
                sentiment: sentimentMap,
                tone: toneMap,
                category: categoryMap,
            },
            dailyTrend,
            topLeads,
            calls,
        });
    } catch (error) {
        console.error("[UserCallAnalytics] Error:", error.message);
        res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
    }
};

// Summary of all users in the workspace — for team-level comparison.
// GET /api/analytics/user-calls?from=YYYY-MM-DD&to=YYYY-MM-DD
const getAllUsersCallSummary = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const to   = req.query.to   ? new Date(req.query.to)   : new Date();
        const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        to.setHours(23, 59, 59, 999);
        from.setHours(0, 0, 0, 0);

        const users = await prisma.user.findMany({
            where: { workspaceId, isActive: true },
            select: { id: true, name: true, email: true, role: true, department: true, profilePhoto: true, isC2C: true },
        });

        const summaries = await Promise.all(users.map(async (u) => {
            const calls = await prisma.callLog.findMany({
                where: { userId: u.id, createdAt: { gte: from, lte: to } },
                select: { callStatus: true, duration: true, callType: true },
            });
            const total     = calls.length;
            const answered  = calls.filter(c => c.callStatus === "COMPLETED").length;
            const totalSec  = calls.reduce((s, c) => s + (c.duration || 0), 0);
            const answerRate = total ? Math.round((answered / total) * 100) : 0;
            return {
                user: u,
                total,
                answered,
                answerRate,
                totalTalkSec: totalSec,
                outbound: calls.filter(c => c.callType === "OUTBOUND").length,
                inbound:  calls.filter(c => c.callType === "INBOUND").length,
            };
        }));

        // Sort by total calls descending
        summaries.sort((a, b) => b.total - a.total);

        res.json({ period: { from: from.toISOString(), to: to.toISOString() }, users: summaries });
    } catch (error) {
        console.error("[AllUserCallSummary] Error:", error.message);
        res.status(500).json({ message: "Failed to fetch summary", error: error.message });
    }
};

module.exports = { getUserCallAnalytics, getAllUsersCallSummary };
