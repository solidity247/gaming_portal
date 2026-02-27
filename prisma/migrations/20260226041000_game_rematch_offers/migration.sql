CREATE TABLE "game_rematch_offers" (
  "id" SERIAL NOT NULL,
  "game_id" INTEGER NOT NULL,
  "requester_user_id" TEXT NOT NULL,
  "responder_user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "game_rematch_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_rematch_offers_game_id_key" ON "game_rematch_offers"("game_id");

CREATE INDEX "game_rematch_offers_requester_status_idx"
ON "game_rematch_offers"("requester_user_id", "status");

CREATE INDEX "game_rematch_offers_responder_status_idx"
ON "game_rematch_offers"("responder_user_id", "status");

ALTER TABLE "game_rematch_offers"
ADD CONSTRAINT "game_rematch_offers_game_id_fkey"
FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
