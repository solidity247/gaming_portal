"use client";

import BGBoard from "@/bg_client_app/BGBoard";
import {
  EngineMatchState,
  EngineMoveOption,
  EngineWsMessage,
} from "@/bg_client_app/engine-types";
import type { GameFinishedPayload } from "@/bg_client_app/BgGameProvider";
import { BoardData } from "@/lib/bg_data/defBoardData";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectResponse = {
  wsUrl: string;
  gameId: number;
  engineMatchId: string;
  gameConfig?: {
    actionTimeMs: number;
    reserveTimeMs: number;
    doubleDecisionTimeMs: number;
    initialBetAmount: number;
    currentBetAmount: number;
    bankAmount: number;
    payoutPercent: number;
  };
};

type BgGameProps = {
  gameId: number;
  onGameFinished: (payload: GameFinishedPayload) => void;
  onOpponentPresenceChange?: (connected: boolean) => void;
};

type MoveAnimation = {
  id: number;
  from: number;
  to: number;
  color: "white" | "black";
};

type EngineMoveAction = {
  kind: "move";
  from: number;
  to: number;
  die?: number;
};

function asMoveAction(action: unknown): EngineMoveAction | null {
  if (!action || typeof action !== "object") return null;
  const candidate = action as { kind?: unknown; from?: unknown; to?: unknown; die?: unknown };
  if (candidate.kind !== "move") return null;
  if (!Number.isInteger(candidate.from) || !Number.isInteger(candidate.to)) return null;
  if (candidate.die != null && !Number.isInteger(candidate.die)) return null;

  return {
    kind: "move",
    from: candidate.from as number,
    to: candidate.to as number,
    ...(candidate.die != null ? { die: candidate.die as number } : {}),
  };
}

function pointsToBoardData(points: number[]): BoardData {
  return Array.from({ length: 24 }).map((_, idx) => {
    const point = idx + 1;
    const value = points[idx] ?? 0;
    return {
      id: `c${point}`,
      occupation: value > 0 ? "w" : value < 0 ? "b" : null,
      checkers: Math.abs(value),
    };
  });
}

export default function BgGame({
  gameId,
  onGameFinished,
  onOpponentPresenceChange,
}: BgGameProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const roleRef = useRef<"white" | "black" | null>(null);
  const opponentUserIdRef = useRef<string | null>(null);
  const connectedUsersRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState("Connecting to engine...");
  const [state, setState] = useState<EngineMatchState | null>(null);
  const [role, setRole] = useState<"white" | "black" | null>(null);
  const [lastEvent, setLastEvent] = useState<string>("No events yet");
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [fightCountdown, setFightCountdown] = useState<number | null>(null);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const finishReportedRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);

  const reportFinished = useCallback(
    (matchState: EngineMatchState) => {
      if (finishReportedRef.current) return;
      finishReportedRef.current = true;

      const currentRole = roleRef.current;
      const myUserId =
        currentRole === "white"
          ? matchState.white_user_id
          : currentRole === "black"
            ? matchState.black_user_id
            : null;
      const opponentUserId =
        currentRole === "white"
          ? matchState.black_user_id
          : currentRole === "black"
            ? matchState.white_user_id
            : null;
      const didWin = myUserId ? matchState.winner_user_id === myUserId : null;
      const payoutAmount = Math.floor((matchState.bank_amount * matchState.payout_percent) / 100);

      onGameFinished({
        gameId,
        winnerUserId: matchState.winner_user_id,
        myUserId,
        opponentUserId,
        didWin,
        bankAmount: matchState.bank_amount,
        payoutPercent: matchState.payout_percent,
        payoutAmount,
        opponentConnected: opponentUserId
          ? connectedUsersRef.current.has(opponentUserId)
          : false,
      });
    },
    [gameId, onGameFinished],
  );

  const emitOpponentPresence = useCallback(
    (connected: boolean, explicitOpponentUserId?: string | null) => {
      if (!onOpponentPresenceChange) return;
      const opponentUserId = explicitOpponentUserId ?? opponentUserIdRef.current;
      if (!opponentUserId) return;
      onOpponentPresenceChange(connected);
    },
    [onOpponentPresenceChange],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const currentPhase = state?.phase ?? null;
    const previousPhase = prevPhaseRef.current;
    prevPhaseRef.current = currentPhase;
    if (previousPhase === "opening_roll" && currentPhase === "in_progress") {
      const startedAt = Date.now();
      setFightCountdown(3);
      const countdownId = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = 3 - elapsedSeconds;
        if (remaining <= 0) {
          setFightCountdown(null);
          window.clearInterval(countdownId);
          return;
        }
        setFightCountdown(remaining);
      }, 150);
      return () => window.clearInterval(countdownId);
    }
  }, [state?.phase]);

  useEffect(() => {
    let cancelled = false;
    finishReportedRef.current = false;
    connectedUsersRef.current = new Set();
    opponentUserIdRef.current = null;

    const connect = async () => {
      try {
        const response = await fetch(`/api/game/connect?gameId=${gameId}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to fetch connection token");

        const payload = (await response.json()) as ConnectResponse;
        if (cancelled) return;

        const ws = new WebSocket(payload.wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setStatus("Connected");
          setError(null);
        };

        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data as string) as EngineWsMessage;

            if (message.type === "snapshot") {
              setState(message.state);
              roleRef.current = message.role;
              setRole(message.role);
              connectedUsersRef.current.add(message.you);
              const opponentUserId =
                message.role === "white"
                  ? message.state.black_user_id
                  : message.state.white_user_id;
              opponentUserIdRef.current = opponentUserId;
              setLastEvent("Snapshot received");
              if (message.state.status === "finished") {
                reportFinished(message.state);
              }
              return;
            }

            if (message.type === "state_update") {
              setState(message.state);
              setLastEvent(`Action from ${message.actor_user_id}`);
              connectedUsersRef.current.add(message.actor_user_id);
              const currentRole = roleRef.current;
              if (currentRole) {
                opponentUserIdRef.current =
                  currentRole === "white"
                    ? message.state.black_user_id
                    : message.state.white_user_id;
              }
              if (
                opponentUserIdRef.current &&
                message.actor_user_id === opponentUserIdRef.current
              ) {
                emitOpponentPresence(true, opponentUserIdRef.current);
              }

              const moveAction = asMoveAction(message.action);
              if (moveAction) {
                const actorColor =
                  message.actor_user_id === message.state.white_user_id
                    ? "white"
                    : message.actor_user_id === message.state.black_user_id
                      ? "black"
                      : null;
                if (actorColor) {
                  setMoveAnimation({
                    id: Date.now(),
                    from: moveAction.from,
                    to: moveAction.to,
                    color: actorColor,
                  });
                }
              }

              if (message.state.status === "finished") {
                reportFinished(message.state);
              }
              return;
            }

            if (message.type === "presence") {
              if (message.event === "joined") {
                connectedUsersRef.current.add(message.user_id);
              } else if (message.event === "left") {
                connectedUsersRef.current.delete(message.user_id);
              }
              if (
                opponentUserIdRef.current &&
                message.user_id === opponentUserIdRef.current
              ) {
                if (message.event === "joined") {
                  emitOpponentPresence(true, message.user_id);
                } else if (message.event === "left") {
                  emitOpponentPresence(false, message.user_id);
                }
              }
              setLastEvent(`${message.user_id} ${message.event}`);
              return;
            }

            if (message.type === "error") {
              setError(message.message);
              setLastEvent(`Error: ${message.message}`);
              return;
            }

            if (message.type === "pong") {
              setLastEvent("Pong");
            }
          } catch {
            setLastEvent("Unreadable WS message");
          }
        };

        ws.onclose = () => {
          setStatus("Disconnected");
        };

        ws.onerror = () => {
          setStatus("Connection error");
        };
      } catch (err) {
        setStatus((err as Error).message);
      }
    };

    connect().catch(() => setStatus("Connection failed"));

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [emitOpponentPresence, gameId, onGameFinished, reportFinished]);

  const sendAction = (action: unknown) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !state) return;

    ws.send(
      JSON.stringify({
        type: "action",
        expected_version: state.version,
        action,
      }),
    );
  };

  const boardData = useMemo(() => {
    if (!state) {
      return pointsToBoardData(Array.from({ length: 24 }, () => 0));
    }
    return pointsToBoardData(state.position.points);
  }, [state]);

  const canInteract = Boolean(state && role && state.status !== "finished");
  const pendingDouble = state?.double_offer ?? null;
  const isMyTurn = Boolean(state && role && state.turn === role);
  const canOpeningRoll =
    state != null &&
    role != null &&
    state.phase === "opening_roll" &&
    ((role === "white" && state.opening_roll_white == null) ||
      (role === "black" && state.opening_roll_black == null));
  const canOfferDouble =
    state != null &&
    role != null &&
    state.phase === "in_progress" &&
    isMyTurn &&
    !pendingDouble &&
    state.dice.length === 0;
  const myUserId =
    state && role ? (role === "white" ? state.white_user_id : state.black_user_id) : null;
  const canRespondDouble = Boolean(
    state && pendingDouble && myUserId && pendingDouble.responder_user_id === myUserId,
  );

  const timers = useMemo(() => {
    if (!state) {
      return {
        whiteActionMsLeft: 0,
        blackActionMsLeft: 0,
        whiteReserveMsLeft: 0,
        blackReserveMsLeft: 0,
        totalReserveMs: 0,
        doubleDecisionMsLeft: 0,
      };
    }

    let whiteActionMsLeft = 0;
    let blackActionMsLeft = 0;
    let whiteReserveMsLeft = state.white_reserve_ms;
    let blackReserveMsLeft = state.black_reserve_ms;
    if (state.phase === "opening_roll") {
      const elapsed = Math.max(0, nowMs - state.turn_started_at_ms);
      const actionLeft = Math.max(0, state.action_time_ms - elapsed);
      const overtime = Math.max(0, elapsed - state.action_time_ms);
      if (state.opening_roll_white == null) {
        whiteActionMsLeft = actionLeft;
        whiteReserveMsLeft = Math.max(0, state.white_reserve_ms - overtime);
      }
      if (state.opening_roll_black == null) {
        blackActionMsLeft = actionLeft;
        blackReserveMsLeft = Math.max(0, state.black_reserve_ms - overtime);
      }
    } else if (state.phase === "in_progress" && state.status === "in_progress") {
      const elapsed = Math.max(0, nowMs - state.turn_started_at_ms);
      const actionLeft = Math.max(0, state.action_time_ms - elapsed);
      const overtime = Math.max(0, elapsed - state.action_time_ms);

      if (state.turn === "white") {
        whiteActionMsLeft = actionLeft;
        whiteReserveMsLeft = Math.max(0, state.white_reserve_ms - overtime);
      } else {
        blackActionMsLeft = actionLeft;
        blackReserveMsLeft = Math.max(0, state.black_reserve_ms - overtime);
      }
    }

    return {
      whiteActionMsLeft,
      blackActionMsLeft,
      whiteReserveMsLeft,
      blackReserveMsLeft,
      totalReserveMs: state.total_reserve_time_ms,
      doubleDecisionMsLeft: state.double_offer
        ? Math.max(0, state.double_offer.expires_at_ms - nowMs)
        : 0,
    };
  }, [nowMs, state]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded border p-2 text-sm">
        <span>
          {status}
          {state ? ` | version ${state.version}` : ""}
          {state ? ` | status ${state.status}` : ""}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">Last event: {lastEvent}</div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="min-h-0 flex-1 overflow-hidden rounded border p-2">
        {fightCountdown && (
          <div className="mb-2 rounded border bg-yellow-50 p-2 text-center text-sm font-semibold text-yellow-700">
            {fightCountdown}...
          </div>
        )}
        {state && role ? (
          <BGBoard
            phase={state.phase}
            boardData={boardData}
            turn={state.turn}
            myRole={role}
            openingRollWhite={state.opening_roll_white}
            openingRollBlack={state.opening_roll_black}
            roll={state.roll}
            diceRemaining={state.dice}
            legalMoves={state.legal_moves}
            barWhite={state.position.bar_white}
            barBlack={state.position.bar_black}
            offWhite={state.position.off_white}
            offBlack={state.position.off_black}
            initialBetAmount={state.initial_bet_amount}
            currentBetAmount={state.current_bet_amount}
            bankAmount={state.bank_amount}
            payoutPercent={state.payout_percent}
            pendingDouble={pendingDouble}
            canOpeningRoll={canOpeningRoll}
            canOfferDouble={canOfferDouble}
            canRespondDouble={canRespondDouble}
            doubleDecisionMsLeft={timers.doubleDecisionMsLeft}
            whiteActionMsLeft={timers.whiteActionMsLeft}
            blackActionMsLeft={timers.blackActionMsLeft}
            whiteReserveMsLeft={timers.whiteReserveMsLeft}
            blackReserveMsLeft={timers.blackReserveMsLeft}
            totalReserveMs={timers.totalReserveMs}
            onOpeningRoll={() => {
              if (!canOpeningRoll) return;
              sendAction({ kind: "opening_roll" });
            }}
            onRoll={() => {
              if (!canInteract || state.phase !== "in_progress") return;
              sendAction({ kind: "roll" });
            }}
            onOfferDouble={() => {
              if (!canOfferDouble) return;
              sendAction({ kind: "offer_double" });
            }}
            onDoubleAccept={() => {
              if (!canRespondDouble) return;
              sendAction({ kind: "double_response", accept: true });
            }}
            onDoubleReject={() => {
              if (!canRespondDouble) return;
              sendAction({ kind: "double_response", accept: false });
            }}
            onUndo={() => {
              if (!canInteract || state.phase !== "in_progress" || pendingDouble) return;
              sendAction({ kind: "undo" });
            }}
            onMove={(move: EngineMoveOption) => {
              if (!canInteract || state.phase !== "in_progress" || pendingDouble) return;
              sendAction({ kind: "move", from: move.from, to: move.to, die: move.die });
            }}
            whiteUserId={state.white_user_id}
            blackUserId={state.black_user_id}
            moveAnimation={moveAnimation}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Waiting for initial game snapshot...
          </div>
        )}
      </div>
    </div>
  );
}
