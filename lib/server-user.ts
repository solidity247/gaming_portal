import { prisma } from "@/lib/server-prisma";

export async function ensureInternalUser(userId: string) {
  return prisma.internalUser.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  });
}
