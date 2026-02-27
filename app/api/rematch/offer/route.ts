import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

type OfferPayload = {
  gameId?: number;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: OfferPayload;
  try {
    payload = (await request.json()) as OfferPayload;
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
      status: true,
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

  const me = await ensureInternalUser(userId);
  if (me.currentGameId) {
    const active = await prisma.game.findUnique({
      where: { id: me.currentGameId },
      select: { status: true },
    });
    if (active && active.status !== "finished") {
      return NextResponse.json(
        { error: "Active game already in progress", code: "ACTIVE_GAME_EXISTS" },
        { status: 409 },
      );
    }

    await prisma.internalUser.update({
      where: { userId },
      data: { currentGameId: null },
    });
  }

  const existing = await prisma.gameRematchOffer.findUnique({ where: { gameId } });
  if (
    existing &&
    existing.status === "pending" &&
    existing.requesterUserId === opponentUserId &&
    existing.responderUserId === userId
  ) {
    return NextResponse.json({
      status: "incoming",
      requesterUserId: existing.requesterUserId,
      responderUserId: existing.responderUserId,
    });
  }

  const offer = await prisma.gameRematchOffer.upsert({
    where: { gameId },
    update: {
      requesterUserId: userId,
      responderUserId: opponentUserId,
      status: "pending",
    },
    create: {
      gameId,
      requesterUserId: userId,
      responderUserId: opponentUserId,
      status: "pending",
    },
  });

  return NextResponse.json({
    status: "outgoing",
    requesterUserId: offer.requesterUserId,
    responderUserId: offer.responderUserId,
  });
}
