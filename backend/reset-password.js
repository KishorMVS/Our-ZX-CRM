const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@zenxai.io' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@zenxai.io',
      name: 'Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN'
    }
  });
  console.log('User updated:', user.email);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
