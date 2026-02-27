"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccountSummaryResponse = {
  balance: number;
  currentGameId: number | null;
};

export default function AccountPage() {
  const [summary, setSummary] = useState<AccountSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetch("/api/account/summary", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load account summary");
        const payload = (await response.json()) as AccountSummaryResponse;
        setSummary(payload);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadSummary().catch(() => setError("Unable to load account summary"));
  }, []);

  if (loading) return <div className="p-4">Loading account...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your current player wallet and runtime status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Balance: {summary?.balance ?? 0} coins</p>
          <p>
            Active Board: {summary?.currentGameId ? `#${summary.currentGameId}` : "No active board"}
          </p>
        </CardContent>
      </Card>

      <Button asChild>
        <Link href="/my/watch-adds">Go To Watch Adds</Link>
      </Button>
    </div>
  );
}
