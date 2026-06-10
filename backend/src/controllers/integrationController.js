const prisma = require("../utils/prisma");

const DEFAULT_PLATFORMS = [
    "META_ADS",
    "GOOGLE_ADS",
    "GMAIL",
    "GOOGLE_SHEETS",
    "WEB_FORM",
    "WEBHOOK",
];

const getIntegrations = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace associated with your account" });

        for (const platform of DEFAULT_PLATFORMS) {
            await prisma.integration.upsert({
                where: { workspaceId_platform: { workspaceId, platform } },
                create: { workspaceId, platform, isConnected: false, isActive: false },
                update: {},
            });
        }

        const integrations = await prisma.integration.findMany({ where: { workspaceId } });
        res.json(integrations);
    } catch (error) {
        res.status(500).json({ message: "Error fetching integrations", error: error.message });
    }
};

const toggleIntegration = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;

        const integration = await prisma.integration.findFirst({ where: { id, workspaceId } });
        if (!integration) return res.status(404).json({ message: "Integration not found" });

        const updated = await prisma.integration.update({
            where: { id },
            data: {
                isConnected: !integration.isConnected,
                lastSynced: !integration.isConnected ? new Date() : integration.lastSynced,
            },
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error toggling integration", error: error.message });
    }
};

const updateIntegrationConfig = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id } = req.params;
        const { config } = req.body;

        const integration = await prisma.integration.findFirst({ where: { id, workspaceId } });
        if (!integration) return res.status(404).json({ message: "Integration not found" });

        const updated = await prisma.integration.update({ where: { id }, data: { config } });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error updating integration config", error: error.message });
    }
};

module.exports = { getIntegrations, toggleIntegration, updateIntegrationConfig };
