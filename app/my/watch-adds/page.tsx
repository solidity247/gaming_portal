"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const WATCH_SECONDS = 5;
const AD_REWARD_COINS = 100;

type AccountSummaryResponse = {
  balance: number;
  currentGameId: number | null;
};

type ClaimResponse = {
  status: string;
  credited: number;
  balance: number;
};

export default function WatchAddsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WATCH_SECONDS);
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetch("/api/account/summary", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load account summary");
        const payload = (await response.json()) as AccountSummaryResponse;
        setBalance(payload.balance);
        setCurrentGameId(payload.currentGameId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingSummary(false);
      }
    };

    loadSummary().catch(() => setError("Unable to load account summary"));
  }, []);

  useEffect(() => {
    if (!modalOpen || canClaim) return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setCanClaim(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [modalOpen, canClaim]);

  const openAdModal = () => {
    setError(null);
    setSecondsLeft(WATCH_SECONDS);
    setCanClaim(false);
    setModalOpen(true);
  };

  const claimReward = async () => {
    if (!canClaim || isClaiming) return;

    setIsClaiming(true);
    setError(null);
    try {
      const response = await fetch("/api/account/claim-ad-reward", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Unable to claim ad reward");
      const payload = (await response.json()) as ClaimResponse;

      setBalance(payload.balance);
      setModalOpen(false);
      setSecondsLeft(WATCH_SECONDS);
      setCanClaim(false);
      toast.success(`Claimed ${payload.credited} coins`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setIsClaiming(false);
    }
  };

  if (loadingSummary) return <div className="p-4">Loading watch adds...</div>;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Watch Adds</CardTitle>
          <CardDescription>Watch a mock add and claim reward coins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Balance: {balance ?? 0} coins</p>
          <p>Active Board: {currentGameId ? `#${currentGameId}` : "No active board"}</p>
          <Button onClick={openAdModal}>Show Me Add</Button>
          {error && <p className="text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          setModalOpen(nextOpen);
          if (!nextOpen) {
            setSecondsLeft(WATCH_SECONDS);
            setCanClaim(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mock Add Watching</DialogTitle>
            <DialogDescription>
              By watching the ADD you are earning {AD_REWARD_COINS} coins.
            </DialogDescription>
          </DialogHeader>

          {!canClaim ? (
            <p className="text-sm">Countdown timer: {secondsLeft} seconds</p>
          ) : (
            <p className="text-sm">Add completed. You can claim your reward now.</p>
          )}

          <DialogFooter>
            {canClaim && (
              <Button onClick={claimReward} disabled={isClaiming}>
                {isClaiming ? "Claiming..." : `Claim ${AD_REWARD_COINS} coins`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
