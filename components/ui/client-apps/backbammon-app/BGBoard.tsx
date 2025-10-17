"use client";

// import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import BoardCell from "./BoardCell";
import BoardChecker from "./BoardChecker";

type CheckerColor = "b" | "w";

type Cell = {
  id: string;
  checkers: CheckerColor[];
};

type BoardState = {
  topCells: Cell[];
  bottomCells: Cell[];
};

const topCells: Cell[] = [
  { id: "c1", checkers: ["b", "b"] },
  { id: "c2", checkers: [] },
  { id: "c3", checkers: [] },
  { id: "c4", checkers: [] },
  { id: "c5", checkers: [] },
  { id: "c6", checkers: ["w", "w", "w", "w", "w"] },
  { id: "c7", checkers: [] },
  { id: "c8", checkers: ["w", "w", "w"] },
  { id: "c9", checkers: [] },
  { id: "c10", checkers: [] },
  { id: "c11", checkers: [] },
  { id: "c12", checkers: ["b", "b", "b", "b", "b"] },
];
const bottomCells: Cell[] = [
  { id: "c13", checkers: ["w", "w", "w", "w", "w"] },
  { id: "c14", checkers: [] },
  { id: "c15", checkers: [] },
  { id: "c16", checkers: [] },
  { id: "c17", checkers: ["b", "b", "b"] },
  { id: "c18", checkers: [] },
  { id: "c19", checkers: ["b", "b", "b", "b", "b"] },
  { id: "c20", checkers: [] },
  { id: "c21", checkers: [] },
  { id: "c22", checkers: [] },
  { id: "c23", checkers: [] },
  { id: "c24", checkers: ["w", "w"] },
];

export default function BGBoard() {
  const [boardState, setBoardState] = useState<BoardState>({
    topCells,
    bottomCells,
  });
  return (
    <div className="border border-blue-500 max-h-full h-full">
      <ul className="grid grid-cols-12 w-full h-1/2 direction-rtl gap-1">
        {boardState.topCells.map((cell) => (
          <BoardCell key={cell.id} id={cell.id}>
            {cell.checkers.map((ch, i) => (
              <BoardChecker key={i} color={ch} />
            ))}
          </BoardCell>
        ))}
      </ul>
      <ul className="grid grid-cols-12 w-full h-1/2 gap-1">
        {boardState.bottomCells.map((cell) => (
          <BoardCell key={cell.id} id={cell.id} className="justify-end">
            {cell.checkers.map((ch, i) => (
              <BoardChecker key={i} color={ch} />
            ))}
          </BoardCell>
        ))}
      </ul>
    </div>
  );
}
