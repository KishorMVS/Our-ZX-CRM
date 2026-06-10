const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ 
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { email: true, role: true, name: true } 
})
    .then(u => console.log(JSON.stringify(u, null, 2)))
    .catch(e => console.error(e))
    .finally(() => p.$disconnect());
