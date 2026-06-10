const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { addC2CUser, updateC2CUser, removeC2CUser, getC2CQuota } = require("../services/telecmiService");
const { isDeptScopedAdmin } = require("../utils/workspaceScope");

// Create User (Super Admin or Admin only, scoped to their workspace)
const createUser = async (req, res) => {
    try {
        const { name, email, phone, role: roleName, department, password, jobTitle,
                canCreateGroup } = req.body;
        const workspaceId = req.user.workspaceId;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        if (roleName === "ADMIN" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can create Admins" });
        }

        if (roleName === "SUPER_ADMIN") {
            return res.status(403).json({ message: "Cannot create another Super Admin" });
        }

        // The platform owner is a single, seeded account — it can never be created via the team API.
        if (roleName === "PLATFORM_OWNER") {
            return res.status(403).json({ message: "Cannot create a Platform Owner" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // A department-scoped admin can only create users inside their own
        // department — ignore any other department they may have submitted.
        let effectiveDepartment = department;
        if (isDeptScopedAdmin(req.user)) {
            const ownDept = await prisma.department.findFirst({
                where: { id: req.user.departmentId, workspaceId },
                select: { name: true },
            });
            effectiveDepartment = ownDept?.name ?? effectiveDepartment;
        }

        // Find department scoped to this workspace
        let departmentId = undefined;
        let isC2C = false;
        if (effectiveDepartment) {
            const deptRecord = await prisma.department.findFirst({
                where: { name: effectiveDepartment, workspaceId },
                select: { id: true, c2c: true }
            });
            if (deptRecord) {
                departmentId = deptRecord.id;
                isC2C = deptRecord.c2c;
            }
        }

        // Enforce the workspace's C2C user quota before creating a C2C user
        if (isC2C) {
            const quota = await getC2CQuota(workspaceId);
            if (!quota.hasActive) {
                return res.status(400).json({ message: "C2C is not active for this workspace. Activate ZX Call first." });
            }
            if (quota.remaining <= 0) {
                return res.status(400).json({
                    message: `C2C user limit reached (${quota.used}/${quota.limit}). Cannot add more C2C users.`,
                });
            }
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role: roleName || "EMPLOYEE",
                department: effectiveDepartment,
                departmentId,
                jobTitle,
                isActive: true,
                workspaceId,
                isC2C,
                // Group creation is only meaningful for a TEAM_LEAD and may only be
                // granted by an Admin / Super Admin (admins implicitly have it anyway).
                canCreateGroup: roleName === "TEAM_LEAD" ? !!canCreateGroup : false,
            }
        });

        // Provision a TeleCMI click-to-call account for c2c-department users
        let c2cWarning;
        if (isC2C) {
            try {
                const { extension, agentId } = await addC2CUser({
                    workspaceId, name, email, phone, password,
                });
                await prisma.user.update({
                    where: { id: newUser.id },
                    data: { telecmiUserId: extension, telecmiAgentId: agentId },
                });
                newUser.telecmiUserId = extension;
                newUser.telecmiAgentId = agentId;
            } catch (err) {
                console.error("[TeleCMI] addC2CUser failed:", err.message);
                c2cWarning = `User created, but C2C provisioning failed: ${err.message}`;
            }
        }

        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({
            message: c2cWarning || "User created successfully",
            warning: c2cWarning,
            user: userWithoutPassword,
        });
    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};

// Get Team — only users in the same workspace
const getTeam = async (req, res) => {
    try {
        const { workspaceId, userId, role } = req.user;

        const where = workspaceId ? { workspaceId } : {};

        // A department-scoped admin only sees members of their own department.
        if (isDeptScopedAdmin(req.user)) {
            where.departmentId = req.user.departmentId;
        }

        // Team leads only see members of their own department.
        if (role === "TEAM_LEAD") {
            const me = await prisma.user.findUnique({
                where: { id: userId },
                select: { departmentId: true },
            });
            // Confine to their department; if unassigned, they see only themselves.
            if (me?.departmentId) where.departmentId = me.departmentId;
            else where.id = userId;
        }

        const team = await prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { assignedLeads: true }
                }
            }
        });

        const formattedTeam = team.map(user => {
            const { password, ...rest } = user;
            return {
                ...rest,
                leadCount: user._count.assignedLeads
            };
        });

        res.json(formattedTeam);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team", error: error.message });
    }
};

// Toggle User Access
const toggleUserAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspaceId;

        const user = await prisma.user.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}), ...(isDeptScopedAdmin(req.user) ? { departmentId: req.user.departmentId } : {}) }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: { id: true, isActive: true }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error toggling user access", error: error.message });
    }
};

// Update User
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, role: roleName, department, jobTitle,
                canCreateGroup } = req.body;
        const workspaceId = req.user.workspaceId;

        const existing = await prisma.user.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}), ...(isDeptScopedAdmin(req.user) ? { departmentId: req.user.departmentId } : {}) }
        });
        if (!existing) return res.status(404).json({ message: "User not found" });

        // Privileged roles cannot be assigned via the team API (single seeded platform owner;
        // super admins are created only at company registration).
        if (roleName === "PLATFORM_OWNER" || roleName === "SUPER_ADMIN") {
            return res.status(403).json({ message: `Cannot assign ${roleName} role` });
        }

        // Only super admins may grant the ADMIN role (mirrors createUser).
        if (roleName === "ADMIN" && existing.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can promote a user to Admin" });
        }

        // A department-scoped admin cannot move a user into another department.
        let effectiveDepartment = department;
        if (department !== undefined && isDeptScopedAdmin(req.user)) {
            const ownDept = await prisma.department.findFirst({
                where: { id: req.user.departmentId, workspaceId },
                select: { name: true },
            });
            effectiveDepartment = ownDept?.name ?? effectiveDepartment;
        }

        const departmentProvided = effectiveDepartment !== undefined;
        let departmentId = undefined;
        let newIsC2C = false;
        if (departmentProvided && effectiveDepartment) {
            const deptRecord = await prisma.department.findFirst({
                where: { name: effectiveDepartment, workspaceId },
                select: { id: true, c2c: true }
            });
            if (deptRecord) {
                departmentId = deptRecord.id;
                newIsC2C = deptRecord.c2c;
            }
        }

        const updateData = { name, phone, department: effectiveDepartment, departmentId, jobTitle };
        if (roleName) updateData.role = roleName;

        // Group-creation grant: only meaningful for a TEAM_LEAD. If the effective role
        // is TEAM_LEAD, apply an explicitly-supplied flag; if the user is being moved
        // off TEAM_LEAD, clear it so a former lead doesn't retain the grant.
        const effectiveRole = roleName || existing.role;
        if (effectiveRole === "TEAM_LEAD") {
            if (canCreateGroup !== undefined) updateData.canCreateGroup = !!canCreateGroup;
        } else {
            updateData.canCreateGroup = false;
        }

        let c2cWarning, c2cPassword;

        // Only touch C2C provisioning when the department is part of this update
        if (departmentProvided) {
            const wasC2C = existing.isC2C;

            if (!wasC2C && newIsC2C) {
                // Moving INTO a C2C department → provision a TeleCMI agent
                const quota = await getC2CQuota(workspaceId);
                if (!quota.hasActive) {
                    return res.status(400).json({ message: "C2C is not active for this workspace. Activate ZX Call first." });
                }
                if (quota.remaining <= 0) {
                    return res.status(400).json({ message: `C2C user limit reached (${quota.used}/${quota.limit}). Cannot add more C2C users.` });
                }
                c2cPassword = crypto.randomBytes(6).toString("hex"); // 12 chars, ≥8
                try {
                    const { extension, agentId } = await addC2CUser({
                        workspaceId,
                        name: name || existing.name,
                        email: existing.email,
                        phone: phone || existing.phone,
                        password: c2cPassword,
                    });
                    updateData.isC2C = true;
                    updateData.telecmiUserId = extension;
                    updateData.telecmiAgentId = agentId;
                } catch (err) {
                    console.error("[TeleCMI] provision on update failed:", err.message);
                    updateData.isC2C = true;
                    c2cWarning = `Department updated, but C2C provisioning failed: ${err.message}`;
                    c2cPassword = undefined;
                }
            } else if (wasC2C && !newIsC2C) {
                // Moving OUT of a C2C department → de-provision and free the slot
                await removeC2CUser({ workspaceId: existing.workspaceId, extension: existing.telecmiUserId });
                updateData.isC2C = false;
                updateData.telecmiUserId = null;
                updateData.telecmiAgentId = null;
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        // Sync phone/name changes to TeleCMI for active C2C users
        if (updatedUser.isC2C && updatedUser.telecmiAgentId && (phone !== undefined || name !== undefined)) {
            updateC2CUser({
                workspaceId,
                agentId: updatedUser.telecmiAgentId,
                phone: phone || undefined,
                name: name || undefined,
            });
        }

        const { password, ...rest } = updatedUser;
        res.json({ ...rest, ...(c2cWarning ? { warning: c2cWarning } : {}), ...(c2cPassword ? { c2cPassword } : {}) });
    } catch (error) {
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
};

// Toggle C2C access for a user — SUPER_ADMIN only
const toggleC2C = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspaceId;

        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can manage C2C access." });
        }

        const user = await prisma.user.findFirst({
            where: { id, workspaceId },
        });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.isC2C) {
            // Enable C2C
            const quota = await getC2CQuota(workspaceId);
            if (!quota.hasActive) {
                return res.status(400).json({ message: "ZX Call is not active for this workspace." });
            }
            if (quota.remaining <= 0) {
                return res.status(400).json({
                    message: `C2C seat limit reached (${quota.used}/${quota.limit}).`,
                });
            }

            const tempPassword = require("crypto").randomBytes(6).toString("hex");
            try {
                const { extension, agentId } = await addC2CUser({
                    workspaceId,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    password: tempPassword,
                });
                await prisma.user.update({
                    where: { id },
                    data: { isC2C: true, telecmiUserId: extension, telecmiAgentId: agentId },
                });
                return res.json({
                    message: "C2C access granted",
                    isC2C: true,
                    telecmiUserId: extension,
                    telecmiAgentId: agentId,
                    tempPassword,
                });
            } catch (err) {
                return res.status(500).json({ message: `C2C provisioning failed: ${err.message}` });
            }
        } else {
            // Disable C2C
            await removeC2CUser({ workspaceId, extension: user.telecmiUserId });
            await prisma.user.update({
                where: { id },
                data: { isC2C: false, telecmiUserId: null, telecmiAgentId: null },
            });
            return res.json({ message: "C2C access revoked", isC2C: false });
        }
    } catch (error) {
        res.status(500).json({ message: "Error toggling C2C access", error: error.message });
    }
};

// Hard Delete User
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspaceId;

        const user = await prisma.user.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}), ...(isDeptScopedAdmin(req.user) ? { departmentId: req.user.departmentId } : {}) }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Remove the TeleCMI agent so the seat is fully released
        if (user.isC2C && user.telecmiUserId) {
            await removeC2CUser({ workspaceId: user.workspaceId, extension: user.telecmiUserId });
        }

        await prisma.user.delete({ where: { id } });

        res.json({ message: "User permanently deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
};

module.exports = {
    getTeam,
    createUser,
    toggleUserAccess,
    updateUser,
    deleteUser,
    toggleC2C,
};
