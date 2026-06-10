const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roles = ['SUPER_ADMIN', 'ADMIN'];
    const resources = ['leads', 'tasks', 'attendance', 'leaves', 'departments', 'users'];
    const actions = ['view', 'create', 'edit', 'delete'];

    console.log('Seeding permissions...');

    for (const role of roles) {
        for (const resource of resources) {
            for (const action of actions) {
                try {
                    await prisma.permission.upsert({
                        where: {
                            role_resource_action: {
                                role,
                                resource,
                                action
                            }
                        },
                        update: {},
                        create: {
                            role,
                            resource,
                            action
                        }
                    });
                } catch (e) {
                    // Ignore duplicates or errors
                }
            }
        }
    }

    console.log('Permissions seeded successfully.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
