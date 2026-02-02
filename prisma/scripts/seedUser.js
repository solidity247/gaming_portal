import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(id) {
  // Example user data
  console.log(id);
  const user = await prisma.internalUser.create({
    data: {
      userId: Math.random().toString(), // <-- unique external ID (e.g., from Clerk)
      balance: 100.0, // starting balance
    },
  });

  console.log("✅ User created:", user);
}

main(777)
  .catch((e) => {
    console.error("❌ Error creating user:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// for (let i = 0; i < 60; i++) {
//   main(i);
// }
