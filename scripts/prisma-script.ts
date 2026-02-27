import { prisma } from "../lib/prisma";

async function main() {
  const userCount = await prisma.user.count();
  console.log(`Prisma connection OK. Users: ${userCount}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
