import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import {
  buildEngineWsUrl,
  createEngineMatch,
  EngineHttpError,
  EngineIssueTokenResponse,
  issueEngineToken,
} from "@/lib/server-engine";

function isEngineMatchNotFound(error: unknown): error is EngineHttpError {
  return (
    error instanceof EngineHttpError &&
    error.status === 404 &&
    error.body.toLowerCase().includes("match not found")
  );
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = request.nextUrl.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "Missing gameId" }, { status: 400 });

  const numericId = Number(gameId);
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: numericId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isParticipant = game.player1Id === userId || game.player2Id === userId;
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!game.engineMatchId) {
    return NextResponse.json({ error: "Missing engine match id" }, { status: 500 });
  }

  let engineMatchId = game.engineMatchId;
  let tokenResult: EngineIssueTokenResponse;
  try {
    tokenResult = await issueEngineToken(engineMatchId, userId);
  } catch (error) {
    if (!isEngineMatchNotFound(error)) {
      return NextResponse.json(
        { error: "Engine unavailable", details: (error as Error).message },
        { status: 503 },
      );
    }

    try {
      const recreated = await createEngineMatch(game.player1Id, game.player2Id, {
        game_type: game.gameType,
        action_time_ms: game.actionTimeMs,
        reserve_time_ms: game.reserveTimeMs,
        double_decision_time_ms: game.doubleDecisionTimeMs,
        initial_bet_amount: game.initialBetAmount,
        current_bet_amount: game.currentBetAmount,
        bank_amount: game.bankAmount,
        payout_percent: game.payoutPercent,
      });
      const updated = await prisma.game.updateMany({
        where: {
          id: game.id,
          engineMatchId: game.engineMatchId,
        },
        data: {
          engineMatchId: recreated.match_id,
        },
      });

      if (updated.count === 1) {
        engineMatchId = recreated.match_id;
      } else {
        const latest = await prisma.game.findUnique({
          where: { id: game.id },
          select: { engineMatchId: true },
        });
        if (!latest?.engineMatchId) {
          return NextResponse.json(
            { error: "Unable to recover engine match" },
            { status: 503 },
          );
        }
        engineMatchId = latest.engineMatchId;
      }

      tokenResult = await issueEngineToken(engineMatchId, userId);
    } catch (recoveryError) {
      return NextResponse.json(
        { error: "Engine unavailable", details: (recoveryError as Error).message },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    gameId: game.id,
    engineMatchId,
    wsUrl: buildEngineWsUrl(tokenResult.token),
    expiresAt: tokenResult.expires_at,
    gameConfig: {
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
