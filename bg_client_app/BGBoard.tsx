"use client";

import {
  DndContext,
  DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { useState } from "react";
import BoardCell from "./BoardCell";
import { BoardData, Cell } from "@/lib/bg_data/defBoardData";

function DroppableCells({
  cell,
  level,
  className,
}: {
  cell: Cell;
  className?: string;
  level: "top" | "bot";
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cell.id });
  return (
    <BoardCell
      ref={setNodeRef}
      cellData={cell}
      level={level}
      className={`${className || ""} ${isOver ? "bg-gray-300" : ""}`}
    />
  );
}

export default function BGBoard({ boardData }: { boardData: BoardData }) {
  const [boardState, setBoardState] = useState<BoardData>(boardData);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  function updateBoardState(
    startingCell: UniqueIdentifier,
    endingCell: UniqueIdentifier,
    color: "b" | "w"
  ) {
    const newState = boardState.map((cell) => {
      if (cell.id === startingCell.toString()) {
        cell.checkers--;
      }
      if (cell.id === endingCell.toString()) {
        cell.checkers++;
        cell.occupation = color;
      }
      if (cell.checkers == 0) {
        cell.occupation = null;
      } else {
      }

      return cell;
    });

    console.log(startingCell);
    setBoardState(newState);
  }

  function handleDragEnd(event: DragEndEvent) {
    const startingCell = event.active.id;
    const endingCell = event.over?.id;
    const color = event.active.data.current?.color;
    if (startingCell && endingCell && color)
      updateBoardState(startingCell, endingCell, color);
    console.log(color);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="border border-blue-500 h-full max-h-full select-none touch-none">
        <ul className="grid grid-cols-12 w-full h-full bg-board gap-1">
          {boardState.map((cell, i) => {
            const level = i < 12 ? "top" : "bot";
            return <DroppableCells key={cell.id} cell={cell} level={level} />;
          })}
        </ul>
      </div>
    </DndContext>
  );
}
