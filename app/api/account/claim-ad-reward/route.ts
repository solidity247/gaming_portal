import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

const AD_REWARD_COINS = 100;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureInternalUser(userId);

  const updated = await prisma.internalUser.update({
    where: { userId },
    data: {
      balance: { increment: AD_REWARD_COINS },
    },
    select: { balance: true },
  });

  return NextResponse.json({
    status: "claimed",
    credited: AD_REWARD_COINS,
    balance: updated.balance,
  });
}
