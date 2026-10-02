import { americanFootball } from "./american-football";
import { flagFootball } from "./flag-football";
import type { SportId, SportModule } from "./types";

export const sports: Record<SportId, SportModule> = {
  "american-football": americanFootball,
  "flag-football": flagFootball,
};

export const sportOrder: SportId[] = ["american-football", "flag-football"];

export { americanFootball, flagFootball };
export { combineTests, generalTests } from "./combine";
export type * from "./types";
