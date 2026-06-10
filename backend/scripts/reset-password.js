const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();
async function main() {
    const email = "owner@zenxai.io";
    const password = "Platform@123";
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
    });
    console.log("Password reset for " + email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
