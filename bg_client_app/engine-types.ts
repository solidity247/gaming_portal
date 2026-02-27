export type EngineColor = "white" | "black";

export type EnginePosition = {
  points: number[];
  bar_white: number;
  bar_black: number;
  off_white: number;
  off_black: number;
};

export type EngineMoveOption = {
  die: number;
  from: number;
  to: number;
  hit: boolean;
  bear_off: boolean;
};

export type EngineDoubleOffer = {
  initiator_user_id: string;
  responder_user_id: string;
  initiator_color: EngineColor;
  offered_at_ms: number;
  expires_at_ms: number;
  increment_amount: number;
  proposed_bet_amount: number;
};

export type EngineMatchState = {
  match_id: string;
  white_user_id: string;
  black_user_id: string;
  status: "in_progress" | "finished" | string;
  phase: "opening_roll" | "in_progress" | "finished" | string;
  version: number;
  turn: EngineColor;
  roll: number[];
  dice: number[];
  legal_moves: EngineMoveOption[];
  winner_color: EngineColor | null;
  winner_user_id: string | null;
  position: EnginePosition;
  action_time_ms: number;
  total_reserve_time_ms: number;
  white_reserve_ms: number;
  black_reserve_ms: number;
  turn_started_at_ms: number;
  double_decision_time_ms: number;
  initial_bet_amount: number;
  current_bet_amount: number;
  bank_amount: number;
  payout_percent: number;
  opening_roll_white: number | null;
  opening_roll_black: number | null;
  double_offer: EngineDoubleOffer | null;
  updated_at: number;
};

export type EngineSnapshotMessage = {
  type: "snapshot";
  state: EngineMatchState;
  you: string;
  role: EngineColor;
};

export type EngineStateUpdateMessage = {
  type: "state_update";
  state: EngineMatchState;
  actor_user_id: string;
  action: unknown;
};

export type EnginePresenceMessage = {
  type: "presence";
  event: "joined" | "left" | string;
  user_id: string;
  role?: EngineColor;
};

export type EngineErrorMessage = {
  type: "error";
  message: string;
};

export type EnginePongMessage = {
  type: "pong";
};

export type EngineWsMessage =
  | EngineSnapshotMessage
  | EngineStateUpdateMessage
  | EnginePresenceMessage
  | EngineErrorMessage
  | EnginePongMessage;
