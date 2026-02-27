import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await ensureInternalUser(userId);
  let currentGameId = me.currentGameId;

  if (currentGameId) {
    const game = await prisma.game.findUnique({
      where: { id: currentGameId },
      select: { status: true },
    });

    if (!game || game.status === "finished") {
      await prisma.internalUser.update({
        where: { userId },
        data: { currentGameId: null },
      });
      currentGameId = null;
    }
  }

  return NextResponse.json({
    balance: me.balance,
    currentGameId,
  });
}
