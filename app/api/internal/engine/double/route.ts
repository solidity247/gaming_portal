import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";

type InternalDoubleRequest = {
  engineMatchId?: string;
  betIncrement?: number;
  newBetAmount?: number;
  expectedCurrentBet?: number;
};

function verifyInternalApiKey(request: Request): boolean {
  const configured = process.env.ENGINE_INTERNAL_API_KEY;
  if (!configured) return false;
  const provided = request.headers.get("x-internal-api-key");
  return Boolean(provided && provided === configured);
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function POST(request: Request) {
  if (!verifyInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as InternalDoubleRequest;
  const engineMatchId = payload.engineMatchId?.trim();
  const betIncrement = parsePositiveInt(payload.betIncrement);
  const newBetAmount = parsePositiveInt(payload.newBetAmount);
  const expectedCurrentBet = parsePositiveInt(payload.expectedCurrentBet);

  if (!engineMatchId) {
    return NextResponse.json({ error: "engineMatchId is required" }, { status: 400 });
  }
  if (!betIncrement || !newBetAmount) {
    return NextResponse.json({ error: "betIncrement and newBetAmount must be positive integers" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { engineMatchId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status === "finished") {
    return NextResponse.json({ error: "Game already finished" }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const debited = await tx.internalUser.updateMany({
        where: {
          userId: { in: [game.player1Id, game.player2Id] },
          balance: { gte: betIncrement },
        },
        data: {
          balance: { decrement: betIncrement },
        },
      });
      if (debited.count !== 2) {
        throw new Error("insufficient balance");
      }

      const updated = await tx.game.updateMany({
        where: {
          id: game.id,
          status: "in_progress",
          ...(expectedCurrentBet ? { currentBetAmount: expectedCurrentBet } : {}),
        },
        data: {
          currentBetAmount: newBetAmount,
          bankAmount: { increment: betIncrement * 2 },
        },
      });
      if (updated.count !== 1) {
        throw new Error("stale game bet state");
      }
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("insufficient")) {
      return NextResponse.json({ error: "Insufficient balance to accept double" }, { status: 409 });
    }
    return NextResponse.json({ error: "Double settlement failed", details: message }, { status: 409 });
  }

  const updatedGame = await prisma.game.findUnique({
    where: { id: game.id },
    select: { id: true, bankAmount: true, currentBetAmount: true },
  });

  return NextResponse.json({
    status: "ok",
    gameId: game.id,
    bankAmount: updatedGame?.bankAmount ?? null,
    currentBetAmount: updatedGame?.currentBetAmount ?? null,
  });
}
