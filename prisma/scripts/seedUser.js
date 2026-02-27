import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.internalUser.create({
    data: {
      userId: Math.random().toString(),
      balance: 100,
    },
  });

  console.log("✅ User created:", user);
}

main()
  .catch((e) => {
    console.error("❌ Error creating user:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
