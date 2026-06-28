/** Target ~15–25s total demo replay when external APIs are Redis-cached. */
const STAGE_DELAYS_MS = {
  gather: 4_500,
  extract: 5_000,
  match: 3_500,
  score: 3_000,
  memo: 3_500,
  enrichKickoff: 2_000,
} as const;

export type WarmStage = keyof typeof STAGE_DELAYS_MS;

export function warmStageDelayMs(stage: WarmStage): number {
  return STAGE_DELAYS_MS[stage];
}

export async function paceWarmStage(stage: WarmStage): Promise<void> {
  const ms = STAGE_DELAYS_MS[stage];
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function totalWarmPaceBudgetMs(): number {
  return Object.values(STAGE_DELAYS_MS).reduce((sum, n) => sum + n, 0);
}
