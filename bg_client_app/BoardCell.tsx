"use client";

import { forwardRef } from "react";
import type { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Cell } from "@/lib/bg_data/defBoardData";

type BoardCellProps = {
  cellData: Cell;
  level: "top" | "bot";
  className?: string;
  draggable?: boolean;
  dropTarget?: boolean;
  selectedSource?: boolean;
  animateSource?: boolean;
  animateTarget?: boolean;
  checkerCanInteract?: boolean;
  onCellClick?: () => void;
  onTopCheckerClick?: () => void;
  onTopCheckerDoubleClick?: () => void;
};

function numericCellId(cellId: string): number | null {
  if (!cellId.startsWith("c")) return null;
  const parsed = Number(cellId.slice(1));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) return null;
  return parsed;
}

function checkerTone(color: "b" | "w") {
  if (color === "w") return "bg-white border-zinc-300 text-zinc-700";
  return "bg-zinc-900 border-zinc-600 text-zinc-100";
}

function DraggableChecker({
  color,
  id,
  disabled,
  selected,
  interactive,
  onClick,
  onDoubleClick,
}: {
  color: "b" | "w";
  id: string;
  disabled: boolean;
  selected: boolean;
  interactive: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { color },
    disabled,
  });

  const style: CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(event) => {
        event.stopPropagation();
        if (!interactive) return;
        onClick?.();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!interactive) return;
        onDoubleClick?.();
      }}
      className={[
        "size-7 rounded-full border shadow-sm transition-all duration-150",
        checkerTone(color),
        selected ? "ring-2 ring-blue-500 ring-offset-1" : "",
        disabled ? "cursor-default opacity-95" : "cursor-grab active:cursor-grabbing",
        interactive ? "hover:brightness-105" : "",
      ].join(" ")}
      style={style}
    />
  );
}

function DummyChecker({ color }: { color: "b" | "w" }) {
  return <div className={`size-7 rounded-full border shadow-sm ${checkerTone(color)}`} />;
}

function Checkers({
  cellData,
  draggable,
  selectedSource,
  checkerCanInteract,
  onTopCheckerClick,
  onTopCheckerDoubleClick,
}: {
  cellData: Cell;
  draggable: boolean;
  selectedSource: boolean;
  checkerCanInteract: boolean;
  onTopCheckerClick?: () => void;
  onTopCheckerDoubleClick?: () => void;
}) {
  const { id, occupation, checkers } = cellData;
  if (occupation === null || checkers <= 0) return null;

  return (
    <>
      <DraggableChecker
        color={occupation}
        id={id}
        disabled={!draggable}
        selected={selectedSource}
        interactive={checkerCanInteract}
        onClick={onTopCheckerClick}
        onDoubleClick={onTopCheckerDoubleClick}
      />
      {Array.from({ length: checkers - 1 }).map((_, index) => (
        <DummyChecker key={`${id}-checker-${index}`} color={occupation} />
      ))}
    </>
  );
}

const BoardCell = forwardRef<HTMLLIElement, BoardCellProps>(
  (
    {
      className,
      cellData,
      level,
      draggable = false,
      dropTarget = false,
      selectedSource = false,
      animateSource = false,
      animateTarget = false,
      checkerCanInteract = false,
      onCellClick,
      onTopCheckerClick,
      onTopCheckerDoubleClick,
    },
    ref,
  ) => {
    const dirLayout = level === "top" ? "flex-col-reverse justify-end" : "flex-col justify-end";
    const numeric = numericCellId(cellData.id) ?? 1;
    const isEven = numeric % 2 === 0;

    return (
      <li
        ref={ref}
        id={cellData.id}
        onClick={onCellClick}
        className={[
          "relative flex w-full items-center gap-0.5 overflow-hidden border border-zinc-300 px-1 py-0.5 transition-colors",
          dirLayout,
          isEven ? "bg-zinc-50" : "bg-white",
          dropTarget ? "bg-emerald-100/90" : "",
          selectedSource ? "bg-blue-100/80" : "",
          animateSource ? "animate-pulse bg-amber-100" : "",
          animateTarget ? "animate-pulse bg-emerald-200" : "",
          className ?? "",
        ].join(" ")}
      >
        <Checkers
          cellData={cellData}
          draggable={draggable}
          selectedSource={selectedSource}
          checkerCanInteract={checkerCanInteract}
          onTopCheckerClick={onTopCheckerClick}
          onTopCheckerDoubleClick={onTopCheckerDoubleClick}
        />
      </li>
    );
  },
);

BoardCell.displayName = "BoardCell";
export default BoardCell;
