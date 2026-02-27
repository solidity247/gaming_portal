import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";

type InternalFinishRequest = {
  engineMatchId?: string;
  winnerId?: string;
  finalBoardState?: unknown;
  actions?: string;
};

function verifyInternalApiKey(request: Request): boolean {
  const configured = process.env.ENGINE_INTERNAL_API_KEY;
  if (!configured) return false;
  const provided = request.headers.get("x-internal-api-key");
  return Boolean(provided && provided === configured);
}

export async function POST(request: Request) {
  if (!verifyInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as InternalFinishRequest;
  const engineMatchId = payload.engineMatchId?.trim();
  if (!engineMatchId) {
    return NextResponse.json({ error: "engineMatchId is required" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { engineMatchId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status === "finished") {
    const winnerBalance = game.winnerId
      ? (
          await prisma.internalUser.findUnique({
            where: { userId: game.winnerId },
            select: { balance: true },
          })
        )?.balance ?? null
      : null;
    return NextResponse.json({
      status: "already_finished",
      gameId: game.id,
      winnerId: game.winnerId,
      payoutAmount: game.payoutAmount ?? 0,
      winnerBalance,
    });
  }

  const winnerId =
    payload.winnerId && [game.player1Id, game.player2Id].includes(payload.winnerId)
      ? payload.winnerId
      : null;
  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const payoutAmount = Math.floor((game.bankAmount * game.payoutPercent) / 100);

  const finishResult = await prisma.$transaction(async (tx) => {
    const updated = await tx.game.updateMany({
      where: { id: game.id, status: { not: "finished" } },
      data: {
        status: "finished",
        winnerId,
        finishedAt: new Date(),
        payoutAmount,
      },
    });

    if (updated.count !== 1) {
      const existing = await tx.game.findUnique({
        where: { id: game.id },
        select: { winnerId: true, payoutAmount: true },
      });
      const winnerBalance = existing?.winnerId
        ? (
            await tx.internalUser.findUnique({
              where: { userId: existing.winnerId },
              select: { balance: true },
            })
          )?.balance ?? null
        : null;

      return {
        alreadyFinished: true as const,
        winnerId: existing?.winnerId ?? null,
        payoutAmount: existing?.payoutAmount ?? 0,
        winnerBalance,
      };
    }

    await tx.internalUser.update({
      where: { userId: winnerId },
      data: {
        balance: { increment: payoutAmount },
      },
    });

    await tx.internalUser.updateMany({
      where: { userId: { in: [game.player1Id, game.player2Id] } },
      data: { currentGameId: null },
    });

    await tx.roll.create({
      data: {
        gameId: game.id,
        boardStateBefore: "{}",
        boardStateAfter: JSON.stringify(payload.finalBoardState ?? {}),
        actions: payload.actions ?? "engine_finished",
        dice: [],
      },
    });

    const winner = await tx.internalUser.findUnique({
      where: { userId: winnerId },
      select: { balance: true },
    });

    return {
      alreadyFinished: false as const,
      winnerId,
      payoutAmount,
      winnerBalance: winner?.balance ?? null,
    };
  });

  if (finishResult.alreadyFinished) {
    return NextResponse.json({
      status: "already_finished",
      gameId: game.id,
      winnerId: finishResult.winnerId,
      payoutAmount: finishResult.payoutAmount,
      winnerBalance: finishResult.winnerBalance,
    });
  }

  return NextResponse.json({
    status: "finished",
    gameId: game.id,
    winnerId: finishResult.winnerId,
    payoutAmount: finishResult.payoutAmount,
    winnerBalance: finishResult.winnerBalance,
  });
}
