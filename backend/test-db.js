// This script is for testing your backend database connection.
// You can run it with: node test-db.js
//
// Currently, your backend is configured with Render's internal database URL:
// DATABASE_URL="postgresql://...dpg-...-a.oregon-postgres.render.com/..."
//
// The suffix "-a" means it is an INTERNAL URL, accessible only from services running inside Render.
// If you run your server locally (on localhost:5001), you must use the EXTERNAL URL (without "-a").
//
// Additionally, check your Render dashboard to make sure the database is not suspended or blocked by IP whitelisting rules.

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

console.log("Using Database URL:", process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
    console.log("Attempting database connection...");
    const result = await prisma.user.findFirst();
    console.log("Successfully connected! First user:", result ? result.email : "none");
}

main()
    .catch(err => {
        console.error("Database connection error:", err);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
