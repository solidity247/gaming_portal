// components/ui/client-apps/backgammon-app/BGBoardWrapper.tsx
"use client";

import dynamic from "next/dynamic";
import { defaultBoardData } from "@/lib/bg_data/defBoardData";

const BGBoardClient = dynamic(
  () => import("./BGBoard"), // must point to actual BGBoard.tsx file
  { ssr: false }
);

export default function BGBoardWrapper() {
  return <BGBoardClient boardData={defaultBoardData} />;
}
