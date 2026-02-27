-- AlterTable
ALTER TABLE "games"
ADD COLUMN "engine_match_id" TEXT,
ADD COLUMN "finished_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "games_engine_match_id_key" ON "games"("engine_match_id");

-- CreateTable
CREATE TABLE "matchmaking_queue" (
  "id" SERIAL NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "matchmaking_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matchmaking_queue_user_id_key" ON "matchmaking_queue"("user_id");
