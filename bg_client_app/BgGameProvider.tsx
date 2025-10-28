"use client";

import dynamic from "next/dynamic";

const BGBoardClient = dynamic(() => import("./BgGame"), { ssr: false });

export default function BgGameProvider() {
  return <BGBoardClient />;
}
