export type Cell = {
  id: string;
  occupation: "b" | "w" | null;
  checkers: number;
};

export type BoardData = Cell[];

export const defaultBoardData: BoardData = [
  {
    id: "c1",
    occupation: "b",
    checkers: 2,
  },
  { id: "c2", occupation: null, checkers: 0 },
  { id: "c3", occupation: null, checkers: 0 },
  { id: "c4", occupation: null, checkers: 0 },
  { id: "c5", occupation: null, checkers: 0 },
  {
    id: "c6",
    occupation: "w",
    checkers: 5,
  },
  { id: "c7", occupation: null, checkers: 0 },
  {
    id: "c8",
    occupation: "w",
    checkers: 3,
  },
  { id: "c9", occupation: null, checkers: 0 },
  { id: "c10", occupation: null, checkers: 0 },
  { id: "c11", occupation: null, checkers: 0 },
  {
    id: "c12",
    occupation: "b",
    checkers: 5,
  },
  {
    id: "c13",
    occupation: "w",
    checkers: 5,
  },
  { id: "c14", occupation: null, checkers: 0 },
  { id: "c15", occupation: null, checkers: 0 },
  { id: "c16", occupation: null, checkers: 0 },
  {
    id: "c17",
    occupation: "b",
    checkers: 3,
  },
  { id: "c18", occupation: null, checkers: 0 },
  {
    id: "c19",
    occupation: "b",
    checkers: 5,
  },
  { id: "c20", occupation: null, checkers: 0 },
  { id: "c21", occupation: null, checkers: 0 },
  { id: "c22", occupation: null, checkers: 0 },
  { id: "c23", occupation: null, checkers: 0 },
  {
    id: "c24",
    occupation: "w",
    checkers: 2,
  },
];
