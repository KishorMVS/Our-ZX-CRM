const prisma = require("../utils/prisma");

const createReminder = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId, taskId, remindAt, message } = req.body;

        const reminder = await prisma.reminder.create({
            data: {
                userId, // Remind the creator? or passed userId? usually remind oneself
                leadId,
                taskId,
                remindAt: new Date(remindAt),
                message
            }
        });

        res.status(201).json(reminder);
    } catch (error) {
        res.status(500).json({ message: "Error creating reminder", error: error.message });
    }
};

const getMyReminders = async (req, res) => {
    try {
        const { userId } = req.user;
        const reminders = await prisma.reminder.findMany({
            where: { userId },
            orderBy: { remindAt: "asc" }
        });
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching reminders", error: error.message });
    }
};

const updateReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const { status, remindAt, message } = req.body;

        // Scope by owner so a user cannot edit another tenant's reminder (IDOR).
        const result = await prisma.reminder.updateMany({
            where: { id, userId },
            data: {
                status,
                remindAt: remindAt ? new Date(remindAt) : undefined,
                message
            }
        });

        if (result.count === 0) return res.status(404).json({ message: "Reminder not found" });

        const reminder = await prisma.reminder.findUnique({ where: { id } });
        res.json(reminder);
    } catch (error) {
        res.status(500).json({ message: "Error updating reminder", error: error.message });
    }
};

const deleteReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;

        // Scope by owner so a user cannot delete another tenant's reminder (IDOR).
        const result = await prisma.reminder.deleteMany({
            where: { id, userId }
        });

        if (result.count === 0) return res.status(404).json({ message: "Reminder not found" });
        res.json({ message: "Reminder deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting reminder", error: error.message });
    }
};

module.exports = { createReminder, getMyReminders, updateReminder, deleteReminder };
