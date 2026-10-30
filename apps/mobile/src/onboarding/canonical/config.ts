import { DEV_BYPASS_PAYWALL, ONBOARDING_V4_ENABLED } from '../../config/devFlags';
import { isEatHealthierStage2PreviewEnabled } from '../../onboarding-v3/state/eatHealthierStage2Preview';
import { isHitMacrosStage2PreviewEnabled } from '../../onboarding-v3/state/hitMacrosStage2Preview';
import { isSaveMoneyStage2PreviewEnabled } from '../../onboarding-v3/state/saveMoneyStage2Preview';

/**
 * Read-only compatibility configuration for the restored V3 runtime. It does
 * not introduce a new experiment or change any release behavior; it simply
 * gives the canonical entry point one documented place to inspect existing
 * gates while the old implementations remain in the repository.
 */
export const canonicalOnboardingConfig = Object.freeze({
  version: 'legacy-v3' as const,
  v4Enabled: ONBOARDING_V4_ENABLED,
  /** Observational only: the legacy paywall remains the mounted implementation. */
  paywall: Object.freeze({ developmentBypassEnabled: DEV_BYPASS_PAYWALL }),
  previews: Object.freeze({
    eat_healthier: isEatHealthierStage2PreviewEnabled(),
    hit_macros: isHitMacrosStage2PreviewEnabled(),
    save_money: isSaveMoneyStage2PreviewEnabled(),
  }),
});
