"use client";

import { forwardRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Cell } from "@/lib/bg_data/defBoardData";

type BoardCellProps = {
  cellData: Cell;
  level: "top" | "bot";
  className?: string;
};

function DraggableChecker({ color, id }: { color: "b" | "w"; id: string }) {
  const bgColor = color === "w" ? "bg-white" : "bg-black";
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { color },
  });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  return (
    <div
      className={`${bgColor} w-[40px] h-[40px] rounded-full border border-gray-700 text-red-500`}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
    >
      D
    </div>
  );
}

function DummyChecker({ color }: { color: "b" | "w" }) {
  const bgColor = color === "w" ? "bg-white" : "bg-black";
  return (
    <div
      className={`${bgColor} w-[40px] h-[40px] rounded-full border border-gray-700 `}
    />
  );
}
function Checkers({ cellData }: { cellData: Cell }) {
  const { id, occupation, checkers } = cellData;
  if (occupation === null) return;
  return (
    <>
      {<DraggableChecker color={occupation} id={id} />}
      {Array.from({ length: checkers - 1 }).map((_, i) => (
        <DummyChecker key={i} color={occupation} />
      ))}
    </>
  );
}

const BoardCell = forwardRef<HTMLLIElement, BoardCellProps>(
  ({ className, cellData, level }, ref) => {
    const dirLayout = level === "top" ? "flex-col-reverse" : "flex-col";
    const { id } = cellData;
    return (
      <li
        ref={ref}
        id={id}
        className={`flex ${dirLayout} items-center justify-end border border-gray-400 gap-0.5 w-full h-full ${
          className || ""
        }`}
      >
        <Checkers cellData={cellData} />
      </li>
    );
  }
);

BoardCell.displayName = "BoardCell";
export default BoardCell;
