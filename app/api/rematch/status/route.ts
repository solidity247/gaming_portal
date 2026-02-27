import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

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

type RematchStatusPayload =
  | {
      status: "matched";
      game: ActiveGamePayload;
      requesterUserId: null;
      responderUserId: null;
    }
  | {
      status: "incoming" | "outgoing" | "none";
      requesterUserId: string | null;
      responderUserId: string | null;
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

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameIdRaw = request.nextUrl.searchParams.get("gameId");
  const gameId = Number(gameIdRaw);
  if (!Number.isInteger(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      status: true,
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isParticipant = game.player1Id === userId || game.player2Id === userId;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const me = await ensureInternalUser(userId);
  if (me.currentGameId) {
    const current = await prisma.game.findUnique({ where: { id: me.currentGameId } });
    if (current && current.status !== "finished") {
      const payload: RematchStatusPayload = {
        status: "matched",
        game: toActiveGamePayload(current, userId),
        requesterUserId: null,
        responderUserId: null,
      };
      return NextResponse.json(payload);
    }

    await prisma.internalUser.update({
      where: { userId },
      data: { currentGameId: null },
    });
  }

  const offer = await prisma.gameRematchOffer.findUnique({ where: { gameId } });
  if (!offer || offer.status !== "pending") {
    const payload: RematchStatusPayload = {
      status: "none",
      requesterUserId: null,
      responderUserId: null,
    };
    return NextResponse.json(payload);
  }

  if (offer.requesterUserId === userId) {
    const payload: RematchStatusPayload = {
      status: "outgoing",
      requesterUserId: offer.requesterUserId,
      responderUserId: offer.responderUserId,
    };
    return NextResponse.json(payload);
  }

  if (offer.responderUserId === userId) {
    const payload: RematchStatusPayload = {
      status: "incoming",
      requesterUserId: offer.requesterUserId,
      responderUserId: offer.responderUserId,
    };
    return NextResponse.json(payload);
  }

  const payload: RematchStatusPayload = {
    status: "none",
    requesterUserId: null,
    responderUserId: null,
  };
  return NextResponse.json(payload);
}
