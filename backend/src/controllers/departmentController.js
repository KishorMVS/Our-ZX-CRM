const prisma = require("../utils/prisma");

// Create Department — scoped to workspace
const createDepartment = async (req, res) => {
    try {
        const { name, c2c, hasLeadsAccess } = req.body;
        const workspaceId = req.user.workspaceId;

        if (!name) {
            return res.status(400).json({ message: "Department name is required" });
        }

        const existingDepartment = await prisma.department.findFirst({
            where: { name, workspaceId: workspaceId || null }
        });

        if (existingDepartment) {
            return res.status(400).json({ message: "Department already exists" });
        }

        // Leads access only makes sense for C2C departments — only C2C members
        // use leads and take calls. Force it off for non-C2C departments.
        const isC2C = Boolean(c2c);
        const leadsAccess = isC2C ? Boolean(hasLeadsAccess) : false;

        const department = await prisma.department.create({
            data: {
                name,
                workspaceId: workspaceId || null,
                c2c: isC2C,
                hasLeadsAccess: leadsAccess,
            }
        });

        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ message: "Error creating department", error: error.message });
    }
};

// Get All Departments — scoped to workspace
const getDepartments = async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;

        const departments = await prisma.department.findMany({
            where: workspaceId ? { workspaceId } : {},
            orderBy: { name: "asc" },
            include: {
                _count: { select: { users: true } }
            }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching departments", error: error.message });
    }
};

// Delete Department
const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspaceId;

        const department = await prisma.department.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}) },
            include: { _count: { select: { users: true } } }
        });

        if (!department) {
            return res.status(404).json({ message: "Department not found" });
        }

        if (department._count.users > 0) {
            return res.status(400).json({ message: "Cannot delete department with assigned users" });
        }

        await prisma.department.delete({ where: { id } });

        res.json({ message: "Department deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting department", error: error.message });
    }
};

// Get Single Department with Users
const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspaceId;

        const department = await prisma.department.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}) },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        jobTitle: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({ message: "Department not found" });
        }

        res.json(department);
    } catch (error) {
        res.status(500).json({ message: "Error fetching department", error: error.message });
    }
};

// Update Department — name, c2c flag, hasLeadsAccess flag
const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, c2c, hasLeadsAccess } = req.body;
        const workspaceId = req.user.workspaceId;

        const existing = await prisma.department.findFirst({
            where: { id, ...(workspaceId ? { workspaceId } : {}) },
        });
        if (!existing) return res.status(404).json({ message: "Department not found" });

        const data = {};
        if (name !== undefined) data.name = name;
        if (c2c !== undefined) data.c2c = Boolean(c2c);
        if (hasLeadsAccess !== undefined) data.hasLeadsAccess = Boolean(hasLeadsAccess);

        // Enforce invariant: leads access only valid for C2C departments.
        // Use the effective c2c value (new if provided, else existing).
        const effectiveC2C = c2c !== undefined ? Boolean(c2c) : existing.c2c;
        if (!effectiveC2C) data.hasLeadsAccess = false;

        const updated = await prisma.department.update({ where: { id }, data });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error updating department", error: error.message });
    }
};

module.exports = {
    createDepartment,
    getDepartments,
    getDepartmentById,
    deleteDepartment,
    updateDepartment,
};
