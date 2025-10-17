type CheckerColor = "b" | "w";

export type Cell = {
  id: string;
  checkers: CheckerColor[];
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

export const defaultBoardData = { topCells, bottomCells };
