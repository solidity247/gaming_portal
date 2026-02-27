import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import {
  createEngineMatch,
  deleteEngineMatch,
  EngineHttpError,
  EngineMatchConfig,
} from "@/lib/server-engine";
import { ensureInternalUser } from "@/lib/server-user";

type AcceptPayload = {
  gameId?: number;
};

type ActiveGamePayload = {
  id: number;
  engineMatchId: string | null;
  player1Id: string;
  player2Id: string;
  currentUserId: string;
  gameType: string;
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
  currentBetAmount: number;
  bankAmount: number;
  payoutPercent: number;
};

function toActiveGamePayload(game: {
  id: number;
  engineMatchId: string | null;
  player1Id: string;
  player2Id: string;
  gameType: string;
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
  currentBetAmount: number;
  bankAmount: number;
  payoutPercent: number;
}, currentUserId: string): ActiveGamePayload {
  return {
    id: game.id,
    engineMatchId: game.engineMatchId,
    player1Id: game.player1Id,
    player2Id: game.player2Id,
    currentUserId,
    gameType: game.gameType,
    actionTimeMs: game.actionTimeMs,
    reserveTimeMs: game.reserveTimeMs,
    doubleDecisionTimeMs: game.doubleDecisionTimeMs,
    initialBetAmount: game.initialBetAmount,
    currentBetAmount: game.currentBetAmount,
    bankAmount: game.bankAmount,
    payoutPercent: game.payoutPercent,
  };
}

function toEngineConfig(game: {
  gameType: string;
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
  payoutPercent: number;
}): EngineMatchConfig {
  return {
    game_type: game.gameType,
    action_time_ms: game.actionTimeMs,
    reserve_time_ms: game.reserveTimeMs,
    double_decision_time_ms: game.doubleDecisionTimeMs,
    initial_bet_amount: game.initialBetAmount,
    current_bet_amount: game.initialBetAmount,
    bank_amount: game.initialBetAmount * 2,
    payout_percent: game.payoutPercent,
  };
}

async function ensureNoActiveGame(userId: string) {
  const user = await prisma.internalUser.findUnique({
    where: { userId },
    select: { currentGameId: true },
  });
  if (!user?.currentGameId) return;

  const current = await prisma.game.findUnique({
    where: { id: user.currentGameId },
    select: { status: true },
  });

  if (current && current.status !== "finished") {
    throw new Error(`active_game_exists:${userId}`);
  }

  await prisma.internalUser.update({
    where: { userId },
    data: { currentGameId: null },
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: AcceptPayload;
  try {
    payload = (await request.json()) as AcceptPayload;
  } catch {
    payload = {};
  }

  const gameId = Number(payload.gameId);
  if (!Number.isInteger(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      gameType: true,
      status: true,
      actionTimeMs: true,
      reserveTimeMs: true,
      doubleDecisionTimeMs: true,
      initialBetAmount: true,
      payoutPercent: true,
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isParticipant = game.player1Id === userId || game.player2Id === userId;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (game.status !== "finished") {
    return NextResponse.json(
      { error: "Game is not finished yet" },
      { status: 409 },
    );
  }

  const opponentUserId = game.player1Id === userId ? game.player2Id : game.player1Id;

  const offer = await prisma.gameRematchOffer.findUnique({ where: { gameId } });
  if (!offer || offer.status !== "pending") {
    return NextResponse.json({ error: "No pending rematch request" }, { status: 409 });
  }

  if (offer.responderUserId !== userId || offer.requesterUserId !== opponentUserId) {
    return NextResponse.json(
      { error: "Only requested opponent can accept rematch" },
      { status: 409 },
    );
  }

  await ensureInternalUser(userId);
  await ensureInternalUser(opponentUserId);

  try {
    await ensureNoActiveGame(userId);
    await ensureNoActiveGame(opponentUserId);
  } catch (error) {
    if ((error as Error).message.startsWith("active_game_exists:")) {
      return NextResponse.json(
        { error: "One of players already has an active game" },
        { status: 409 },
      );
    }
    throw error;
  }

  const balances = await prisma.internalUser.findMany({
    where: { userId: { in: [userId, opponentUserId] } },
    select: { userId: true, balance: true },
  });

  const byUser = new Map(balances.map((entry) => [entry.userId, entry.balance]));
  const bet = game.initialBetAmount;
  if ((byUser.get(userId) ?? 0) < bet || (byUser.get(opponentUserId) ?? 0) < bet) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        details: `Both players need at least ${bet} coins`,
      },
      { status: 409 },
    );
  }

  let engineMatchId: string;
  try {
    const engine = await createEngineMatch(game.player1Id, game.player2Id, toEngineConfig(game));
    engineMatchId = engine.match_id;
  } catch (error) {
    return NextResponse.json(
      { error: "Engine unavailable", details: (error as Error).message },
      { status: 503 },
    );
  }

  let createdGame;
  try {
    createdGame = await prisma.$transaction(async (tx) => {
      const accepted = await tx.gameRematchOffer.updateMany({
        where: {
          gameId: game.id,
          status: "pending",
          requesterUserId: opponentUserId,
          responderUserId: userId,
        },
        data: {
          status: "accepted",
        },
      });
      if (accepted.count !== 1) {
        throw new Error("rematch request no longer pending");
      }

      await tx.matchmakingQueue.deleteMany({
        where: { userId: { in: [userId, opponentUserId] } },
      });

      const debited = await tx.internalUser.updateMany({
        where: {
          userId: { in: [userId, opponentUserId] },
          balance: { gte: bet },
        },
        data: {
          balance: { decrement: bet },
        },
      });
      if (debited.count !== 2) {
        throw new Error("insufficient balance while creating rematch");
      }

      const created = await tx.game.create({
        data: {
          player1Id: game.player1Id,
          player2Id: game.player2Id,
          status: "in_progress",
          engineMatchId,
          gameType: game.gameType,
          actionTimeMs: game.actionTimeMs,
          reserveTimeMs: game.reserveTimeMs,
          doubleDecisionTimeMs: game.doubleDecisionTimeMs,
          initialBetAmount: bet,
          currentBetAmount: bet,
          bankAmount: bet * 2,
          payoutPercent: game.payoutPercent,
        },
      });

      const assigned = await tx.internalUser.updateMany({
        where: {
          userId: { in: [userId, opponentUserId] },
          currentGameId: null,
        },
        data: { currentGameId: created.id },
      });
      if (assigned.count !== 2) {
        throw new Error("players already have active game");
      }

      return created;
    });
  } catch (error) {
    try {
      await deleteEngineMatch(engineMatchId);
    } catch (cleanupError) {
      if (
        !(cleanupError instanceof EngineHttpError && cleanupError.status === 404)
      ) {
        console.error("failed to cleanup orphaned rematch engine match", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Unable to accept rematch", details: (error as Error).message },
      { status: 409 },
    );
  }

  return NextResponse.json({
    status: "matched",
    game: toActiveGamePayload(createdGame, userId),
  });
}
