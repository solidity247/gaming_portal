"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  id: number;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  createdAt: string;
  finishedAt: string | null;
  result: "win" | "loss" | "draw";
};

export default function GameHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch("/api/game/history", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load history");
        const payload = (await response.json()) as { items: HistoryItem[] };
        setItems(payload.items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    run().catch(() => setError("Unable to load history"));
  }, []);

  if (loading) return <div className="p-4">Loading game history...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!items.length) return <div className="p-4">No finished games yet.</div>;

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Game History</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2">Game</th>
              <th className="px-3 py-2">Players</th>
              <th className="px-3 py-2">Winner</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Finished At</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">#{item.id}</td>
                <td className="px-3 py-2">
                  {item.player1Id.slice(0, 8)}... vs {item.player2Id.slice(0, 8)}...
                </td>
                <td className="px-3 py-2">{item.winnerId ? `${item.winnerId.slice(0, 8)}...` : "N/A"}</td>
                <td className="px-3 py-2 uppercase">{item.result}</td>
                <td className="px-3 py-2">
                  {item.finishedAt ? new Date(item.finishedAt).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
