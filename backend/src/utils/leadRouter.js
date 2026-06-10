const prisma = require("./prisma");
const { createNotification } = require("../services/notificationService");

/**
 * Automatically routes a lead to the sales rep with the lowest current workload.
 * @param {string} leadId 
 */
const routeLead = async (leadId) => {
    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        const score = lead?.score || 0;
        console.log(`[LeadRouter] Routing request for Lead: ${lead?.name || leadId} (Score: ${score}, AssignedTo: ${lead?.assignedToId})`);

        if (!lead || lead.assignedToId || (score < 25)) {
            if (score < 25) console.log(`[LeadRouter] Lead ${leadId} skipped: score ${score} is below threshold.`);
            if (lead?.assignedToId) console.log(`[LeadRouter] Lead ${leadId} skipped: already assigned to ${lead.assignedToId}.`);
            return; // Already assigned or score is below 25 (unqualified)
        }

        // 1. Find potential sales reps with their ACTIVE workload
        // We only count leads that are currently being worked on (NEW, CONTACTED, FOLLOW_UP)
        const salesReps = await prisma.user.findMany({
            where: {
                role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
                isActive: true
            },
            include: {
                assignedLeads: {
                    where: {
                        status: { in: ["NEW", "CONTACTED", "FOLLOW_UP"] }
                    },
                    select: { id: true }
                }
            }
        });

        if (salesReps.length === 0) {
            console.log(`[LeadRouter] No active sales reps found for lead: ${lead.name}`);
            return;
        }

        // 2. Sort by active workload (ascending) - Base workload split
        salesReps.sort((a, b) => a.assignedLeads.length - b.assignedLeads.length);

        // 3. Assign to the single least-busy person (Split leads)
        const primaryRep = salesReps[0];
        const selectedReps = [primaryRep];

        // 4. Update Database
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                assignedToId: primaryRep.id,
                assignedReps: {
                    set: selectedReps.map(rep => ({ id: rep.id }))
                }
            }
        });

        // 5. Log activity and notify
        for (const rep of selectedReps) {
            const isPrimary = rep.id === primaryRep.id;

            await prisma.activity.create({
                data: {
                    leadId: leadId,
                    userId: rep.id,
                    action: "AUTO_ASSIGNED",
                    metadata: {
                        reason: "Score-Based Workload Split",
                        score: score,
                        workloadAtAssignment: rep.assignedLeads.length,
                        type: "PRIMARY"
                    }
                }
            });

            await createNotification({
                userId: rep.id,
                title: "🆕 New Qualified Lead Assigned",
                message: `Lead "${lead.name}" (Score: ${score}) has been automatically assigned to you based on your current workload.`,
                type: "LEAD_ASSIGNED",
                link: `/leads`
            });

            console.log(`✅ [LeadRouter] Lead ${lead.id} assigned to ${rep.name} (Load: ${rep.assignedLeads.length})`);
        }

    } catch (error) {
        console.error("❌ [LeadRouter] Error:", error);
    }
};

/**
 * Automatically routes multiple leads to sales reps based on current workload.
 * @param {string[]} leadIds 
 */
const bulkRouteLeads = async (leadIds) => {
    try {
        if (!leadIds || leadIds.length === 0) return;

        // Find potential sales reps
        const salesReps = await prisma.user.findMany({
            where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
            select: { id: true, name: true, _count: { select: { assignedLeads: true } } }
        });

        if (salesReps.length === 0) return;

        // Process each lead
        for (const leadId of leadIds) {
            // Re-sort every time to ensure balance during bulk assignment
            salesReps.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
            const assignedRep = salesReps[0];

            // Check if lead is qualified (score >= 25)
            const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { score: true } });
            if (!lead || lead.score < 25) {
                console.log(`[LeadRouter] Skipping lead ${leadId} in bulk routing because score is below 25.`);
                continue;
            }

            await prisma.lead.update({
                where: { id: leadId },
                data: { assignedToId: assignedRep.id }
            });

            // Increment local count so the next lead in the loop is assigned to the next best rep
            assignedRep._count.assignedLeads++;

            await prisma.activity.create({
                data: {
                    leadId,
                    userId: assignedRep.id,
                    action: "AUTO_ASSIGNED",
                    metadata: { reason: "Bulk Least-Load Routing" }
                }
            });

            await createNotification({
                userId: assignedRep.id,
                title: "🆕 Bulk Lead Assigned",
                message: `You have been assigned a new lead as part of a batch distribution.`,
                type: "LEAD_ASSIGNED",
                link: `/leads`
            });
        }

        console.log(`✅ [LeadRouter] Bulk distributed ${leadIds.length} leads.`);

    } catch (error) {
        console.error("❌ [LeadRouter] Bulk Error:", error);
    }
};

module.exports = { routeLead, bulkRouteLeads };
