type MatchConfig = {
  gameType: "bg";
  actionTimeMs: number;
  reserveTimeMs: number;
  doubleDecisionTimeMs: number;
  initialBetAmount: number;
};

type MatchPresetId = "light-weight" | "confident" | "master" | "quick-gonzales";

export type MatchPreset = {
  id: MatchPresetId;
  title: "LIGHT WEIGHT" | "CONFIDENT" | "MASTER" | "QUICK GONZALES";
  subtitle: string;
  config: MatchConfig;
};

export const MATCH_PRESETS: MatchPreset[] = [
  {
    id: "light-weight",
    title: "LIGHT WEIGHT",
    subtitle: "BET 100 | TIME 5 + 45 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 45_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 100,
    },
  },
  {
    id: "confident",
    title: "CONFIDENT",
    subtitle: "BET 500 | TIME 5 + 45 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 45_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 500,
    },
  },
  {
    id: "master",
    title: "MASTER",
    subtitle: "BET 200 | TIME 5 + 30 | DOUBLE 8",
    config: {
      gameType: "bg",
      actionTimeMs: 5_000,
      reserveTimeMs: 30_000,
      doubleDecisionTimeMs: 8_000,
      initialBetAmount: 200,
    },
  },
  {
    id: "quick-gonzales",
    title: "QUICK GONZALES",
    subtitle: "BET 500 | TIME 3 + 15 | DOUBLE 5",
    config: {
      gameType: "bg",
      actionTimeMs: 3_000,
      reserveTimeMs: 15_000,
      doubleDecisionTimeMs: 5_000,
      initialBetAmount: 500,
    },
  },
];
