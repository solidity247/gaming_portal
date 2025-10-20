"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { randomDiceValue } from "./utils/randomUtil";

type RollStartModuloProps = {
  onFinish: React.Dispatch<React.SetStateAction<"w" | "b" | null>>;
};

export default function RollStartModulo({ onFinish }: RollStartModuloProps) {
  const [open, setOpen] = useState(true);
  const [p1, setP1] = useState<number | null>(null);
  const [p2, setP2] = useState<number | null>(null);
  const [rolling, setRolling] = useState(true);

  // automatically roll until there is a winner
  useEffect(() => {
    if (!rolling) return;

    const roll = () => {
      const d1 = randomDiceValue();
      const d2 = randomDiceValue();
      setP1(d1);
      setP2(d2);

      if (d1 === d2) {
        // if equal, reroll after short delay
        setTimeout(roll, 1200);
      } else {
        // winner decided
        const winner = d1 > d2 ? "w" : "b";
        setRolling(false);

        // small delay for visual feedback
        setTimeout(() => {
          setOpen(false);
          onFinish(winner);
        }, 1800);
      }
    };

    roll();
  }, [rolling, onFinish]);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm text-center select-none">
        <DialogHeader>
          <DialogTitle>Rolling for Start</DialogTitle>
          <DialogDescription>
            Both players are rolling dice to decide who begins.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-around items-center py-4">
          <div>
            <p className="text-sm font-medium">Player 1 (White)</p>
            <div className="text-4xl transition-all duration-300">
              {p1 ?? "-"}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Player 2 (Black)</p>
            <div className="text-4xl transition-all duration-300">
              {p2 ?? "-"}
            </div>
          </div>
        </div>

        {p1 !== null && p2 !== null && p1 === p2 && (
          <p className="text-xs text-muted-foreground">
            Draw — rolling again...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
