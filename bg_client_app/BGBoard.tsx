"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import BoardCell from "./BoardCell";
import { BoardData, Cell } from "@/lib/bg_data/defBoardData";
import { Button } from "@/components/ui/button";
import { EngineDoubleOffer, EngineMoveOption } from "@/bg_client_app/engine-types";

type MoveAnimation = {
  id: number;
  from: number;
  to: number;
  color: "white" | "black";
};

type BGBoardProps = {
  phase: "opening_roll" | "in_progress" | "finished" | string;
  boardData: BoardData;
  legalMoves: EngineMoveOption[];
  turn: "white" | "black";
  myRole: "white" | "black";
  whiteUserId: string;
  blackUserId: string;
  openingRollWhite: number | null;
  openingRollBlack: number | null;
  roll: number[];
  diceRemaining: number[];
  barWhite: number;
  barBlack: number;
  offWhite: number;
  offBlack: number;
  initialBetAmount: number;
  currentBetAmount: number;
  bankAmount: number;
  payoutPercent: number;
  pendingDouble: EngineDoubleOffer | null;
  canOpeningRoll: boolean;
  canOfferDouble: boolean;
  canRespondDouble: boolean;
  doubleDecisionMsLeft: number;
  whiteActionMsLeft: number;
  blackActionMsLeft: number;
  whiteReserveMsLeft: number;
  blackReserveMsLeft: number;
  totalReserveMs: number;
  moveAnimation: MoveAnimation | null;
  onOpeningRoll: () => void;
  onRoll: () => void;
  onOfferDouble: () => void;
  onDoubleAccept: () => void;
  onDoubleReject: () => void;
  onUndo: () => void;
  onMove: (move: EngineMoveOption) => void;
};

type GhostChecker = {
  id: number;
  color: "white" | "black";
  left: number;
  top: number;
  dx: number;
  dy: number;
  active: boolean;
};

type FlashMove = {
  id: number;
  source: number;
  target: number;
};

function parseCellId(id: string): number | null {
  if (!id.startsWith("c")) return null;
  const numeric = Number(id.slice(1));
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 24 ? numeric : null;
}

function formatSeconds(ms: number) {
  return Math.max(0, ms / 1000).toFixed(1);
}

function shortUser(userId: string) {
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
}

function pickPreferredMove(
  moves: EngineMoveOption[],
  myRole: "white" | "black",
): EngineMoveOption | null {
  if (!moves.length) return null;
  const ordered = [...moves].sort((a, b) => {
    if (b.die !== a.die) return b.die - a.die;
    if (myRole === "white") return a.to - b.to;
    return b.to - a.to;
  });
  return ordered[0] ?? null;
}

function CellSlot({
  cell,
  level,
  draggable,
  dropTarget,
  selectedSource,
  checkerCanInteract,
  animateSource,
  animateTarget,
  onCellClick,
  onTopCheckerClick,
  onTopCheckerDoubleClick,
}: {
  cell: Cell;
  level: "top" | "bot";
  draggable: boolean;
  dropTarget: boolean;
  selectedSource: boolean;
  checkerCanInteract: boolean;
  animateSource: boolean;
  animateTarget: boolean;
  onCellClick: () => void;
  onTopCheckerClick: () => void;
  onTopCheckerDoubleClick: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cell.id });

  return (
    <BoardCell
      ref={setNodeRef}
      cellData={cell}
      level={level}
      draggable={draggable}
      dropTarget={dropTarget || isOver}
      selectedSource={selectedSource}
      checkerCanInteract={checkerCanInteract}
      animateSource={animateSource}
      animateTarget={animateTarget}
      onCellClick={onCellClick}
      onTopCheckerClick={onTopCheckerClick}
      onTopCheckerDoubleClick={onTopCheckerDoubleClick}
    />
  );
}

export default function BGBoard({
  phase,
  boardData,
  legalMoves,
  turn,
  myRole,
  whiteUserId,
  blackUserId,
  openingRollWhite,
  openingRollBlack,
  roll,
  diceRemaining,
  barWhite,
  barBlack,
  offWhite,
  offBlack,
  initialBetAmount,
  currentBetAmount,
  bankAmount,
  payoutPercent,
  pendingDouble,
  canOpeningRoll,
  canOfferDouble,
  canRespondDouble,
  doubleDecisionMsLeft,
  whiteActionMsLeft,
  blackActionMsLeft,
  whiteReserveMsLeft,
  blackReserveMsLeft,
  totalReserveMs,
  moveAnimation,
  onOpeningRoll,
  onRoll,
  onOfferDouble,
  onDoubleAccept,
  onDoubleReject,
  onUndo,
  onMove,
}: BGBoardProps) {
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [selectedFromPoint, setSelectedFromPoint] = useState<number | null>(null);
  const [draggingFromPoint, setDraggingFromPoint] = useState<number | null>(null);
  const [ghostChecker, setGhostChecker] = useState<GhostChecker | null>(null);
  const [flashMove, setFlashMove] = useState<FlashMove | null>(null);

  const myColorSymbol = myRole === "white" ? "w" : "b";
  const myUserId = myRole === "white" ? whiteUserId : blackUserId;
  const opponentUserId = myRole === "white" ? blackUserId : whiteUserId;
  const canInteractTurn =
    phase === "in_progress" && myRole === turn && !pendingDouble;
  const canRoll =
    phase === "in_progress" &&
    myRole === turn &&
    diceRemaining.length === 0 &&
    !pendingDouble;

  const maxRollCount = useMemo(() => {
    if (roll.length !== 2) return 0;
    return roll[0] === roll[1] ? 4 : 2;
  }, [roll]);

  const canUndo =
    canInteractTurn &&
    maxRollCount > 0 &&
    diceRemaining.length < maxRollCount;

  const orderedLegalMoves = useMemo(
    () =>
      [...legalMoves].sort(
        (a, b) => b.die - a.die || a.from - b.from || a.to - b.to,
      ),
    [legalMoves],
  );

  const draggablePoints = useMemo(() => {
    if (!canInteractTurn) return new Set<number>();
    return new Set(
      legalMoves
        .filter((move) => move.from >= 1 && move.from <= 24)
        .map((move) => move.from),
    );
  }, [canInteractTurn, legalMoves]);

  const activeFromPoint = draggingFromPoint ?? selectedFromPoint;
  const dropTargets = useMemo(() => {
    if (!activeFromPoint) return new Set<number>();
    return new Set(
      legalMoves
        .filter((move) => move.from === activeFromPoint && move.to >= 1 && move.to <= 24)
        .map((move) => move.to),
    );
  }, [activeFromPoint, legalMoves]);

  useEffect(() => {
    if (!canInteractTurn) {
      setSelectedFromPoint(null);
      setDraggingFromPoint(null);
    }
  }, [canInteractTurn, phase, turn, myRole]);

  useEffect(() => {
    if (!moveAnimation || moveAnimation.from < 1 || moveAnimation.to < 1) {
      return;
    }

    const board = boardSurfaceRef.current;
    if (!board) return;

    const sourceElement = board.querySelector<HTMLElement>(`#c${moveAnimation.from}`);
    const targetElement = board.querySelector<HTMLElement>(`#c${moveAnimation.to}`);
    if (!sourceElement || !targetElement) return;

    const boardRect = board.getBoundingClientRect();
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const left = sourceRect.left - boardRect.left + sourceRect.width / 2 - 14;
    const top = sourceRect.top - boardRect.top + sourceRect.height / 2 - 14;
    const dx = targetRect.left - sourceRect.left;
    const dy = targetRect.top - sourceRect.top;

    setFlashMove({
      id: moveAnimation.id,
      source: moveAnimation.from,
      target: moveAnimation.to,
    });
    setGhostChecker({
      id: moveAnimation.id,
      color: moveAnimation.color,
      left,
      top,
      dx,
      dy,
      active: false,
    });

    const rafId = window.requestAnimationFrame(() => {
      setGhostChecker((current) =>
        current && current.id === moveAnimation.id
          ? { ...current, active: true }
          : current,
      );
    });

    const ghostTimeout = window.setTimeout(() => {
      setGhostChecker((current) =>
        current && current.id === moveAnimation.id ? null : current,
      );
    }, 350);

    const flashTimeout = window.setTimeout(() => {
      setFlashMove((current) =>
        current && current.id === moveAnimation.id ? null : current,
      );
    }, 450);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(ghostTimeout);
      window.clearTimeout(flashTimeout);
    };
  }, [moveAnimation]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const commitMove = (move: EngineMoveOption) => {
    setSelectedFromPoint(null);
    setDraggingFromPoint(null);
    onMove(move);
  };

  const tryMoveFromTo = (from: number, to: number) => {
    const candidates = legalMoves.filter((move) => move.from === from && move.to === to);
    const preferred = pickPreferredMove(candidates, myRole);
    if (!preferred) return;
    commitMove(preferred);
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!canInteractTurn) return;
    const fromPoint = parseCellId(String(event.active.id));
    if (!fromPoint) return;
    setDraggingFromPoint(fromPoint);
    setSelectedFromPoint(null);
  };

  const onDragCancel = () => {
    setDraggingFromPoint(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!canInteractTurn) {
      setDraggingFromPoint(null);
      return;
    }
    const fromPoint = parseCellId(String(event.active.id));
    const toPoint = event.over ? parseCellId(String(event.over.id)) : null;
    setDraggingFromPoint(null);
    if (!fromPoint || !toPoint) return;
    tryMoveFromTo(fromPoint, toPoint);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[1300px] flex-col gap-3">
      <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="space-y-1 text-xs">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Opponent</div>
            <div className="text-base font-semibold">{shortUser(opponentUserId)}</div>
            <div className="text-muted-foreground">
              A: {formatSeconds(myRole === "white" ? blackActionMsLeft : whiteActionMsLeft)}s | R:{" "}
              {formatSeconds(myRole === "white" ? blackReserveMsLeft : whiteReserveMsLeft)}s
            </div>
          </div>

          <div className="rounded-lg border bg-zinc-50 px-4 py-2 text-center text-xs">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Backgammon Game
            </div>
            <div className="mt-1 font-medium">Phase: {phase.replace("_", " ")}</div>
            <div className="text-muted-foreground">
              Pot {bankAmount} | Bet {currentBetAmount}
            </div>
          </div>

          <div className="space-y-1 text-right text-xs">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">You</div>
            <div className="text-base font-semibold">{shortUser(myUserId)}</div>
            <div className="text-muted-foreground">
              A: {formatSeconds(myRole === "white" ? whiteActionMsLeft : blackActionMsLeft)}s | R:{" "}
              {formatSeconds(myRole === "white" ? whiteReserveMsLeft : blackReserveMsLeft)}s
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_300px]">
        <div className="min-h-0 rounded-xl border bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-1">
                Turn: {turn.toUpperCase()}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1">
                Roll: {roll.length ? roll.join(" / ") : "-"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1">
                Remaining: {diceRemaining.length ? diceRemaining.join(", ") : "-"}
              </span>
            </div>
            <div className="text-muted-foreground">
              Initial Bet {initialBetAmount} | Payout {payoutPercent}%
            </div>
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
          >
            <div
              ref={boardSurfaceRef}
              className="relative h-[620px] w-full select-none overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100 p-2"
            >
              <ul className="bg-board h-full w-full gap-1 rounded-md bg-white p-1">
                {boardData.map((cell, index) => {
                  const level = index < 12 ? "top" : "bot";
                  const cellPoint = parseCellId(cell.id);
                  const point = cellPoint ?? 0;
                  const selectableChecker =
                    canInteractTurn &&
                    cell.occupation === myColorSymbol &&
                    point > 0 &&
                    draggablePoints.has(point);
                  const dropTarget = point > 0 && dropTargets.has(point);
                  const selectedSource = point > 0 && selectedFromPoint === point;
                  const animateSource = point > 0 && flashMove?.source === point;
                  const animateTarget = point > 0 && flashMove?.target === point;

                  return (
                    <CellSlot
                      key={cell.id}
                      cell={cell}
                      level={level}
                      draggable={selectableChecker}
                      dropTarget={dropTarget}
                      selectedSource={selectedSource}
                      checkerCanInteract={selectableChecker}
                      animateSource={animateSource}
                      animateTarget={animateTarget}
                      onCellClick={() => {
                        if (!canInteractTurn) return;
                        if (
                          selectedFromPoint &&
                          cellPoint &&
                          dropTargets.has(cellPoint)
                        ) {
                          tryMoveFromTo(selectedFromPoint, cellPoint);
                          return;
                        }

                        setSelectedFromPoint(null);
                      }}
                      onTopCheckerClick={() => {
                        if (!canInteractTurn || !cellPoint || !draggablePoints.has(cellPoint)) {
                          return;
                        }
                        setSelectedFromPoint((current) =>
                          current === cellPoint ? null : cellPoint,
                        );
                      }}
                      onTopCheckerDoubleClick={() => {
                        if (!canInteractTurn || !cellPoint) return;
                        const candidates = legalMoves.filter((move) => move.from === cellPoint);
                        const preferred = pickPreferredMove(candidates, myRole);
                        if (!preferred) return;
                        commitMove(preferred);
                      }}
                    />
                  );
                })}
              </ul>

              {ghostChecker && (
                <div
                  className={[
                    "pointer-events-none absolute size-7 rounded-full border shadow-md transition-transform duration-300 ease-out",
                    ghostChecker.color === "white"
                      ? "border-zinc-300 bg-white"
                      : "border-zinc-500 bg-zinc-900",
                  ].join(" ")}
                  style={{
                    left: ghostChecker.left,
                    top: ghostChecker.top,
                    transform: ghostChecker.active
                      ? `translate3d(${ghostChecker.dx}px, ${ghostChecker.dy}px, 0)`
                      : "translate3d(0, 0, 0)",
                  }}
                />
              )}
            </div>
          </DndContext>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={onRoll} disabled={!canRoll}>
              Roll
            </Button>
            <Button variant="outline" onClick={onUndo} disabled={!canUndo}>
              Revert Move
            </Button>
            {phase === "opening_roll" && (
              <Button
                variant="secondary"
                onClick={onOpeningRoll}
                disabled={!canOpeningRoll}
              >
                Roll For First Turn
              </Button>
            )}
            {!pendingDouble && phase === "in_progress" && (
              <Button
                variant="secondary"
                onClick={onOfferDouble}
                disabled={!canOfferDouble}
              >
                Offer Double
              </Button>
            )}
            {pendingDouble && canRespondDouble && (
              <>
                <Button onClick={onDoubleAccept}>Accept Double</Button>
                <Button variant="destructive" onClick={onDoubleReject}>
                  Reject Double
                </Button>
              </>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border bg-white p-3 text-xs shadow-sm">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Match Timers
            </div>
            <div>White A: {formatSeconds(whiteActionMsLeft)}s</div>
            <div>White R: {formatSeconds(whiteReserveMsLeft)}s / {formatSeconds(totalReserveMs)}s</div>
            <div className="mt-1">Black A: {formatSeconds(blackActionMsLeft)}s</div>
            <div>Black R: {formatSeconds(blackReserveMsLeft)}s / {formatSeconds(totalReserveMs)}s</div>
          </div>

          <div className="rounded-xl border bg-white p-3 text-xs shadow-sm">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Board Counters
            </div>
            <div>Bar W/B: {barWhite} / {barBlack}</div>
            <div>Off W/B: {offWhite} / {offBlack}</div>
            {phase === "opening_roll" && (
              <div className="mt-1 text-muted-foreground">
                Opening roll W/B: {openingRollWhite ?? "-"} / {openingRollBlack ?? "-"}
              </div>
            )}
            {pendingDouble && (
              <div className="mt-1 text-amber-700">
                Pending double ({formatSeconds(doubleDecisionMsLeft)}s left)
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-3 text-xs shadow-sm">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Legal Moves
            </div>
            <div className="max-h-[260px] space-y-1 overflow-auto">
              {orderedLegalMoves.length === 0 && (
                <div className="text-muted-foreground">No legal moves</div>
              )}
              {orderedLegalMoves.map((move, index) => {
                const from = move.from === 0 ? "BAR" : `P${move.from}`;
                const to = move.to === 25 ? "OFF" : `P${move.to}`;
                return (
                  <Button
                    key={`${move.from}-${move.to}-${move.die}-${index}`}
                    variant="outline"
                    size="sm"
                    className="h-auto w-full justify-start whitespace-normal px-2 py-1 text-left text-[11px]"
                    onClick={() => commitMove(move)}
                    disabled={!canInteractTurn}
                  >
                    {from} {"->"} {to} (d{move.die}){move.hit ? " hit" : ""}
                  </Button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
