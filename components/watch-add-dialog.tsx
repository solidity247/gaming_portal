"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import { DialogHeader, DialogFooter } from "./ui/dialog";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimCoinsForAdds } from "@/app/my/watch-adds/actions";

const WATCH_SECONDS = 5;
const AD_REWARD_COINS = 100;

export default function WatchAddDialog() {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WATCH_SECONDS);
  const [canClaim, setCanClaim] = useState(false);
  const [isPending, startTransition] = useTransition();

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
    setSecondsLeft(WATCH_SECONDS);
    setCanClaim(false);
    setModalOpen(true);
  };

  const claimReward = () => {
    startTransition(async () => {
      await claimCoinsForAdds(123);

      // ✅ force Server Components to re-render
      router.refresh();

      // optional UX:
      setModalOpen(false);
      setSecondsLeft(WATCH_SECONDS);
      setCanClaim(false);
    });
  };

  return (
    <>
      <Button onClick={openAdModal}>Show Me Ad</Button>

      <DialogPrimitive.Root
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          setModalOpen(nextOpen);
          if (!nextOpen) {
            setSecondsLeft(WATCH_SECONDS);
            setCanClaim(false);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay />
          <DialogPrimitive.Content>
            <DialogHeader>
              <DialogPrimitive.Title>Mock Ad Watching</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                By watching the ad you are earning {AD_REWARD_COINS} coins.
              </DialogPrimitive.Description>
            </DialogHeader>

            {!canClaim ? (
              <p className="text-sm">Countdown timer: {secondsLeft} seconds</p>
            ) : (
              <p className="text-sm">
                Ad completed. You can claim your reward now.
              </p>
            )}

            <DialogFooter>
              {canClaim && (
                <Button onClick={claimReward} disabled={isPending}>
                  {isPending ? "Claiming..." : `Claim ${AD_REWARD_COINS} coins`}
                </Button>
              )}
            </DialogFooter>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
