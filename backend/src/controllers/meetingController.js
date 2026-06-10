const prisma = require("../utils/prisma");
const { createNotification } = require("../services/notificationService");
const { sendEmail } = require("../services/emailService");

const VALID_RECURRENCE = ["NONE", "DAILY", "DAILY_EXCEPT_WEEKENDS", "DAILY_EXCEPT_SUNDAY"];

const fmtWhen = (d) =>
    new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const recurrenceLabel = {
    NONE: "One-time",
    DAILY: "Every day",
    DAILY_EXCEPT_WEEKENDS: "Every day (except Sat & Sun)",
    DAILY_EXCEPT_SUNDAY: "Every day (except Sun)",
};

// Create a meeting and notify/invite all attendees.
const createMeeting = async (req, res) => {
    try {
        const { title, description, startAt, endAt, recurrence, attendeeIds } = req.body;
        const createdById = req.user.userId;
        const workspaceId = req.user.workspaceId || null;

        if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
        if (!startAt) return res.status(400).json({ message: "Start time is required" });
        const rec = VALID_RECURRENCE.includes(recurrence) ? recurrence : "NONE";

        // De-dupe attendees and always include the creator.
        const attendeeSet = new Set([...(Array.isArray(attendeeIds) ? attendeeIds : []), createdById]);

        // Restrict attendees to the creator's workspace.
        if (workspaceId) {
            const valid = await prisma.user.findMany({
                where: { id: { in: [...attendeeSet] }, workspaceId },
                select: { id: true },
            });
            const validIds = new Set(valid.map((u) => u.id));
            for (const id of [...attendeeSet]) if (!validIds.has(id)) attendeeSet.delete(id);
            attendeeSet.add(createdById);
        }

        const meeting = await prisma.meeting.create({
            data: {
                workspaceId,
                title: title.trim(),
                description: description || null,
                createdById,
                startAt: new Date(startAt),
                endAt: endAt ? new Date(endAt) : null,
                recurrence: rec,
                attendees: {
                    create: [...attendeeSet].map((userId) => ({ userId })),
                },
            },
            include: { attendees: true },
        });

        const creator = await prisma.user.findUnique({
            where: { id: createdById },
            select: { name: true },
        });
        const creatorName = creator?.name || "A colleague";

        // Notify + email every attendee except the creator.
        const recipients = [...attendeeSet].filter((id) => id !== createdById);
        const users = await prisma.user.findMany({
            where: { id: { in: recipients } },
            select: { id: true, email: true, name: true },
        });

        await Promise.all(
            users.map(async (u) => {
                await createNotification({
                    userId: u.id,
                    title: `📅 Meeting: ${meeting.title}`,
                    message: `${creatorName} scheduled "${meeting.title}" — ${recurrenceLabel[rec]} starting ${fmtWhen(meeting.startAt)}.`,
                    type: "MEETING",
                    link: "/calendar",
                }).catch(() => {});

                if (u.email) {
                    sendEmail({
                        to: u.email,
                        subject: `Meeting invite: ${meeting.title}`,
                        workspaceId,
                        fromUserId: createdById, // sent from the creator's SMTP identity
                        text:
                            `Hi ${u.name || ""},\n\n${creatorName} has scheduled a meeting with you.\n\n` +
                            `Title: ${meeting.title}\n` +
                            (meeting.description ? `Details: ${meeting.description}\n` : "") +
                            `When: ${fmtWhen(meeting.startAt)}\n` +
                            `Repeat: ${recurrenceLabel[rec]}\n\n` +
                            `Scheduled by: ${creatorName}\n`,
                    }).catch((e) => console.error("[MEETING] invite email failed:", e.message));
                }
            })
        );

        res.status(201).json(meeting);
    } catch (error) {
        console.error("[CREATE_MEETING]", error);
        res.status(500).json({ message: "Failed to create meeting", error: error.message });
    }
};

// List meetings the current user created or is invited to (optional date range).
const listMeetings = async (req, res) => {
    try {
        const userId = req.user.userId;
        const workspaceId = req.user.workspaceId || null;
        const { from, to } = req.query;

        // Always scope to meetings I created or am invited to. For a date range,
        // constrain only one-off meetings — recurring ones always show.
        const rangeClause =
            from || to
                ? {
                      OR: [
                          { recurrence: { not: "NONE" } },
                          {
                              recurrence: "NONE",
                              startAt: {
                                  ...(from ? { gte: new Date(from) } : {}),
                                  ...(to ? { lte: new Date(to) } : {}),
                              },
                          },
                      ],
                  }
                : {};

        const where = {
            ...(workspaceId ? { workspaceId } : {}),
            AND: [
                { OR: [{ createdById: userId }, { attendees: { some: { userId } } }] },
                ...(from || to ? [rangeClause] : []),
            ],
        };

        const meetings = await prisma.meeting.findMany({
            where,
            orderBy: { startAt: "asc" },
            include: { attendees: true },
        });

        // Attach attendee user info + the current user's own reminder setting.
        const userIds = [...new Set(meetings.flatMap((m) => [m.createdById, ...m.attendees.map((a) => a.userId)]))];
        const userRows = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
        });
        const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

        const result = meetings.map((m) => ({
            ...m,
            creatorName: userMap[m.createdById]?.name || "Unknown",
            myReminderMinutes: m.attendees.find((a) => a.userId === userId)?.reminderMinutes ?? null,
            isCreator: m.createdById === userId,
            attendees: m.attendees.map((a) => ({
                userId: a.userId,
                name: userMap[a.userId]?.name || "Unknown",
                reminderMinutes: a.reminderMinutes,
            })),
        }));

        res.json(result);
    } catch (error) {
        console.error("[LIST_MEETINGS]", error);
        res.status(500).json({ message: "Failed to fetch meetings", error: error.message });
    }
};

// An attendee sets their own reminder lead time for a meeting.
const updateMyReminder = async (req, res) => {
    try {
        const { id } = req.params; // meeting id
        const userId = req.user.userId;
        const { reminderMinutes } = req.body;

        const minutes = Number(reminderMinutes);
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
            return res.status(400).json({ message: "reminderMinutes must be between 0 and 1440" });
        }

        const attendee = await prisma.meetingAttendee.findUnique({
            where: { meetingId_userId: { meetingId: id, userId } },
        });
        if (!attendee) return res.status(404).json({ message: "You are not an attendee of this meeting" });

        // Reset the reminder bookkeeping so the new lead time fires.
        await prisma.meetingAttendee.update({
            where: { meetingId_userId: { meetingId: id, userId } },
            data: { reminderMinutes: minutes, lastRemindedKey: null },
        });

        res.json({ message: "Reminder updated", reminderMinutes: minutes });
    } catch (error) {
        console.error("[UPDATE_REMINDER]", error);
        res.status(500).json({ message: "Failed to update reminder", error: error.message });
    }
};

// Delete a meeting — creator or CRM admin only.
const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user;

        const meeting = await prisma.meeting.findUnique({ where: { id } });
        if (!meeting) return res.status(404).json({ message: "Meeting not found" });

        const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);
        if (meeting.createdById !== userId && !isAdmin) {
            return res.status(403).json({ message: "Only the creator or an admin can delete this meeting." });
        }

        await prisma.meeting.delete({ where: { id } });
        res.json({ message: "Meeting deleted" });
    } catch (error) {
        console.error("[DELETE_MEETING]", error);
        res.status(500).json({ message: "Failed to delete meeting", error: error.message });
    }
};

module.exports = { createMeeting, listMeetings, updateMyReminder, deleteMeeting };
