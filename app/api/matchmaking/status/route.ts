import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await ensureInternalUser(userId);

  if (!me.currentGameId) {
    const queueItem = await prisma.matchmakingQueue.findUnique({ where: { userId } });
    return NextResponse.json({
      status: queueItem ? "waiting" : "idle",
      balance: me.balance,
      config: queueItem
        ? {
            gameType: queueItem.gameType,
            actionTimeMs: queueItem.actionTimeMs,
            reserveTimeMs: queueItem.reserveTimeMs,
            doubleDecisionTimeMs: queueItem.doubleDecisionTimeMs,
            initialBetAmount: queueItem.initialBetAmount,
          }
        : null,
    });
  }

  const game = await prisma.game.findUnique({ where: { id: me.currentGameId } });
  if (!game || game.status === "finished") {
    await prisma.internalUser.update({ where: { userId }, data: { currentGameId: null } });
    return NextResponse.json({ status: "idle", balance: me.balance });
  }

  return NextResponse.json({
    status: "matched",
    balance: me.balance,
    game: {
      id: game.id,
      engineMatchId: game.engineMatchId,
      player1Id: game.player1Id,
      player2Id: game.player2Id,
      currentUserId: userId,
      gameType: game.gameType,
      actionTimeMs: game.actionTimeMs,
      reserveTimeMs: game.reserveTimeMs,
      doubleDecisionTimeMs: game.doubleDecisionTimeMs,
      initialBetAmount: game.initialBetAmount,
      currentBetAmount: game.currentBetAmount,
      bankAmount: game.bankAmount,
      payoutPercent: game.payoutPercent,
    },
  });
}
