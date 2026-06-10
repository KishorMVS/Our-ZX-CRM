const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { notifyIfLeaderboardWinner } = require("../services/notificationService");

const ZENVOICE_API_URL = process.env.ZENVOICE_API_URL || "https://voice.zenxai.io";

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { departmentRel: { select: { id: true, hasLeadsAccess: true, c2c: true } } }
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: "Access denied. User is inactive." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { onlineStatus: "ONLINE", breakStartedAt: null }
        });

        await prisma.userStatusLog.create({
            data: {
                userId: user.id,
                status: "ONLINE",
                note: "Automatically set to Online via Login"
            }
        });

        const roleName = user.role || "EMPLOYEE";

        const token = jwt.sign(
            // departmentId is carried so a department-scoped ADMIN can be confined to
            // their department without an extra DB lookup on every request.
            { userId: user.id, role: roleName, workspaceId: user.workspaceId, departmentId: user.departmentId },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: roleName,
                phone: user.phone,
                department: user.department,
                departmentId: user.departmentId,
                departmentHasLeadsAccess: user.departmentRel?.hasLeadsAccess ?? false,
                departmentIsC2C: user.departmentRel?.c2c ?? false,
                workspaceId: user.workspaceId,
                createdAt: user.createdAt,
                onlineStatus: "ONLINE",
                canCreateGroup: user.canCreateGroup ?? false
            }
        });

        notifyIfLeaderboardWinner(user.id).catch(err =>
            console.error("[Login] Leaderboard winner check failed:", err)
        );

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};

const registerCompany = async (req, res) => {
    try {
        const { companyName, adminName, adminEmail, adminPassword, adminPhone } = req.body;

        if (!companyName || !adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (adminPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        const baseSlug = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const slug = `${baseSlug}-${Date.now().toString(36)}`;

        const result = await prisma.$transaction(async (tx) => {
            const workspace = await tx.workspace.create({
                data: { name: companyName, slug }
            });

            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const user = await tx.user.create({
                data: {
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    role: "SUPER_ADMIN",
                    workspaceId: workspace.id,
                    isActive: true,
                    onlineStatus: "ONLINE"
                }
            });

            await tx.companySettings.create({
                data: {
                    workspaceId: workspace.id,
                    companyName,
                    shortName: baseSlug.toUpperCase().substring(0, 6),
                    defaultNotes: "",
                    voiceLinkToken: ""
                }
            });

            await tx.userStatusLog.create({
                data: { userId: user.id, status: "ONLINE", note: "Company registration" }
            });

            return { workspace, user };
        });

        // Register the Superadmin in Zenvoice (non-blocking — CRM registration still succeeds on failure)
        const nameParts = adminName.trim().split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || nameParts[0];
        try {
            const zenvoiceRes = await axios.post(`${ZENVOICE_API_URL}/api/v1/auth/signup`, {
                firstName,
                lastName,
                email: adminEmail,
                phone: adminPhone || "",
                password: adminPassword
            });
            const zenvoiceToken = zenvoiceRes.data?.data?.token;
            if (zenvoiceToken) {
                await prisma.companySettings.update({
                    where: { workspaceId: result.workspace.id },
                    data: { voiceLinkToken: zenvoiceToken }
                });
            }
        } catch (zenvoiceErr) {
            console.error("[Zenvoice] Signup failed for", adminEmail, ":", zenvoiceErr?.response?.data || zenvoiceErr.message);
        }

        const token = jwt.sign(
            { userId: result.user.id, role: "SUPER_ADMIN", workspaceId: result.workspace.id },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            message: "Company registered successfully",
            token,
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: "SUPER_ADMIN",
                profilePhoto: result.user.profilePhoto || null,
                workspaceId: result.workspace.id,
                onlineStatus: "ONLINE"
            },
            workspace: {
                id: result.workspace.id,
                name: result.workspace.name,
                slug: result.workspace.slug
            }
        });
    } catch (error) {
        console.error("Company registration error:", error);
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.userId;

        await prisma.user.update({
            where: { id: userId },
            data: { onlineStatus: "OFFLINE", breakStartedAt: null }
        });

        await prisma.userStatusLog.create({
            data: {
                userId: userId,
                status: "OFFLINE",
                note: "Automatically set to Offline via Logout"
            }
        });

        res.json({ message: "Logout successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Logout failed", error: error.message });
    }
};

const getZenvoiceToken = async (req, res) => {
    try {
        const { workspaceId } = req.user;

        const settings = await prisma.companySettings.findUnique({
            where: { workspaceId }
        });

        if (!settings || !settings.voiceLinkToken) {
            return res.json({ 
                token: null, 
                zenvoiceUrl: ZENVOICE_API_URL 
            });
        }

        return res.json({
            token: settings.voiceLinkToken,
            zenvoiceUrl: ZENVOICE_API_URL
        });
    } catch (error) {
        console.error("Error fetching Zenvoice token:", error);
        res.status(500).json({ message: "Failed to fetch SSO token" });
    }
};

module.exports = { login, registerCompany, logout, getZenvoiceToken };
