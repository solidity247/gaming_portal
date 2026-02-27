import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server-prisma";
import { ensureInternalUser } from "@/lib/server-user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureInternalUser(userId);

  const games = await prisma.game.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: "finished",
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    items: games.map((game) => {
      const result = game.winnerId === userId ? "win" : game.winnerId ? "loss" : "draw";
      return {
        id: game.id,
        engineMatchId: game.engineMatchId,
        player1Id: game.player1Id,
        player2Id: game.player2Id,
        winnerId: game.winnerId,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        result,
      };
    }),
  });
}
