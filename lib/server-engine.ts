export type EngineCreateMatchResponse = {
  match_id: string;
  status: string;
};

export type EngineIssueTokenResponse = {
  token: string;
  expires_at: number;
};

export type EngineDeleteMatchResponse = {
  match_id: string;
  status: string;
};

export type EngineMatchConfig = {
  game_type?: string;
  action_time_ms: number;
  reserve_time_ms: number;
  double_decision_time_ms: number;
  initial_bet_amount: number;
  current_bet_amount: number;
  bank_amount: number;
  payout_percent: number;
};

export class EngineHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "EngineHttpError";
    this.status = status;
    this.body = body;
  }
}

function engineBaseUrl() {
  const host = process.env.ENGINE_HOST ?? "127.0.0.1";
  const port = process.env.ENGINE_PORT ?? "3300";
  return `http://${host}:${port}`;
}

function requiredInternalApiKey() {
  const key = process.env.ENGINE_INTERNAL_API_KEY;
  if (!key) throw new Error("Missing ENGINE_INTERNAL_API_KEY");
  return key;
}

export async function createEngineMatch(
  player1Id: string,
  player2Id: string,
  config: EngineMatchConfig,
) {
  const response = await fetch(`${engineBaseUrl()}/internal/matches`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": requiredInternalApiKey(),
    },
    body: JSON.stringify({
      player1_id: player1Id,
      player2_id: player2Id,
      ...config,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EngineHttpError(
      `Engine create match failed (${response.status}): ${text}`,
      response.status,
      text,
    );
  }

  return (await response.json()) as EngineCreateMatchResponse;
}

export async function issueEngineToken(matchId: string, userId: string) {
  const response = await fetch(`${engineBaseUrl()}/internal/matches/${matchId}/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": requiredInternalApiKey(),
    },
    body: JSON.stringify({ user_id: userId, ttl_seconds: 120 }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EngineHttpError(
      `Engine issue token failed (${response.status}): ${text}`,
      response.status,
      text,
    );
  }

  return (await response.json()) as EngineIssueTokenResponse;
}

export async function deleteEngineMatch(matchId: string) {
  const response = await fetch(`${engineBaseUrl()}/internal/matches/${matchId}`, {
    method: "DELETE",
    headers: {
      "x-internal-api-key": requiredInternalApiKey(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EngineHttpError(
      `Engine delete match failed (${response.status}): ${text}`,
      response.status,
      text,
    );
  }

  return (await response.json()) as EngineDeleteMatchResponse;
}

export function buildEngineWsUrl(token: string) {
  const host = process.env.ENGINE_HOST ?? "127.0.0.1";
  const port = process.env.ENGINE_PORT ?? "3300";
  return `ws://${host}:${port}/ws?token=${encodeURIComponent(token)}`;
}
