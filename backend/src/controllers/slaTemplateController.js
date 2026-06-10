const prisma = require("../utils/prisma");
const fs = require("fs");
const path = require("path");

const uploadTemplate = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { name } = req.body;
        if (!req.file)     return res.status(400).json({ message: "No file uploaded" });
        if (!name?.trim()) return res.status(400).json({ message: "Template name is required" });

        const template = await prisma.sLATemplate.create({
            data: {
                name:        name.trim(),
                fileName:    req.file.originalname,
                filePath:    req.file.path,
                workspaceId: workspaceId || null,
            },
        });

        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: "Error uploading template", error: error.message });
    }
};

const getTemplates = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const templates = await prisma.sLATemplate.findMany({
            where:   workspaceId ? { workspaceId } : {},
            orderBy: { createdAt: "desc" },
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: "Error fetching templates", error: error.message });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const template = await prisma.sLATemplate.findFirst({
            where: {
                id: req.params.id,
                ...(workspaceId ? { workspaceId } : {}),
            },
        });
        if (!template) return res.status(404).json({ message: "Template not found" });

        if (fs.existsSync(template.filePath)) fs.unlinkSync(template.filePath);

        await prisma.sLATemplate.delete({ where: { id: req.params.id } });
        res.json({ message: "Template deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting template", error: error.message });
    }
};

const downloadTemplate = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const template = await prisma.sLATemplate.findFirst({
            where: {
                id: req.params.id,
                ...(workspaceId ? { workspaceId } : {}),
            },
        });
        if (!template) return res.status(404).json({ message: "Template not found" });
        if (!fs.existsSync(template.filePath))
            return res.status(404).json({ message: "File not found on server" });

        const downloadName = template.name.replace(/[^a-zA-Z0-9_-]/g, "_") + ".docx";
        res.download(path.resolve(template.filePath), downloadName);
    } catch (error) {
        res.status(500).json({ message: "Error downloading template", error: error.message });
    }
};

module.exports = { uploadTemplate, getTemplates, deleteTemplate, downloadTemplate };
