"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BgGameProvider, { type GameFinishedPayload } from "@/bg_client_app/BgGameProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type MatchmakingState = "idle" | "waiting" | "matched";
type PlayModalStage = "looking" | "matching" | "playing" | "game-over";

type MatchConfig = {
  gameType: "bg";
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
};

type MatchPresetId =
  | "light-weight"
  | "confident"
  | "master"
  | "quick-gonzales";

type MatchPreset = {
  id: MatchPresetId;
  title: "LIGHT WEIGHT" | "CONFIDENT" | "MASTER" | "QUICK GONZALES";
  subtitle: string;
  config: MatchConfig;
};

type MatchMode = {
  title: string;
  config: MatchConfig;
};

type ActiveGame = {
  id: number;
  engineMatchId: string | null;
  player1Id: string;
  player2Id: string;
  currentUserId?: string;
  gameType?: string;
  actionTimeMs?: number;
  reserveTimeMs?: number;
  doubleDecisionTimeMs?: number;
  initialBetAmount?: number;
  currentBetAmount?: number;
  bankAmount?: number;
  payoutPercent?: number;
};

type StatusPayload = {
  status: MatchmakingState;
  game?: ActiveGame;
  balance?: number;
  config?: MatchConfig | null;
};

type StartPayload = StatusPayload & {
  error?: string;
  details?: string;
  code?: "ACTIVE_GAME_EXISTS" | "MATCHMAKING_ALREADY_ACTIVE" | string;
};

type RematchStatusPayload =
  | {
      status: "matched";
      game: ActiveGame;
      requesterUserId: null;
      responderUserId: null;
    }
  | {
      status: "none" | "incoming" | "outgoing";
      requesterUserId: string | null;
      responderUserId: string | null;
      game?: never;
    };

type RematchOfferState = "none" | "incoming" | "outgoing";

type RematchDirectionalPayload = {
  status?: "none" | "incoming" | "outgoing";
  requesterUserId?: string | null;
  responderUserId?: string | null;
};

const MATCH_PRESETS: MatchPreset[] = [
  {
    id: "light-weight",
    title: "LIGHT WEIGHT",
    subtitle: "BET 100 | TIME 5 + 45 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 45_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 100,
    },
  },
  {
    id: "confident",
    title: "CONFIDENT",
    subtitle: "BET 500 | TIME 5 + 45 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 45_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 500,
    },
  },
  {
    id: "master",
    title: "MASTER",
    subtitle: "BET 200 | TIME 5 + 30 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 30_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 200,
    },
  },
  {
    id: "quick-gonzales",
    title: "QUICK GONZALES",
    subtitle: "BET 500 | TIME 3 + 15 | DOUBLE 5",
    config: {
      gameType: "bg",
      actionTimeMs: 3_000,
      reserveTimeMs: 15_000,
      doubleDecisionTimeMs: 5_000,
      initialBetAmount: 500,
    },
  },
];

function configKey(config: MatchConfig) {
  return [
    config.gameType,
    config.actionTimeMs,
    config.reserveTimeMs,
    config.doubleDecisionTimeMs,
    config.initialBetAmount,
  ].join(":");
}

function presetForConfig(config: MatchConfig | null): MatchPreset | null {
  if (!config) return null;
  const key = configKey(config);
  return MATCH_PRESETS.find((preset) => configKey(preset.config) === key) ?? null;
}

function configFromActiveGame(game: ActiveGame | null): MatchConfig | null {
  if (!game) return null;
  if (
    typeof game.actionTimeMs !== "number" ||
    typeof game.reserveTimeMs !== "number" ||
    typeof game.doubleDecisionTimeMs !== "number" ||
    typeof game.initialBetAmount !== "number"
  ) {
    return null;
  }

  return {
    gameType: "bg",
    actionTimeMs: game.actionTimeMs,
    reserveTimeMs: game.reserveTimeMs,
    doubleDecisionTimeMs: game.doubleDecisionTimeMs,
    initialBetAmount: game.initialBetAmount,
  };
}

function opponentFromGame(game: ActiveGame | null): string | null {
  if (!game) return null;
  if (game.currentUserId === game.player1Id) return game.player2Id;
  if (game.currentUserId === game.player2Id) return game.player1Id;
  return null;
}

function shortId(userId: string | null) {
  if (!userId) return "Unknown";
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
}

function deriveRematchOfferState(
  payload: RematchDirectionalPayload,
  myUserId: string | null | undefined,
  opponentUserId: string | null | undefined,
): RematchOfferState {
  const requester = payload.requesterUserId ?? null;
  const responder = payload.responderUserId ?? null;

  if (myUserId && opponentUserId) {
    if (requester === myUserId && responder === opponentUserId) {
      return "outgoing";
    }
    if (requester === opponentUserId && responder === myUserId) {
      return "incoming";
    }
    return "none";
  }

  if (payload.status === "incoming" || payload.status === "outgoing") {
    return payload.status;
  }

  return "none";
}

export default function BoardClient() {
  const router = useRouter();

  const [state, setState] = useState<MatchmakingState>("idle");
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [waitingConfig, setWaitingConfig] = useState<MatchConfig | null>(null);
  const [selectedMode, setSelectedMode] = useState<MatchMode | null>(null);

  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<PlayModalStage>("looking");

  const [lastGameResult, setLastGameResult] = useState<GameFinishedPayload | null>(null);
  const [opponentConnectedLive, setOpponentConnectedLive] = useState(false);
  const [rematchOfferState, setRematchOfferState] = useState<RematchOfferState>("none");

  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSendingRematchOffer, setIsSendingRematchOffer] = useState(false);
  const [isAcceptingRematch, setIsAcceptingRematch] = useState(false);

  const pollingRef = useRef<number | null>(null);
  const matchingIntroTimeoutRef = useRef<number | null>(null);
  const finishRefreshTimeoutRef = useRef<number | null>(null);
  const rematchPollingRef = useRef<number | null>(null);
  const startAttemptRef = useRef(0);

  const stateRef = useRef<MatchmakingState>("idle");
  const playModalOpenRef = useRef(false);
  const modalStageRef = useRef<PlayModalStage>("looking");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    playModalOpenRef.current = playModalOpen;
  }, [playModalOpen]);

  useEffect(() => {
    modalStageRef.current = modalStage;
  }, [modalStage]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const clearMatchingIntroTransition = useCallback(() => {
    if (matchingIntroTimeoutRef.current) {
      window.clearTimeout(matchingIntroTimeoutRef.current);
      matchingIntroTimeoutRef.current = null;
    }
  }, []);

  const clearFinishRefreshTimer = useCallback(() => {
    if (finishRefreshTimeoutRef.current) {
      window.clearTimeout(finishRefreshTimeoutRef.current);
      finishRefreshTimeoutRef.current = null;
    }
  }, []);

  const stopRematchPolling = useCallback(() => {
    if (rematchPollingRef.current) {
      window.clearInterval(rematchPollingRef.current);
      rematchPollingRef.current = null;
    }
  }, []);

  const handleOpponentPresenceChange = useCallback((connected: boolean) => {
    setOpponentConnectedLive(connected);
  }, []);

  const ignoreGameFinished = useCallback(() => {}, []);

  const setModeFromConfig = useCallback((config: MatchConfig | null) => {
    if (!config) return;
    const preset = presetForConfig(config);
    setSelectedMode({
      title: preset?.title ?? "CUSTOM",
      config,
    });
  }, []);

  const applyMatchedGame = useCallback(
    (
      game: ActiveGame,
      options: {
        openModal: boolean;
        showMatchingTransition: boolean;
      },
    ) => {
      setState("matched");
      setActiveGame(game);
      setWaitingConfig(null);
      stopPolling();
      stopRematchPolling();
      setRematchOfferState("none");
      setIsSendingRematchOffer(false);
      setIsAcceptingRematch(false);

      const gameConfig = configFromActiveGame(game);
      if (gameConfig) {
        setModeFromConfig(gameConfig);
      }

      if (!options.openModal) return;

      setPlayModalOpen(true);
      clearMatchingIntroTransition();

      if (options.showMatchingTransition) {
        setModalStage("matching");
        matchingIntroTimeoutRef.current = window.setTimeout(() => {
          setModalStage("playing");
          matchingIntroTimeoutRef.current = null;
        }, 3000);
      } else {
        setModalStage("playing");
      }
    },
    [clearMatchingIntroTransition, setModeFromConfig, stopPolling, stopRematchPolling],
  );

  const refreshStatus = useCallback(
    async (showToastOnFailure = false) => {
      try {
        const response = await fetch("/api/matchmaking/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load matchmaking status");

        const payload = (await response.json()) as StatusPayload;

        if (typeof payload.balance === "number") {
          setBalance(payload.balance);
        }

        if (payload.status === "matched" && payload.game) {
          if (modalStageRef.current === "game-over") {
            return payload;
          }
          const wasWaiting = stateRef.current === "waiting";
          const openModal = playModalOpenRef.current;
          applyMatchedGame(payload.game, {
            openModal,
            showMatchingTransition: openModal && wasWaiting,
          });
          return payload;
        }

        if (payload.status === "waiting") {
          setState("waiting");
          setActiveGame(null);
          setWaitingConfig(payload.config ?? null);

          const queuedConfig = payload.config;
          if (queuedConfig) {
            setSelectedMode((current) => {
              if (current) return current;
              const preset = presetForConfig(queuedConfig);
              return {
                title: preset?.title ?? "CUSTOM",
                config: queuedConfig,
              };
            });
          }

          if (playModalOpenRef.current) {
            clearMatchingIntroTransition();
            setModalStage("looking");
          }

          return payload;
        }

        setState("idle");
        setActiveGame(null);
        setWaitingConfig(null);

        if (playModalOpenRef.current && stateRef.current === "waiting") {
          setModalStage("looking");
        }

        return payload;
      } catch {
        const message = "Unable to load your game status";
        setError(message);
        if (showToastOnFailure) {
          toast.error(message);
        }
        return null;
      }
    },
    [applyMatchedGame, clearMatchingIntroTransition],
  );

  const pollRematchStatus = useCallback(async () => {
    if (!lastGameResult || modalStageRef.current !== "game-over") return;

    try {
      const response = await fetch(
        `/api/rematch/status?gameId=${lastGameResult.gameId}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;

      const payload = (await response.json()) as RematchStatusPayload;
      if (payload.status === "matched") {
        setLastGameResult(null);
        setRematchOfferState("none");
        setIsSendingRematchOffer(false);
        setIsAcceptingRematch(false);
        applyMatchedGame(payload.game, {
          openModal: true,
          showMatchingTransition: true,
        });
        return;
      }

      setRematchOfferState(
        deriveRematchOfferState(
          payload,
          lastGameResult.myUserId,
          lastGameResult.opponentUserId,
        ),
      );
    } catch {
      // keep local card state if rematch status polling fails
    }
  }, [applyMatchedGame, lastGameResult]);

  useEffect(() => {
    refreshStatus(true).catch(() => null);
  }, [refreshStatus]);

  useEffect(() => {
    if (state !== "waiting" || pollingRef.current) return;

    pollingRef.current = window.setInterval(() => {
      refreshStatus(false).catch(() => null);
    }, 2000);

    return stopPolling;
  }, [refreshStatus, state, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
      clearMatchingIntroTransition();
      clearFinishRefreshTimer();
      stopRematchPolling();
    };
  }, [
    clearFinishRefreshTimer,
    clearMatchingIntroTransition,
    stopPolling,
    stopRematchPolling,
  ]);

  useEffect(() => {
    if (modalStage !== "game-over" || !lastGameResult || !playModalOpen) {
      stopRematchPolling();
      return;
    }

    pollRematchStatus().catch(() => null);
    rematchPollingRef.current = window.setInterval(() => {
      pollRematchStatus().catch(() => null);
    }, 2000);

    return stopRematchPolling;
  }, [lastGameResult, modalStage, playModalOpen, pollRematchStatus, stopRematchPolling]);

  const startMatchmaking = useCallback(
    async (mode: MatchMode) => {
      const attemptId = startAttemptRef.current + 1;
      startAttemptRef.current = attemptId;
      setError(null);
      setIsStarting(true);
      stopRematchPolling();
      setRematchOfferState("none");
      setIsSendingRematchOffer(false);
      setIsAcceptingRematch(false);
      setPlayModalOpen(true);
      setModalStage("looking");

      const response = await fetch("/api/matchmaking/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode.config),
      });

      let payload: StartPayload = { status: "idle" };
      try {
        payload = (await response.json()) as StartPayload;
      } catch {
        payload = { status: "idle", error: "Unexpected response from server" };
      }

      if (attemptId !== startAttemptRef.current) {
        return;
      }

      if (!response.ok) {
        const message = payload.details
          ? `${payload.error}: ${payload.details}`
          : (payload.error ?? "Failed to start matchmaking");
        setError(message);

        if (payload.code === "ACTIVE_GAME_EXISTS" && payload.game) {
          applyMatchedGame(payload.game, {
            openModal: true,
            showMatchingTransition: false,
          });
          toast.error(
            "You already have an active board. Continue in the opened modal.",
          );
          setIsStarting(false);
          return;
        }

        if (payload.code === "MATCHMAKING_ALREADY_ACTIVE") {
          setState("waiting");
          setActiveGame(null);
          setWaitingConfig(payload.config ?? mode.config);
          setModeFromConfig(payload.config ?? mode.config);
          setModalStage("looking");
          toast.error("Matchmaking is already running. Cancel it before starting another.");
          setIsStarting(false);
          return;
        }

        toast.error(message);
        setIsStarting(false);
        return;
      }

      if (payload.status === "matched" && payload.game) {
        applyMatchedGame(payload.game, {
          openModal: true,
          showMatchingTransition: true,
        });
        if (!payload.game.currentUserId) {
          await refreshStatus(false);
        }
        setIsStarting(false);
        return;
      }

      clearMatchingIntroTransition();
      setState("waiting");
      setActiveGame(null);
      setWaitingConfig(payload.config ?? mode.config);
      setModeFromConfig(payload.config ?? mode.config);
      setModalStage("looking");
      setIsStarting(false);
    },
    [
      applyMatchedGame,
      clearMatchingIntroTransition,
      refreshStatus,
      setModeFromConfig,
      stopRematchPolling,
    ],
  );

  const cancelMatchmaking = useCallback(async () => {
    startAttemptRef.current += 1;
    setIsStarting(false);
    stopRematchPolling();
    setRematchOfferState("none");
    setIsSendingRematchOffer(false);
    setIsAcceptingRematch(false);
    setIsCancelling(true);
    try {
      const response = await fetch("/api/matchmaking/cancel", { method: "POST" });
      if (!response.ok) throw new Error("Unable to cancel matchmaking");

      setState("idle");
      setActiveGame(null);
      setWaitingConfig(null);
      setModalStage("looking");
      stopPolling();
      clearMatchingIntroTransition();
      setError(null);

      await refreshStatus(false);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  }, [clearMatchingIntroTransition, refreshStatus, stopPolling, stopRematchPolling]);

  const backToPortal = useCallback(() => {
    startAttemptRef.current += 1;
    setIsStarting(false);
    stopRematchPolling();
    setRematchOfferState("none");
    setIsSendingRematchOffer(false);
    setIsAcceptingRematch(false);
    clearMatchingIntroTransition();
    setPlayModalOpen(false);
    setModalStage("looking");
    setLastGameResult(null);
    setOpponentConnectedLive(false);
    setError(null);
    router.push("/my/play-online");
  }, [clearMatchingIntroTransition, router, stopRematchPolling]);

  const onSelectPreset = (preset: MatchPreset) => {
    setError(null);
    stopRematchPolling();
    setRematchOfferState("none");
    setIsSendingRematchOffer(false);
    setIsAcceptingRematch(false);
    setPlayModalOpen(true);

    if (state === "waiting") {
      setModalStage("looking");
      toast.error("Matchmaking is already running.");
      return;
    }

    if (state === "matched" && activeGame) {
      applyMatchedGame(activeGame, {
        openModal: true,
        showMatchingTransition: false,
      });
      return;
    }

    const mode: MatchMode = { title: preset.title, config: preset.config };
    setSelectedMode(mode);
    setModalStage("looking");

    if (balance != null && balance < preset.config.initialBetAmount) {
      const message = `Insufficient balance. Need ${preset.config.initialBetAmount} coins for ${preset.title}.`;
      setError(message);
      toast.error(message);
      return;
    }

    startMatchmaking(mode).catch(() => {
      setError("Failed to start matchmaking");
      toast.error("Failed to start matchmaking");
      setIsStarting(false);
    });
  };

  const handleGameFinished = useCallback(
    (payload: GameFinishedPayload) => {
      setLastGameResult(payload);
      setOpponentConnectedLive(payload.opponentConnected);
      setRematchOfferState("none");
      setIsSendingRematchOffer(false);
      setIsAcceptingRematch(false);
      setWaitingConfig(null);
      setActiveGame(null);
      setState("idle");
      setPlayModalOpen(true);
      setModalStage("game-over");
      stopPolling();
      stopRematchPolling();
      clearMatchingIntroTransition();
      clearFinishRefreshTimer();
      finishRefreshTimeoutRef.current = window.setTimeout(() => {
        refreshStatus(false).catch(() => null);
        finishRefreshTimeoutRef.current = null;
      }, 1200);
    },
    [
      clearFinishRefreshTimer,
      clearMatchingIntroTransition,
      refreshStatus,
      stopPolling,
      stopRematchPolling,
    ],
  );

  const requestRematch = useCallback(async () => {
    if (!lastGameResult) return;
    if (!opponentConnectedLive) {
      toast.error("Opponent left");
      return;
    }

    setIsSendingRematchOffer(true);
    try {
      const response = await fetch("/api/rematch/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: lastGameResult.gameId }),
      });

      const payload = (await response.json()) as {
        status?: "incoming" | "outgoing";
        requesterUserId?: string | null;
        responderUserId?: string | null;
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        const message = payload.details
          ? `${payload.error}: ${payload.details}`
          : (payload.error ?? "Unable to send rematch request");
        toast.error(message);
        return;
      }

      const nextState = deriveRematchOfferState(
        payload,
        lastGameResult.myUserId,
        lastGameResult.opponentUserId,
      );
      setRematchOfferState(nextState === "none" ? "outgoing" : nextState);
    } catch {
      toast.error("Unable to send rematch request");
    } finally {
      setIsSendingRematchOffer(false);
    }
  }, [lastGameResult, opponentConnectedLive]);

  const acceptRematch = useCallback(async () => {
    if (!lastGameResult) return;
    if (!opponentConnectedLive) {
      toast.error("Opponent left");
      return;
    }

    setIsAcceptingRematch(true);
    try {
      const response = await fetch("/api/rematch/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: lastGameResult.gameId }),
      });

      const payload = (await response.json()) as {
        status?: "matched";
        game?: ActiveGame;
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        const message = payload.details
          ? `${payload.error}: ${payload.details}`
          : (payload.error ?? "Unable to accept rematch");
        toast.error(message);
        return;
      }

      if (payload.status === "matched" && payload.game) {
        setLastGameResult(null);
        setRematchOfferState("none");
        setIsSendingRematchOffer(false);
        applyMatchedGame(payload.game, {
          openModal: true,
          showMatchingTransition: true,
        });
        return;
      }

      toast.error("Unexpected rematch response");
    } catch {
      toast.error("Unable to accept rematch");
    } finally {
      setIsAcceptingRematch(false);
    }
  }, [applyMatchedGame, lastGameResult, opponentConnectedLive]);

  const waitingPreset = useMemo(() => presetForConfig(waitingConfig), [waitingConfig]);
  const activeOpponent = useMemo(() => opponentFromGame(activeGame), [activeGame]);

  const modeTitle = selectedMode?.title ?? waitingPreset?.title ?? "CUSTOM";
  const modeConfig =
    selectedMode?.config ?? waitingConfig ?? configFromActiveGame(activeGame) ?? null;

  const activeBoardsCount = state === "matched" && activeGame ? 1 : 0;
  const activeBoardText =
    state === "matched" && activeGame
      ? `Board #${activeGame.id} vs ${shortId(activeOpponent)}`
      : "No active boards";

  const isOpponentConnected = Boolean(opponentConnectedLive);
  const isIncomingRematch = rematchOfferState === "incoming";
  const isOutgoingRematch = rematchOfferState === "outgoing";

  const rematchButtonLabel =
    isIncomingRematch ? "Accept rematch" : isOutgoingRematch ? "Rematch sent" : "Rematch";
  const rematchButtonDisabled =
    isSendingRematchOffer ||
    isAcceptingRematch ||
    isOutgoingRematch ||
    !isOpponentConnected;

  const rematchNoticeText = !isOpponentConnected
    ? "Opponent left"
    : isIncomingRematch
      ? "Opponent want's to rematch"
      : isOutgoingRematch
        ? "Waiting for opponent response"
        : null;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Online Matchmaking</CardDescription>
            <CardTitle className="text-xl">Play Online</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Status: {state === "waiting" ? "Looking for opponent" : state === "matched" ? "In game" : "Ready"}</p>
            <p>Balance: {balance ?? "-"} coins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>active boards</CardDescription>
            <CardTitle className="text-xl">{activeBoardsCount}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{activeBoardText}</p>
            {state === "matched" && activeGame && (
              <Button
                variant="outline"
                onClick={() => {
                  clearMatchingIntroTransition();
                  setPlayModalOpen(true);
                  setModalStage("playing");
                }}
              >
                Continue Board
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MATCH_PRESETS.map((preset) => (
          <Card key={preset.id}>
            <CardHeader>
              <CardTitle className="text-lg">{preset.title}</CardTitle>
              <CardDescription>{preset.subtitle}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => onSelectPreset(preset)}>
                Play now
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog
        open={playModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) return;
          setPlayModalOpen(nextOpen);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={
            modalStage === "playing"
              ? "max-h-[95vh] sm:max-w-[min(1200px,calc(100%-2rem))] !flex h-[95vh] !flex-col gap-3 p-3"
              : "sm:max-w-2xl"
          }
        >
          {modalStage === "looking" && (
            <>
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-2xl">LOOKING FOR OPPONENT</DialogTitle>
                <DialogDescription>
                  Mode <span className="font-semibold">{modeTitle}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 rounded-2xl border bg-muted/30 p-6">
                <p className="text-center text-xl">
                  LOOKING FOR <span className="font-bold">{modeTitle}</span> OPPONENT ...
                </p>
                <p className="text-center text-sm italic text-muted-foreground">
                  {state === "waiting" || isStarting
                    ? "You can cancel while matchmaking is still pending."
                    : "Click Play now to start searching."}
                </p>

                {modeConfig && (
                  <div className="mx-auto w-full max-w-md rounded-lg border bg-background p-3 text-sm">
                    <p>Bet: {modeConfig.initialBetAmount} coins</p>
                    <p>Action time: {Math.floor(modeConfig.actionTimeMs / 1000)}s</p>
                    <p>Reserve time: {Math.floor(modeConfig.reserveTimeMs / 1000)}s</p>
                  </div>
                )}

                {isStarting && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Starting matchmaking...
                  </div>
                )}

                {error && <p className="text-center text-sm text-red-600">{error}</p>}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  {state === "waiting" || isStarting ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        cancelMatchmaking().catch(() => null);
                      }}
                      disabled={isCancelling}
                      className="sm:w-[200px]"
                    >
                      {isCancelling ? "Cancelling..." : "Cancel"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          if (!selectedMode) return;
                          startMatchmaking(selectedMode).catch(() => {
                            setError("Failed to start matchmaking");
                            setIsStarting(false);
                          });
                        }}
                        disabled={!selectedMode || isStarting}
                        className="sm:w-[200px]"
                      >
                        Play now
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={backToPortal}
                        className="sm:w-[200px]"
                      >
                        Back to portal
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {modalStage === "matching" && (
            <>
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-2xl">MATCH FOUND</DialogTitle>
                <DialogDescription>
                  Preparing game session and final match setup
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 rounded-2xl border bg-muted/30 p-8">
                <p className="text-center text-xl">
                  MATCHING WITH <span className="font-bold">{modeTitle}</span> OPPONENT {activeOpponent ?? "unknown"}
                </p>
                <p className="text-center text-sm italic text-muted-foreground">can not cancel the game ...</p>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Opening backgammon table...
                </div>
              </div>
            </>
          )}

          {modalStage === "playing" && (
            <>
              <DialogHeader>
                <DialogTitle>Backgammon Match</DialogTitle>
                <DialogDescription>
                  {activeGame
                    ? `Game #${activeGame.id} vs ${activeOpponent ?? "unknown"}`
                    : "Loading active game"}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-white p-3">
                {state === "matched" && activeGame ? (
                  <BgGameProvider gameId={activeGame.id} onGameFinished={handleGameFinished} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading active board...
                  </div>
                )}
              </div>
            </>
          )}

          {modalStage === "game-over" && lastGameResult && (
            <>
              <div className="hidden">
                <BgGameProvider
                  gameId={lastGameResult.gameId}
                  onGameFinished={ignoreGameFinished}
                  onOpponentPresenceChange={handleOpponentPresenceChange}
                />
              </div>

              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-3xl">
                  {lastGameResult.didWin === true
                    ? "YOU WIN!"
                    : lastGameResult.didWin === false
                      ? "YOU LOST"
                      : "GAME OVER"}
                </DialogTitle>
                <DialogDescription>
                  Opponent: {shortId(lastGameResult.opponentUserId)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 rounded-2xl border bg-muted/30 p-6">
                {lastGameResult.didWin === true ? (
                  <p className="text-center text-base leading-7">
                    <span className="font-semibold">Winning rewards:</span> {lastGameResult.payoutAmount} coins
                    <br />
                    Your coins are being deposited to your gaming account.
                  </p>
                ) : (
                  <p className="text-center text-base leading-7">Try your luck next time ...</p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() => {
                      if (isIncomingRematch) {
                        acceptRematch().catch(() => null);
                        return;
                      }
                      if (!isOutgoingRematch) {
                        requestRematch().catch(() => null);
                      }
                    }}
                    disabled={rematchButtonDisabled}
                    className={rematchButtonDisabled ? "bg-zinc-300 text-zinc-600 hover:bg-zinc-300" : ""}
                  >
                    {isAcceptingRematch
                      ? "Accepting..."
                      : isSendingRematchOffer
                        ? "Sending..."
                        : rematchButtonLabel}
                  </Button>
                  <Button variant="secondary" onClick={backToPortal}>
                    Back to portal
                  </Button>
                </div>

                {rematchNoticeText && (
                  <p
                    className={
                      isIncomingRematch || !isOpponentConnected
                        ? "text-center text-sm font-semibold text-red-600"
                        : "text-center text-sm text-muted-foreground"
                    }
                  >
                    {rematchNoticeText}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
