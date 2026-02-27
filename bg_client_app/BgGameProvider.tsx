"use client";

import dynamic from "next/dynamic";

const BGBoardClient = dynamic(() => import("./BgGame"), { ssr: false });

export type GameFinishedPayload = {
  gameId: number;
  winnerUserId: string | null;
  myUserId: string | null;
  opponentUserId: string | null;
  didWin: boolean | null;
  bankAmount: number;
  payoutPercent: number;
  payoutAmount: number;
  opponentConnected: boolean;
};

type BgGameProviderProps = {
  gameId: number;
  onGameFinished: (payload: GameFinishedPayload) => void;
  onOpponentPresenceChange?: (connected: boolean) => void;
};

export default function BgGameProvider({
  gameId,
  onGameFinished,
  onOpponentPresenceChange,
}: BgGameProviderProps) {
  return (
    <BGBoardClient
      gameId={gameId}
      onGameFinished={onGameFinished}
      onOpponentPresenceChange={onOpponentPresenceChange}
    />
  );
}
