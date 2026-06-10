require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────
const PLATFORM_OWNER = {
    name:     "ZenXAI Owner",
    email:    "owner@zenxai.io",
    password: "owner@123",
};

// ── Permissions ───────────────────────────────────────────────────────────────
// Permission model: { id, resource, action, role (Role enum) }
const RESOURCES = [
    "dashboard", "search-leads", "linkedin-leads", "kanban", "sprints",
    "leads", "team", "tasks", "campaigns", "call-logs", "reports",
    "leaderboard", "departments", "messages", "attendance", "leave",
    "invoices", "fasterq", "integrations", "settings",
];
const ACTIONS = ["view", "create", "edit", "delete"];

const ROLE_PERMISSIONS = {
    SUPER_ADMIN:    RESOURCES.flatMap(res => ACTIONS.map(act => ({ resource: res, action: act }))),
    ADMIN:          RESOURCES.flatMap(res => ACTIONS.map(act => ({ resource: res, action: act }))),
    TEAM_LEAD:      ["dashboard", "leads", "tasks", "attendance", "leave", "team", "reports"]
                        .flatMap(res => ACTIONS.map(act => ({ resource: res, action: act }))),
    EMPLOYEE:       ["dashboard", "leads", "tasks", "attendance", "leave"]
                        .flatMap(res => ["view", "create", "edit"].map(act => ({ resource: res, action: act }))),
    PLATFORM_OWNER: RESOURCES.map(res => ({ resource: res, action: "view" })),
};

async function seedPermissions() {
    console.log("Seeding permissions...");
    // Clear and re-seed all permissions for a clean slate
    await prisma.permission.deleteMany({});

    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        await prisma.permission.createMany({
            data: perms.map(p => ({ role, resource: p.resource, action: p.action })),
            skipDuplicates: true,
        });
        console.log(`  ✓ ${role} — ${perms.length} permissions`);
    }
}

async function seedPlatformOwner() {
    console.log("Seeding platform owner...");
    const hashed = await bcrypt.hash(PLATFORM_OWNER.password, 10);

    await prisma.user.upsert({
        where:  { email: PLATFORM_OWNER.email },
        update: { role: "PLATFORM_OWNER", isActive: true, password: hashed },
        create: {
            name:        PLATFORM_OWNER.name,
            email:       PLATFORM_OWNER.email,
            password:    hashed,
            role:        "PLATFORM_OWNER",
            isActive:    true,
            onlineStatus: "OFFLINE",
            // No workspaceId — PLATFORM_OWNER manages all workspaces
        },
    });

    console.log(`  ✓ ${PLATFORM_OWNER.email} / ${PLATFORM_OWNER.password}`);
}


async function main() {
    console.log("\n══ ZenXAI CRM — Database Seed ══\n");

    await seedPermissions();
    await seedPlatformOwner();

    console.log("\n══ Seed complete ══");
    console.log("\nPlatform Owner Login → /platform/login");
    console.log(`  Email:    ${PLATFORM_OWNER.email}`);
    console.log(`  Password: ${PLATFORM_OWNER.password}`);
    console.log("\nCompanies register themselves at → /register\n");
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
