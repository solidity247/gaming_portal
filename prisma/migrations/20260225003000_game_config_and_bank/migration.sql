-- AlterTable
ALTER TABLE "games"
ADD COLUMN "game_type" TEXT NOT NULL DEFAULT 'bg',
ADD COLUMN "action_time_ms" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN "reserve_time_ms" INTEGER NOT NULL DEFAULT 45000,
ADD COLUMN "double_decision_time_ms" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN "initial_bet_amount" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "current_bet_amount" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "bank_amount" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "payout_percent" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN "payout_amount" INTEGER;

-- AlterTable
ALTER TABLE "matchmaking_queue"
ADD COLUMN "game_type" TEXT NOT NULL DEFAULT 'bg',
ADD COLUMN "action_time_ms" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN "reserve_time_ms" INTEGER NOT NULL DEFAULT 45000,
ADD COLUMN "double_decision_time_ms" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN "initial_bet_amount" INTEGER NOT NULL DEFAULT 10;

-- CreateIndex
CREATE INDEX "matchmaking_queue_config_created_idx"
ON "matchmaking_queue"(
  "game_type",
  "action_time_ms",
  "reserve_time_ms",
  "double_decision_time_ms",
  "initial_bet_amount",
  "created_at"
);
