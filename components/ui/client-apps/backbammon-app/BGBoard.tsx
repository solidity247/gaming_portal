"use client";

// import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import BoardCell from "./BoardCell";
import BoardChecker from "./BoardChecker";
import { Cell } from "@/lib/bg_data/defBoardData";

type BoardState = {
  topCells: Cell[];
  bottomCells: Cell[];
};

export default function BGBoard({ boardData }: { boardData: BoardState }) {
  const [boardState, setBoardState] = useState<BoardState>(boardData);
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
