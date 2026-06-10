const prisma = require("../utils/prisma");
const fasterqService = require("../services/fasterqService");
const { isDeptScopedAdmin, getUserScopeFilter } = require("../utils/workspaceScope");

// Team Performance Metrics
const getTeamPerformance = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const users = await prisma.user.findMany({
            // getUserScopeFilter confines a department-scoped admin to their department.
            where: { role: "EMPLOYEE", ...getUserScopeFilter(req.user) },
            include: {
                assignedLeads: { select: { status: true, firstResponseAt: true, createdAt: true } },
                tasks: { select: { status: true, dueDate: true } }
            }
        });

        const performance = users.map(user => {
            const totalLeads = user.assignedLeads.length;
            const convertedLeads = user.assignedLeads.filter(l => l.status === "CONVERTED").length;
            const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

            const pendingTasks = user.tasks.filter(t => t.status === "PENDING").length;
            const overdueTasks = user.tasks.filter(t => t.status === "PENDING" && new Date(t.dueDate) < new Date()).length;

            let totalResponseTimeMs = 0;
            let responseCount = 0;
            user.assignedLeads.forEach(l => {
                if (l.firstResponseAt) {
                    totalResponseTimeMs += (new Date(l.firstResponseAt) - new Date(l.createdAt));
                    responseCount++;
                }
            });
            const avgResponseTimeHours = responseCount > 0 ? (totalResponseTimeMs / (1000 * 60 * 60) / responseCount).toFixed(1) : 0;

            return {
                userId: user.id,
                name: user.name,
                totalLeads,
                convertedLeads,
                conversionRate: `${conversionRate}%`,
                pendingTasks,
                overdueTasks,
                avgResponseTimeHours
            };
        });

        res.json(performance);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team performance", error: error.message });
    }
};

// Response Time Analytics
const getResponseTimeAnalytics = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const leadsWithResponse = await prisma.lead.findMany({
            where: {
                firstResponseAt: { not: null },
                ...(workspaceId ? { workspaceId } : {}),
                // A department-scoped admin only measures their department's leads.
                ...(isDeptScopedAdmin(req.user) ? { assignedTo: { departmentId: req.user.departmentId } } : {})
            },
            select: { createdAt: true, firstResponseAt: true }
        });

        if (leadsWithResponse.length === 0) return res.json({ avgResponseTime: 0 });

        const totalMs = leadsWithResponse.reduce((acc, lead) => {
            return acc + (new Date(lead.firstResponseAt) - new Date(lead.createdAt));
        }, 0);

        const avgHours = (totalMs / (1000 * 60 * 60) / leadsWithResponse.length).toFixed(2);

        res.json({ avgResponseTimeHours: avgHours, baseSize: leadsWithResponse.length });
    } catch (error) {
        res.status(500).json({ message: "Error fetching analytics", error: error.message });
    }
};


// Dashboard Analytics for Lead -> Sale tracking
const getDashboardAnalytics = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const wsFilter = workspaceId ? { workspaceId } : {};

        // A department-scoped admin only sees their department's slice: leads handled
        // by department members, and invoices/activities tied to those members/leads.
        const deptAdmin = isDeptScopedAdmin(req.user);
        const deptId = req.user.departmentId;
        const leadScope = deptAdmin ? { ...wsFilter, assignedTo: { departmentId: deptId } } : wsFilter;
        const invoiceScope = deptAdmin
            ? { createdBy: { workspaceId, departmentId: deptId } }
            : (workspaceId ? { createdBy: { workspaceId } } : {});
        const activityLeadScope = deptAdmin
            ? { lead: { workspaceId, assignedTo: { departmentId: deptId } } }
            : (workspaceId ? { lead: { workspaceId } } : {});

        const [totalLeads, convertedLeads, lostLeads, aiQualifiedLeads, leadsBySource, revenueData, recentActivities] = await Promise.all([
            prisma.lead.count({ where: leadScope }),
            prisma.lead.count({ where: { ...leadScope, status: "CONVERTED" } }),
            prisma.lead.count({ where: { ...leadScope, status: "LOST" } }),
            prisma.lead.count({
                where: {
                    ...leadScope,
                    tags: { hasSome: ["ai qualified", "ai call qualified"] }
                }
            }),
            prisma.lead.groupBy({
                by: ["source"],
                where: leadScope,
                _count: { _all: true }
            }),
            prisma.invoice.aggregate({
                where: {
                    status: { in: ["PAID", "PARTIALLY_PAID"] },
                    ...invoiceScope
                },
                _sum: { total: true }
            }),
            prisma.activity.findMany({
                where: {
                    action: "LEAD_UPDATED",
                    metadata: { path: ["newStatus"], equals: "CONVERTED" },
                    ...activityLeadScope
                },
                take: 100,
                orderBy: { createdAt: "desc" }
            })
        ]);

        // Conversion Funnel Data
        const funnel = await prisma.lead.groupBy({
            by: ["status"],
            where: leadScope,
            _count: { _all: true }
        });

        // Avg Conversion Time from activities
        let totalConversionTimeMs = 0;
        let convertedCount = 0;

        for (const activity of recentActivities) {
            const lead = await prisma.lead.findUnique({
                where: { id: activity.leadId },
                select: { createdAt: true }
            });
            if (lead) {
                totalConversionTimeMs += (new Date(activity.createdAt) - new Date(lead.createdAt));
                convertedCount++;
            }
        }

        const avgConversionDays = convertedCount > 0
            ? (totalConversionTimeMs / (1000 * 60 * 60 * 24) / convertedCount).toFixed(1)
            : 0;

        // Revenue by month (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const invoices = await prisma.invoice.findMany({
            where: {
                status: { in: ["PAID", "PARTIALLY_PAID"] },
                createdAt: { gte: sixMonthsAgo },
                ...invoiceScope
            },
            select: { total: true, createdAt: true }
        });

        const revenueByMonth = {};
        invoices.forEach(inv => {
            const month = inv.createdAt.toLocaleString('default', { month: 'short' });
            revenueByMonth[month] = (revenueByMonth[month] || 0) + inv.total;
        });

        res.json({
            summary: {
                totalLeads,
                convertedLeads,
                lostLeads,
                aiQualifiedLeads,
                aiHandoffCount: totalLeads - aiQualifiedLeads,
                conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0,
                totalRevenue: revenueData._sum.total || 0,
                avgConversionDays
            },
            funnel: funnel.map(f => ({ status: f.status, count: f._count._all })),
            sourcePerformance: leadsBySource.map(s => ({ source: s.source, count: s._count._all })),
            revenueTrend: Object.entries(revenueByMonth).map(([month, amount]) => ({ month, amount }))
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching dashboard analytics", error: error.message });
    }
};

const getSalesPerformance = async (req, res) => {
    try {
        const { from } = req.query;
        const { workspaceId } = req.user;
        const targetDate = from ? new Date(from) : new Date();

        const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const users = await prisma.user.findMany({
            where: {
                role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
                isActive: true,
                // Confines a department-scoped admin to their department.
                ...getUserScopeFilter(req.user)
            },
            select: {
                id: true,
                name: true,
                role: true,
                attendances: {
                    where: { date: startOfDay }
                },
                statusLogs: {
                    where: {
                        changedAt: { gte: startOfDay, lt: endOfDay }
                    },
                    orderBy: { changedAt: "asc" }
                },
                callLogs: {
                    where: {
                        createdAt: { gte: startOfDay, lt: endOfDay }
                    }
                },
                assignedLeads: {
                    select: { status: true }
                }
            }
        });

        const now = new Date();
        const isToday = targetDate.toDateString() === now.toDateString();
        const calculationEnd = isToday ? now : endOfDay;

        const performance = users.map(user => {
            const attendance = user.attendances[0] || {};
            const logs = user.statusLogs;

            let onlineMs = 0;
            let breakMs = 0;

            if (logs.length > 0) {
                const augmentedLogs = [...logs];
                const lastLog = augmentedLogs[augmentedLogs.length - 1];

                if ((isToday || targetDate < now) && (lastLog.status === "ONLINE" || lastLog.status === "BREAK")) {
                    augmentedLogs.push({
                        status: "VIRTUAL_END",
                        changedAt: calculationEnd
                    });
                }

                for (let i = 0; i < augmentedLogs.length - 1; i++) {
                    const current = augmentedLogs[i];
                    const next = augmentedLogs[i + 1];
                    const duration = next.changedAt - current.changedAt;

                    if (current.status === "ONLINE") onlineMs += duration;
                    else if (current.status === "BREAK") breakMs += duration;
                }
            }

            const fasterqCalls = user.callLogs.filter(c => c.greeterCallId).length;
            const internalCalls = user.callLogs.length - fasterqCalls;
            const totalSpeakTimeSec = user.callLogs.reduce((acc, c) => acc + (c.duration || 0), 0);

            const totalLeads = user.assignedLeads.length;
            const convertedLeads = user.assignedLeads.filter(l => l.status === "CONVERTED").length;
            const winRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

            return {
                id: user.id,
                name: user.name,
                role: user.role,
                checkIn: attendance.checkIn || null,
                checkOut: attendance.checkOut || null,
                onlineHrs: (onlineMs / 3600000).toFixed(2),
                breakHrs: (breakMs / 3600000).toFixed(2),
                totalCalls: user.callLogs.length,
                totalSpeakTime: Math.round(totalSpeakTimeSec / 60),
                callSourceBreakdown: {
                    fasterq: fasterqCalls,
                    internal: internalCalls
                },
                convertedLeads,
                totalLeads,
                winRate
            };
        });

        res.json(performance);
    } catch (error) {
        console.error("Sales performance error:", error);
        res.status(500).json({ message: "Error fetching sales performance", error: error.message });
    }
};

// Personal dashboard for the logged-in employee/team lead
// Returns only data scoped to req.user.userId
const getMyDashboard = async (req, res) => {
    try {
        const { userId, workspaceId } = req.user;
        const wsFilter = workspaceId ? { workspaceId } : {};

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Resolve the user's department C2C flag — this drives which analytics they see:
        // C2C members get call/lead analytics, non-C2C members get task/sprint/kanban.
        const me = await prisma.user.findUnique({
            where: { id: userId },
            select: { isC2C: true, departmentRel: { select: { c2c: true } } },
        });
        const isC2C = !!(me?.departmentRel?.c2c || me?.isC2C);

        const [
            myLeads, myTasks, mySprints,
            myAttendanceThisMonth, myCallLogs,
        ] = await Promise.all([
            // Leads assigned to me
            prisma.lead.findMany({
                where: { ...wsFilter, assignedToId: userId },
                select: { status: true, createdAt: true },
            }),
            // Tasks assigned to me
            prisma.task.findMany({
                where: { assignedToId: userId },
                select: { status: true, dueDate: true, priority: true, kanbanStatus: true },
            }),
            // Sprints I'm involved in (have at least one task assigned to me)
            prisma.sprint.findMany({
                where: { ...wsFilter, tasks: { some: { assignedToId: userId } } },
                select: { status: true, name: true, startDate: true, endDate: true },
                take: 5,
                orderBy: { startDate: "desc" },
            }),
            // Attendance this month
            prisma.attendance.count({
                where: { userId, date: { gte: monthStart } },
            }),
            // Call logs this month
            prisma.callLog.count({
                where: { ...wsFilter, userId, createdAt: { gte: monthStart } },
            }),
        ]);

        // Lead stats — Lead has no monetary value field, so pipelineValue is not available
        const totalLeads      = myLeads.length;
        const convertedLeads  = myLeads.filter(l => l.status === "CONVERTED").length;
        const activeLeads     = myLeads.filter(l => !["CONVERTED", "LOST"].includes(l.status)).length;
        const conversionRate  = totalLeads > 0 ? +((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
        const pipelineValue   = 0;

        // Task stats
        const totalTasks      = myTasks.length;
        const doneTasks       = myTasks.filter(t => t.status === "DONE" || t.status === "COMPLETED").length;
        const pendingTasks    = myTasks.filter(t => t.status === "PENDING" || t.status === "TODO").length;
        const overdueTasks    = myTasks.filter(
            t => (t.status === "PENDING" || t.status === "TODO") && t.dueDate && new Date(t.dueDate) < now
        ).length;

        // Kanban column breakdown (by kanbanStatus)
        const kanbanCols = myTasks.reduce((acc, t) => {
            const k = t.kanbanStatus || "BACKLOG";
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});

        // Work profile is driven by the department's C2C flag, not by incidental data:
        // C2C members -> call/lead analytics ("sales"); everyone else -> tasks/sprints/kanban.
        res.json({
            workProfile: isC2C ? "sales" : "tasks",
            isC2C,
            leads: { totalLeads, convertedLeads, activeLeads, conversionRate, pipelineValue },
            tasks: { totalTasks, doneTasks, pendingTasks, overdueTasks, kanbanCols },
            sprints: mySprints,
            calls: { thisMonth: myCallLogs },
            attendance: { daysThisMonth: myAttendanceThisMonth },
            // Per-type leave balances are not modeled in the schema; left null (UI hides the panel)
            leave: { annualBalance: null, sickBalance: null, casualBalance: null },
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching personal dashboard", error: error.message });
    }
};

// ─── Team Lead analytics helpers ───────────────────────────────────────────
// Compute lead stats for a set of lead rows ({ status }).
const summarizeLeads = (rows) => {
    const total = rows.length;
    const converted = rows.filter(l => l.status === "CONVERTED").length;
    const active = rows.filter(l => !["CONVERTED", "LOST"].includes(l.status)).length;
    return {
        total,
        converted,
        active,
        conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0",
    };
};

// Compute task + kanban stats for a set of task rows ({ status, dueDate, kanbanStatus }).
const summarizeTasks = (rows, now) => {
    const total = rows.length;
    const done = rows.filter(t => ["DONE", "COMPLETED"].includes(t.status)).length;
    const pending = rows.filter(t => ["PENDING", "TODO"].includes(t.status)).length;
    const overdue = rows.filter(
        t => ["PENDING", "TODO"].includes(t.status) && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const kanban = rows.reduce((acc, t) => {
        const k = t.kanbanStatus || "BACKLOG";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});
    return { total, done, pending, overdue, kanban };
};

// Compute call stats for a set of call rows ({ duration }).
const summarizeCalls = (rows) => {
    const total = rows.length;
    const connected = rows.filter(c => (c.duration || 0) > 0).length;
    const talkTimeSec = rows.reduce((s, c) => s + (c.duration || 0), 0);
    return { thisMonth: total, connected, talkTimeMinutes: Math.round(talkTimeSec / 60) };
};

// Dashboard scoped to the team lead's department members.
// C2C departments get a lead/call-focused report; non-C2C get tasks/sprint/kanban/attendance.
// The team aggregate INCLUDES the team lead; a separate `me` block holds the lead's own numbers.
const getTeamLeadDashboard = async (req, res) => {
    try {
        const { userId, workspaceId } = req.user;

        // Resolve department + C2C flag of the requesting team lead
        const me = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                departmentId: true,
                isC2C: true,
                departmentRel: { select: { name: true, c2c: true } },
            },
        });
        const deptId = me?.departmentId;
        const isC2C = !!me?.departmentRel?.c2c;

        const emptyResponse = {
            departmentName: deptId ? (me?.departmentRel?.name || "Your Team") : "Unassigned",
            isC2C,
            memberCount: 0,
            attendance: { presentToday: 0, totalMembers: 0 },
            members: [],
            me: null,
            ...(isC2C
                ? { leads: summarizeLeads([]), calls: summarizeCalls([]) }
                : { tasks: summarizeTasks([], new Date()), activeSprints: 0 }),
        };

        if (!deptId) return res.json(emptyResponse);

        const members = await prisma.user.findMany({
            where: { ...(workspaceId ? { workspaceId } : {}), departmentId: deptId, isActive: true },
            select: { id: true, name: true, role: true, isC2C: true, profilePhoto: true },
        });
        const memberIds = members.map(m => m.id);
        if (memberIds.length === 0) return res.json(emptyResponse);

        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch only what the department type needs.
        const [leadsData, tasksData, callsData, attendanceToday, activeSprints] = await Promise.all([
            isC2C
                ? prisma.lead.findMany({ where: { assignedToId: { in: memberIds } }, select: { status: true, assignedToId: true } })
                : Promise.resolve([]),
            !isC2C
                ? prisma.task.findMany({ where: { assignedToId: { in: memberIds } }, select: { status: true, dueDate: true, kanbanStatus: true, assignedToId: true } })
                : Promise.resolve([]),
            isC2C
                ? prisma.callLog.findMany({ where: { userId: { in: memberIds }, createdAt: { gte: monthStart } }, select: { userId: true, duration: true } })
                : Promise.resolve([]),
            prisma.attendance.count({ where: { userId: { in: memberIds }, date: todayStart, status: { in: ["PRESENT", "HALF_DAY"] } } }),
            !isC2C
                ? prisma.sprint.count({ where: { ...(workspaceId ? { workspaceId } : {}), status: "ACTIVE" } })
                : Promise.resolve(0),
        ]);

        // Per-member breakdown — shape depends on department type
        const perMember = members.map(m => {
            const base = { id: m.id, name: m.name, role: m.role, isC2C: m.isC2C, profilePhoto: m.profilePhoto };
            if (isC2C) {
                const mLeads = leadsData.filter(l => l.assignedToId === m.id);
                const mCalls = callsData.filter(c => c.userId === m.id);
                return {
                    ...base,
                    leads: mLeads.length,
                    converted: mLeads.filter(l => l.status === "CONVERTED").length,
                    calls: mCalls.length,
                };
            }
            const mTasks = tasksData.filter(t => t.assignedToId === m.id);
            return {
                ...base,
                tasks: mTasks.length,
                tasksDone: mTasks.filter(t => ["DONE", "COMPLETED"].includes(t.status)).length,
            };
        });

        // Separate "my data" panel for the team lead (their own slice)
        const myStats = isC2C
            ? {
                isC2C: true,
                leads: summarizeLeads(leadsData.filter(l => l.assignedToId === userId)),
                calls: summarizeCalls(callsData.filter(c => c.userId === userId)),
            }
            : {
                isC2C: false,
                tasks: summarizeTasks(tasksData.filter(t => t.assignedToId === userId), now),
            };

        res.json({
            departmentName: me?.departmentRel?.name || "Your Team",
            isC2C,
            memberCount: members.length,
            attendance: { presentToday: attendanceToday, totalMembers: members.length },
            members: perMember,
            me: myStats,
            ...(isC2C
                ? { leads: summarizeLeads(leadsData), calls: summarizeCalls(callsData) }
                : { tasks: summarizeTasks(tasksData, now), activeSprints }),
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching team dashboard", error: error.message });
    }
};

// Drill-down: one member's report. C2C-aware. Team leads may only view members
// of their own department; admins/super-admins may view any member in their workspace.
const getTeamMemberReport = async (req, res) => {
    try {
        const { userId, role, workspaceId } = req.user;
        const { memberId } = req.params;

        const member = await prisma.user.findFirst({
            where: { id: memberId, ...(workspaceId ? { workspaceId } : {}) },
            select: {
                id: true, name: true, role: true, isC2C: true, profilePhoto: true,
                departmentId: true, departmentRel: { select: { name: true, c2c: true } },
            },
        });
        if (!member) return res.status(404).json({ message: "Member not found" });

        // Authorization: team leads are confined to their own department
        if (role === "TEAM_LEAD") {
            const me = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
            if (!me?.departmentId || me.departmentId !== member.departmentId) {
                return res.status(403).json({ message: "You can only view members of your own team" });
            }
        }

        const isC2C = !!(member.departmentRel?.c2c || member.isC2C);
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [leadsData, tasksData, callsData, attendanceThisMonth, sprints] = await Promise.all([
            isC2C
                ? prisma.lead.findMany({ where: { assignedToId: memberId }, select: { status: true } })
                : Promise.resolve([]),
            !isC2C
                ? prisma.task.findMany({ where: { assignedToId: memberId }, select: { status: true, dueDate: true, kanbanStatus: true } })
                : Promise.resolve([]),
            isC2C
                ? prisma.callLog.findMany({ where: { userId: memberId, createdAt: { gte: monthStart } }, select: { duration: true } })
                : Promise.resolve([]),
            prisma.attendance.count({ where: { userId: memberId, date: { gte: monthStart } } }),
            !isC2C
                ? prisma.sprint.findMany({
                    where: { ...(workspaceId ? { workspaceId } : {}), tasks: { some: { assignedToId: memberId } } },
                    select: { name: true, status: true, startDate: true, endDate: true },
                    orderBy: { startDate: "desc" },
                    take: 5,
                })
                : Promise.resolve([]),
        ]);

        // Present today?
        const presentToday = await prisma.attendance.count({
            where: { userId: memberId, date: todayStart, status: { in: ["PRESENT", "HALF_DAY"] } },
        });

        res.json({
            member: {
                id: member.id, name: member.name, role: member.role,
                profilePhoto: member.profilePhoto,
                department: member.departmentRel?.name || null,
            },
            isC2C,
            attendance: { daysThisMonth: attendanceThisMonth, presentToday: presentToday > 0 },
            ...(isC2C
                ? { leads: summarizeLeads(leadsData), calls: summarizeCalls(callsData) }
                : { tasks: summarizeTasks(tasksData, now), sprints }),
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching member report", error: error.message });
    }
};

module.exports = {
    getTeamPerformance,
    getResponseTimeAnalytics,
    getDashboardAnalytics,
    getSalesPerformance,
    getMyDashboard,
    getTeamLeadDashboard,
    getTeamMemberReport,
};
