import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";

type FinishRequest = {
  gameId: number;
  winnerId?: string;
  finalBoardState?: unknown;
  actions?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as FinishRequest;
  const gameId = Number(payload.gameId);
  if (!Number.isInteger(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isParticipant = game.player1Id === userId || game.player2Id === userId;
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (game.status === "finished") {
    return NextResponse.json({ status: "already_finished", winnerId: game.winnerId });
  }

  const winnerId =
    payload.winnerId && [game.player1Id, game.player2Id].includes(payload.winnerId)
      ? payload.winnerId
      : null;

  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: game.id },
      data: {
        status: "finished",
        winnerId,
        finishedAt: new Date(),
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
        actions: payload.actions ?? "finish",
        dice: [],
      },
    });
  });

  return NextResponse.json({ status: "finished", winnerId });
}
