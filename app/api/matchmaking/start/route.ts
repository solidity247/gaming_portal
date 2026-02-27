import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server-prisma";
import {
  createEngineMatch,
  deleteEngineMatch,
  EngineHttpError,
  EngineMatchConfig,
} from "@/lib/server-engine";
import { ensureInternalUser } from "@/lib/server-user";

type MatchConfig = {
  gameType: "bg";
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
  payoutPercent: number;
};

type ActiveGamePayload = {
  id: number;
  engineMatchId: string | null;
  player1Id: string;
  player2Id: string;
  currentUserId?: string;
  gameType: string;
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
  currentBetAmount: number;
  bankAmount: number;
  payoutPercent: number;
};

type StartPayload = {
  gameType?: string;
  actionTimeMs?: number;
  reserveTimeMs?: number;
  doubleDecisionTimeMs?: number;
  initialBetAmount?: number;
};

const DEFAULT_ACTION_TIME_MS = 10_000;
const DEFAULT_RESERVE_TIME_MS = 45_000;
const DEFAULT_DOUBLE_DECISION_TIME_MS = 10_000;
const DEFAULT_INITIAL_BET_AMOUNT = 10;
const DEFAULT_PAYOUT_PERCENT = 80;

function boundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeConfig(payload: StartPayload | null | undefined): MatchConfig {
  const gameType = payload?.gameType === "bg" ? "bg" : "bg";
  const actionTimeMs = boundedInt(payload?.actionTimeMs, DEFAULT_ACTION_TIME_MS, 3_000, 60_000);
  const reserveTimeMs = boundedInt(payload?.reserveTimeMs, DEFAULT_RESERVE_TIME_MS, 10_000, 300_000);
  const doubleDecisionTimeMs = boundedInt(
    payload?.doubleDecisionTimeMs,
    DEFAULT_DOUBLE_DECISION_TIME_MS,
    3_000,
    30_000,
  );
  const initialBetAmount = boundedInt(payload?.initialBetAmount, DEFAULT_INITIAL_BET_AMOUNT, 1, 1_000_000);

  return {
    gameType,
    actionTimeMs,
    reserveTimeMs,
    doubleDecisionTimeMs,
    initialBetAmount,
    payoutPercent: DEFAULT_PAYOUT_PERCENT,
  };
}

function toEngineConfig(config: MatchConfig): EngineMatchConfig {
  return {
    game_type: config.gameType,
    action_time_ms: config.actionTimeMs,
    reserve_time_ms: config.reserveTimeMs,
    double_decision_time_ms: config.doubleDecisionTimeMs,
    initial_bet_amount: config.initialBetAmount,
    current_bet_amount: config.initialBetAmount,
    bank_amount: config.initialBetAmount * 2,
    payout_percent: config.payoutPercent,
  };
}

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
}, currentUserId?: string): ActiveGamePayload {
  return {
    id: game.id,
    engineMatchId: game.engineMatchId,
    player1Id: game.player1Id,
    player2Id: game.player2Id,
    ...(currentUserId ? { currentUserId } : {}),
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

async function popOpponent(userId: string, config: MatchConfig) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const opponentQueueItem = await prisma.matchmakingQueue.findFirst({
      where: {
        NOT: { userId },
        gameType: config.gameType,
        actionTimeMs: config.actionTimeMs,
        reserveTimeMs: config.reserveTimeMs,
        doubleDecisionTimeMs: config.doubleDecisionTimeMs,
        initialBetAmount: config.initialBetAmount,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!opponentQueueItem) return null;

    const deleted = await prisma.matchmakingQueue.deleteMany({ where: { id: opponentQueueItem.id } });
    if (deleted.count !== 1) continue;

    const opponentUser = await prisma.internalUser.findUnique({
      where: { userId: opponentQueueItem.userId },
      select: { userId: true, balance: true, currentGameId: true },
    });
    if (!opponentUser) continue;
    if (opponentUser.currentGameId) {
      const activeGame = await prisma.game.findUnique({
        where: { id: opponentUser.currentGameId },
        select: { status: true },
      });
      if (activeGame && activeGame.status !== "finished") {
        continue;
      }
      await prisma.internalUser.update({
        where: { userId: opponentUser.userId },
        data: { currentGameId: null },
      });
    }
    if (opponentUser.balance < config.initialBetAmount) {
      continue;
    }

    return opponentUser.userId;
  }

  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: StartPayload | undefined;
  try {
    payload = (await request.json()) as StartPayload;
  } catch {
    payload = undefined;
  }
  const config = normalizeConfig(payload);

  await ensureInternalUser(userId);

  const me = await prisma.internalUser.findUnique({ where: { userId } });
  if (!me) return NextResponse.json({ error: "User unavailable" }, { status: 500 });
  if (me.balance < config.initialBetAmount) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        details: `Need at least ${config.initialBetAmount} coins`,
      },
      { status: 400 },
    );
  }

  if (me.currentGameId) {
    const current = await prisma.game.findUnique({ where: { id: me.currentGameId } });
    if (current && current.status !== "finished") {
      return NextResponse.json(
        {
          error: "Active game already in progress",
          code: "ACTIVE_GAME_EXISTS",
          game: toActiveGamePayload(current, userId),
        },
        { status: 409 },
      );
    }

    await prisma.internalUser.update({
      where: { userId },
      data: { currentGameId: null },
    });
  }

  const existingQueueItem = await prisma.matchmakingQueue.findUnique({
    where: { userId },
  });
  if (existingQueueItem) {
    return NextResponse.json(
      {
        error: "Matchmaking already in progress",
        code: "MATCHMAKING_ALREADY_ACTIVE",
        config: {
          gameType: existingQueueItem.gameType,
          actionTimeMs: existingQueueItem.actionTimeMs,
          reserveTimeMs: existingQueueItem.reserveTimeMs,
          doubleDecisionTimeMs: existingQueueItem.doubleDecisionTimeMs,
          initialBetAmount: existingQueueItem.initialBetAmount,
          payoutPercent: DEFAULT_PAYOUT_PERCENT,
        },
      },
      { status: 409 },
    );
  }

  const opponentId = await popOpponent(userId, config);
  if (!opponentId) {
    try {
      await prisma.matchmakingQueue.create({
        data: {
          userId,
          gameType: config.gameType,
          actionTimeMs: config.actionTimeMs,
          reserveTimeMs: config.reserveTimeMs,
          doubleDecisionTimeMs: config.doubleDecisionTimeMs,
          initialBetAmount: config.initialBetAmount,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "Matchmaking already in progress",
            code: "MATCHMAKING_ALREADY_ACTIVE",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      status: "waiting",
      config,
    });
  }

  await ensureInternalUser(opponentId);

  let engineMatchId: string;
  try {
    const engine = await createEngineMatch(opponentId, userId, toEngineConfig(config));
    engineMatchId = engine.match_id;
  } catch (error) {
    await prisma.matchmakingQueue.upsert({
      where: { userId: opponentId },
      update: {
        gameType: config.gameType,
        actionTimeMs: config.actionTimeMs,
        reserveTimeMs: config.reserveTimeMs,
        doubleDecisionTimeMs: config.doubleDecisionTimeMs,
        initialBetAmount: config.initialBetAmount,
        createdAt: new Date(),
      },
      create: {
        userId: opponentId,
        gameType: config.gameType,
        actionTimeMs: config.actionTimeMs,
        reserveTimeMs: config.reserveTimeMs,
        doubleDecisionTimeMs: config.doubleDecisionTimeMs,
        initialBetAmount: config.initialBetAmount,
      },
    });

    await prisma.matchmakingQueue.upsert({
      where: { userId },
      update: {
        gameType: config.gameType,
        actionTimeMs: config.actionTimeMs,
        reserveTimeMs: config.reserveTimeMs,
        doubleDecisionTimeMs: config.doubleDecisionTimeMs,
        initialBetAmount: config.initialBetAmount,
        createdAt: new Date(),
      },
      create: {
        userId,
        gameType: config.gameType,
        actionTimeMs: config.actionTimeMs,
        reserveTimeMs: config.reserveTimeMs,
        doubleDecisionTimeMs: config.doubleDecisionTimeMs,
        initialBetAmount: config.initialBetAmount,
      },
    });

    return NextResponse.json(
      { error: "Engine unavailable", details: (error as Error).message },
      { status: 503 },
    );
  }

  let game;
  try {
    game = await prisma.$transaction(async (tx) => {
      await tx.matchmakingQueue.deleteMany({ where: { userId: { in: [userId, opponentId] } } });

      const debited = await tx.internalUser.updateMany({
        where: {
          userId: { in: [userId, opponentId] },
          balance: { gte: config.initialBetAmount },
        },
        data: {
          balance: { decrement: config.initialBetAmount },
        },
      });
      if (debited.count !== 2) {
        throw new Error("insufficient balance while creating match");
      }

      const created = await tx.game.create({
        data: {
          player1Id: opponentId,
          player2Id: userId,
          status: "in_progress",
          engineMatchId,
          gameType: config.gameType,
          actionTimeMs: config.actionTimeMs,
          reserveTimeMs: config.reserveTimeMs,
          doubleDecisionTimeMs: config.doubleDecisionTimeMs,
          initialBetAmount: config.initialBetAmount,
          currentBetAmount: config.initialBetAmount,
          bankAmount: config.initialBetAmount * 2,
          payoutPercent: config.payoutPercent,
        },
      });

      const assigned = await tx.internalUser.updateMany({
        where: {
          userId: { in: [userId, opponentId] },
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
        console.error("failed to cleanup orphaned engine match", cleanupError);
      }
    }
    return NextResponse.json(
      { error: "Unable to create match", details: (error as Error).message },
      { status: 409 },
    );
  }

  return NextResponse.json({
    status: "matched",
    game: toActiveGamePayload(game, userId),
  });
}
