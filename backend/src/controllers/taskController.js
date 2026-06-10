const prisma = require("../utils/prisma");
const { createNotification } = require("../services/notificationService");
const { isDeptScopedAdmin } = require("../utils/workspaceScope");

const taskInclude = {
    lead: { select: { id: true, name: true, phone: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true, email: true, profilePhoto: true } },
    sprint: { select: { id: true, name: true, status: true } },
    files: true,
    comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" }
    }
};

// ─── Create Task ──────────────────────────────────────────────────────────────

const createTask = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        let {
            title, description, leadId, assignedTo, dueDate, files,
            priority = "MEDIUM", type = "TASK", storyPoints,
            estimatedHours, labels = [], sprintId, kanbanStatus
        } = req.body;

        if (!leadId || leadId === "") leadId = null;
        if (!sprintId || sprintId === "") sprintId = null;

        if (leadId) {
            const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
            if (!lead) return res.status(404).json({ message: "Lead not found" });
        }
        if (assignedTo) {
            const user = await prisma.user.findFirst({ where: { id: assignedTo, workspaceId } });
            if (!user) return res.status(404).json({ message: "Assigned user not found" });
        }

        let resolvedKanbanStatus = kanbanStatus || "BACKLOG";
        if (sprintId) {
            const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, workspaceId } });
            resolvedKanbanStatus = sprint?.status === "ACTIVE" ? "TODO" : "BACKLOG";
        } else if (!kanbanStatus) {
            resolvedKanbanStatus = "BACKLOG";
        }

        const newTask = await prisma.task.create({
            data: {
                title,
                description: description || null,
                leadId,
                assignedToId: assignedTo || null,
                dueDate: new Date(dueDate),
                status: "PENDING",
                kanbanStatus: resolvedKanbanStatus,
                priority,
                type,
                storyPoints: storyPoints ? parseInt(storyPoints) : null,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
                labels: Array.isArray(labels) ? labels : [],
                sprintId,
                workspaceId,
                createdById: req.user.userId || null,
                files: {
                    create: (files || []).map(f => ({
                        fileName: f.fileName, fileUrl: f.fileUrl,
                        fileSize: f.fileSize, mimeType: f.mimeType
                    }))
                }
            },
            include: taskInclude
        });

        res.status(201).json({ message: "Task created successfully", task: newTask });

        const due = new Date(dueDate).toLocaleString("en-IN", {
            dateStyle: "medium", timeZone: "Asia/Kolkata"
        });
        createNotification({
            userId:  assignedTo,
            title:   "📋 New Task Assigned",
            message: `You have been assigned a new task: "${title}". Due date: ${due}.`,
            type:    "TASK_ASSIGNED",
            link:    `/tasks/${newTask.id}`
        }).catch(err => console.error("[Notification] TASK_ASSIGNED failed:", err));
    } catch (error) {
        console.error("CREATE_TASK_ERROR:", error);
        res.status(500).json({ message: "Error creating task", error: error.message });
    }
};

// ─── Get Tasks ────────────────────────────────────────────────────────────────

const getTasks = async (req, res) => {
    try {
        const { userId, role, workspaceId } = req.user;
        const where = {
            workspaceId,
            ...(["EMPLOYEE", "AGENT"].includes(role) ? { assignedToId: userId } : {}),
            // A department-scoped admin sees tasks owned by their department's members,
            // plus unassigned tasks (the backlog they still need to triage).
            ...(isDeptScopedAdmin(req.user)
                ? { OR: [{ assignedTo: { departmentId: req.user.departmentId } }, { assignedToId: null }] }
                : {})
        };

        const tasks = await prisma.task.findMany({
            where,
            include: taskInclude,
            orderBy: [{ dueDate: "asc" }]
        });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Error fetching tasks", error: error.message });
    }
};

// ─── Get Task By ID ───────────────────────────────────────────────────────────

const getTaskById = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const task = await prisma.task.findFirst({
            where: { id: req.params.id, workspaceId },
            include: taskInclude
        });
        if (!task) return res.status(404).json({ message: "Task not found" });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Error fetching task", error: error.message });
    }
};

// ─── Update Task (full) ───────────────────────────────────────────────────────

const updateTask = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;

        const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        const {
            title, description, assignedTo, dueDate, priority, type,
            storyPoints, estimatedHours, actualHours, labels, sprintId, leadId
        } = req.body;

        const task = await prisma.task.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(assignedTo !== undefined && { assignedToId: assignedTo || null }),
                ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
                ...(priority !== undefined && { priority }),
                ...(type !== undefined && { type }),
                ...(storyPoints !== undefined && { storyPoints: storyPoints ? parseInt(storyPoints) : null }),
                ...(estimatedHours !== undefined && { estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null }),
                ...(actualHours !== undefined && { actualHours: actualHours ? parseFloat(actualHours) : null }),
                ...(labels !== undefined && { labels }),
                ...(sprintId !== undefined && { sprintId: sprintId || null }),
                ...(leadId !== undefined && { leadId: leadId || null })
            },
            include: taskInclude
        });
        res.json({ message: "Task updated", task });
    } catch (error) {
        res.status(500).json({ message: "Error updating task", error: error.message });
    }
};

// ─── Update Status (legacy + kanban) ─────────────────────────────────────────

const updateTaskStatus = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { status } = req.body;

        if (!["PENDING", "COMPLETED"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        const updateData = {
            status,
            kanbanStatus: status === "COMPLETED" ? "DONE" : "TODO",
            completedAt: status === "COMPLETED" ? new Date() : null
        };

        const updatedTask = await prisma.task.update({
            where: { id },
            data: updateData,
            include: { assignedTo: { select: { id: true } } }
        });

        res.json({ message: "Task status updated", task: updatedTask });

        if (status === "COMPLETED" && updatedTask.assignedTo?.id) {
            const admins = await prisma.user.findMany({
                where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true, workspaceId },
                select: { id: true }
            });
            const assigneeId = updatedTask.assignedTo.id;
            for (const admin of admins) {
                if (admin.id === assigneeId) continue;
                createNotification({
                    userId:  admin.id,
                    title:   "✅ Task Completed",
                    message: `The task "${updatedTask.title}" has been marked as completed.`,
                    type:    "TASK_COMPLETED",
                    link:    `/tasks/${id}`
                }).catch(err => console.error("[Notification] TASK_COMPLETED failed:", err));
            }
        }
    } catch (error) {
        res.status(500).json({ message: "Error updating task", error: error.message });
    }
};

// ─── Update Kanban Status (drag & drop) ──────────────────────────────────────

const updateKanbanStatus = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { kanbanStatus, orderIndex } = req.body;

        const validStatuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
        if (!validStatuses.includes(kanbanStatus)) {
            return res.status(400).json({ message: "Invalid kanban status" });
        }

        const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        const task = await prisma.task.update({
            where: { id },
            data: {
                kanbanStatus,
                ...(orderIndex !== undefined && { orderIndex }),
                status: kanbanStatus === "DONE" ? "COMPLETED" : "PENDING",
                completedAt: kanbanStatus === "DONE" ? new Date() : null
            },
            include: taskInclude
        });
        res.json({ message: "Kanban status updated", task });
    } catch (error) {
        res.status(500).json({ message: "Error updating kanban status", error: error.message });
    }
};

// ─── Delete Task ──────────────────────────────────────────────────────────────

const deleteTask = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const existing = await prisma.task.findFirst({ where: { id: req.params.id, workspaceId } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        await prisma.task.delete({ where: { id: req.params.id } });
        res.json({ message: "Task deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting task", error: error.message });
    }
};

// ─── Comments ─────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { userId } = req.user;
        const { content } = req.body;

        if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

        const task = await prisma.task.findFirst({ where: { id, workspaceId } });
        if (!task) return res.status(404).json({ message: "Task not found" });

        const comment = await prisma.taskComment.create({
            data: { taskId: id, userId, content: content.trim() },
            include: { user: { select: { id: true, name: true } } }
        });
        res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
};

const getComments = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const task = await prisma.task.findFirst({ where: { id: req.params.id, workspaceId } });
        if (!task) return res.status(404).json({ message: "Task not found" });

        const comments = await prisma.taskComment.findMany({
            where: { taskId: req.params.id },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" }
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { commentId } = req.params;
        const { userId, role } = req.user;

        const comment = await prisma.taskComment.findUnique({
            where: { id: commentId },
            include: { task: { select: { workspaceId: true } } }
        });
        if (!comment) return res.status(404).json({ message: "Comment not found" });
        if (comment.task.workspaceId !== workspaceId) return res.status(404).json({ message: "Comment not found" });
        if (comment.userId !== userId && !["SUPER_ADMIN", "ADMIN"].includes(role)) {
            return res.status(403).json({ message: "Not authorized to delete this comment" });
        }

        await prisma.taskComment.delete({ where: { id: commentId } });
        res.json({ message: "Comment deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting comment", error: error.message });
    }
};

// ─── Time Extension Request ───────────────────────────────────────────────────

const requestExtension = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { userId } = req.user;
        const { requestedDays, reason } = req.body;

        if (!requestedDays || parseInt(requestedDays) < 1) {
            return res.status(400).json({ message: "requestedDays must be at least 1" });
        }

        const task = await prisma.task.findFirst({
            where: { id, workspaceId },
            include: { assignedTo: { select: { id: true, name: true } } }
        });
        if (!task) return res.status(404).json({ message: "Task not found" });

        const requester = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });

        const commentContent =
            `[EXTENSION_REQUEST] ${requester?.name || "User"} requested +${requestedDays} day(s). ` +
            (reason ? `Reason: ${reason}` : "No reason provided.");

        const comment = await prisma.taskComment.create({
            data: { taskId: id, userId, content: commentContent },
            include: { user: { select: { id: true, name: true } } }
        });

        const admins = await prisma.user.findMany({
            where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true, workspaceId },
            select: { id: true }
        });

        await Promise.all(
            admins.map((a) =>
                createNotification({
                    userId: a.id,
                    title: "⏳ Time Extension Requested",
                    message: `"${task.title}" — ${requester?.name || "Someone"} requests +${requestedDays} day(s). ${reason || ""}`,
                    type: "TIME_EXTENSION",
                    link: `/tasks/${id}`
                }).catch(() => {})
            )
        );

        res.status(201).json({ message: "Extension request submitted", comment });
    } catch (error) {
        res.status(500).json({ message: "Error submitting extension request", error: error.message });
    }
};

const approveExtension = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { userId, role } = req.user;
        const { newDueDate } = req.body;

        if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
            return res.status(403).json({ message: "Only admins can approve time extensions" });
        }
        if (!newDueDate) {
            return res.status(400).json({ message: "newDueDate is required" });
        }

        const task = await prisma.task.findFirst({
            where: { id, workspaceId },
            select: { id: true, title: true, assignedToId: true }
        });
        if (!task) return res.status(404).json({ message: "Task not found" });

        const approver = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });

        const updatedTask = await prisma.task.update({
            where: { id },
            data: { dueDate: new Date(newDueDate) },
            include: taskInclude
        });

        await prisma.taskComment.create({
            data: {
                taskId: id,
                userId,
                content: `[EXTENSION_APPROVED] ${approver?.name || "Admin"} approved the extension. New due date: ${new Date(newDueDate).toLocaleDateString("en-IN")}.`
            }
        });

        if (task.assignedToId) {
            await createNotification({
                userId: task.assignedToId,
                title: "✅ Time Extension Approved",
                message: `Your extension request for "${task.title}" was approved. New due date: ${new Date(newDueDate).toLocaleDateString("en-IN")}.`,
                type: "TIME_EXTENSION",
                link: `/tasks/${id}`
            }).catch(() => {});
        }

        res.json({ message: "Extension approved", task: updatedTask });
    } catch (error) {
        res.status(500).json({ message: "Error approving extension", error: error.message });
    }
};

module.exports = {
    createTask, getTasks, getTaskById,
    updateTask, updateTaskStatus, updateKanbanStatus,
    deleteTask, addComment, getComments, deleteComment,
    requestExtension, approveExtension
};
