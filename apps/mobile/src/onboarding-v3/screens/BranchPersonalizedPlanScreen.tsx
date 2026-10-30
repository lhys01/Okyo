import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { BranchHydrationScreen, BranchScaffold } from '../branch-ui/BranchScaffold';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { healthReducer, type HealthDraft, type HealthStep } from '../state/healthBranch';
import { planSummaryRows as healthPlanRows } from '../state/healthBranchCopy';
import { healthBranchPersistence } from '../state/healthBranchPersistence';
import { macrosReducer, type MacrosDraft, type MacrosStep } from '../state/macrosBranch';
import { finalPlanMessage, planSummaryRows as macroPlanRows, targetSummary } from '../state/macrosBranchCopy';
import { macrosBranchPersistence } from '../state/macrosBranchPersistence';
import { calculateSavingsProjection, saveMoneyReducer, type SaveMoneyDraft } from '../state/saveMoneyBranch';
import { saveMoneyBranchPersistence } from '../state/saveMoneyBranchPersistence';
import { resolveSavingsPlan } from '../state/saveMoneyBranchPlan';
import { getFinalBranchPlanProgress } from '../branch-ui/branchPlanProgress';
import { onboardingV3Log } from '../utils/onboardingV3Log';
import { type CommitmentBranch } from '../state/branchCommitmentPersistence';
import { HealthPlanSummary } from './HealthReferenceScreens';
import { MacrosPlanScreen } from './MacrosVisuals';
import { SavingsFinalPlan } from './SaveMoneyBranchScreen';
import { stepsSkippedForVariant, type OnboardingQuestionVariant } from '../state/onboardingQuestionExperiment';

type PlanData =
  | { branch: 'save_money'; draft: SaveMoneyDraft }
  | { branch: 'eat_healthier'; draft: HealthDraft }
  | { branch: 'hit_macros'; draft: MacrosDraft };

type PlanRead = { plan: PlanData | null; issue: 'storage_error' | 'invalid_json' | 'answers_incomplete' | 'read_exception' | null; recoveryStep?: string };

async function readPlan(branch: CommitmentBranch): Promise<PlanRead> {
  if (branch === 'save_money') {
    const result = await saveMoneyBranchPersistence.readDetailed();
    if (result.status !== 'ready') return { plan: null, issue: result.status };
    return resolveSavingsPlan(result.draft);
  }
  if (branch === 'eat_healthier') {
    const draft = await healthBranchPersistence.read();
    return (draft.currentStep === 'reveal' || draft.currentStep === 'complete') && draft.goal !== null
      ? { plan: { branch, draft }, issue: null } : { plan: null, issue: 'answers_incomplete' };
  }
  const draft = await macrosBranchPersistence.read();
  return (draft.currentStep === 'reveal' || draft.currentStep === 'complete') && draft.macroFocus !== null
    ? { plan: { branch, draft }, issue: null } : { plan: null, issue: 'answers_incomplete' };
}

async function rewindPlan(plan: PlanData, editTargets: boolean, variant: OnboardingQuestionVariant): Promise<boolean> {
  if (plan.branch === 'save_money') {
    const draft = saveMoneyReducer({ ...plan.draft, branchCompleted: false, currentStep: 'reveal' }, { type: 'BACK_PRESSED' });
    return (await saveMoneyBranchPersistence.write(draft)) !== null;
  }
  if (plan.branch === 'eat_healthier') {
    const draft = healthReducer({ ...plan.draft, branchCompleted: false, currentStep: 'reveal' }, { type: 'BACK_PRESSED', skipSteps: stepsSkippedForVariant(variant, 'eat_healthier') as readonly HealthStep[] });
    return (await healthBranchPersistence.write(draft)) !== null;
  }
  const draft = macrosReducer({ ...plan.draft, branchCompleted: false, currentStep: 'reveal' }, editTargets
    ? { type: 'EDIT_TARGETS_PRESSED' }
    : { type: 'BACK_PRESSED', skipSteps: stepsSkippedForVariant(variant, 'hit_macros') as readonly MacrosStep[] });
  return (await macrosBranchPersistence.write(draft)) !== null;
}

/** One plan route and one navigation shell for all active goal branches. */
export function BranchPersonalizedPlanScreen({ branch, variant = 'A', onBack, onContinue, onEditTargets }: {
  branch: CommitmentBranch;
  variant?: OnboardingQuestionVariant;
  onBack: () => void;
  onContinue: () => void;
  onEditTargets: () => void;
}) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loadIssue, setLoadIssue] = useState<PlanRead['issue']>(null);
  const inFlight = useRef(false);
  const loadInFlight = useRef(false);
  const continueToSignature = () => {
    if (inFlight.current || !plan || error) return;
    inFlight.current = true;
    setBusy(true);
    onboardingV3Log('branch_plan_continue', { branch, stage: 'signature_handoff' });
    onContinue();
  };
  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    try {
      const result = await readPlan(branch);
      setPlan(result.plan);
      setLoadIssue(result.issue);
      setError(result.plan === null);
      if (result.plan === null) {
        onboardingV3Log('branch_plan_unavailable', {
          branch,
          reason: result.issue ?? 'unknown',
          recoveryStep: result.recoveryStep ?? null,
        });
      } else {
        onboardingV3Log('branch_plan_loaded', {
          branch,
          stage: 'plan_render_ready',
          persistedStep: result.plan.branch === 'save_money' ? result.plan.draft.currentStep : null,
        });
      }
    } catch {
      setPlan(null);
      setLoadIssue('read_exception');
      setError(true);
    } finally {
      loadInFlight.current = false;
      setLoading(false);
    }
  }, [branch]);
  useEffect(() => { void load(); }, [load]);

  const back = async (editTargets = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const saved = plan ? await rewindPlan(plan, editTargets, variant) : true;
      if (saved) (editTargets ? onEditTargets : onBack)();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (loading) return <BranchHydrationScreen />;
  return <BranchScaffold
    branch={branch}
    onBack={() => { void back(); }}
    progress={getFinalBranchPlanProgress(branch, variant)}
    progressVariant="continuous"
    footer={<OnboardingCTA
      disabled={busy}
      label={plan && !error ? 'Continue to signature' : 'Try again'}
      maxFontSizeMultiplier={2}
      onPress={plan && !error ? continueToSignature : () => { void load(); }}
      tone="pastelPink"
    />}
  >
    {plan && !error ? <PlanContents plan={plan} variant={variant} onEditTargets={() => { void back(true); }} /> : <View style={styles.missing}>
      <Text accessibilityRole="header" style={styles.title}>{loadIssue === 'answers_incomplete' ? 'One more answer is needed.' : 'We couldn’t load your plan.'}</Text>
      <Text accessibilityRole="alert" style={styles.body}>{loadIssue === 'answers_incomplete'
        ? 'Go back to finish the missing answer. Your other saved choices are still here.'
        : loadIssue === 'invalid_json' || loadIssue === 'storage_error' || loadIssue === 'read_exception'
          ? 'Your saved answers could not be read. Try again, or go back to review them.'
          : 'Try again, or go back to review the questions.'}</Text>
    </View>}
  </BranchScaffold>;
}

function PlanContents({ plan, variant, onEditTargets }: { plan: PlanData; variant: OnboardingQuestionVariant; onEditTargets: () => void }) {
  if (plan.branch === 'save_money') {
    const { draft } = plan;
    const projection = calculateSavingsProjection({
      weeklyEatingOutCount: draft.weeklyEatingOutCount,
      eatingOutCostCents: draft.eatingOutCostCents,
      weeklyReplacementTarget: draft.weeklyReplacementTarget,
    });
    return <SavingsFinalPlan state={draft} projection={projection} />;
  }
  if (plan.branch === 'eat_healthier') return <HealthPlanSummary goal={plan.draft.goal} rows={healthPlanRows(plan.draft)} />;
  const { draft } = plan;
  return <MacrosPlanScreen
    calorieTarget={draft.calorieTarget}
    carbTarget={draft.carbTargetGrams}
    fatTarget={draft.fatTargetGrams}
    goal={draft.goal}
    message={finalPlanMessage(draft)}
    onEditTargets={onEditTargets}
    proteinTarget={draft.proteinTargetGrams}
    rows={macroPlanRows(draft)}
    startingPoint={draft.macroFocus === 'low_protein'
      ? 'Put protein up front in meals you already want'
      : draft.macroFocus === 'calorie_inconsistency'
        ? 'Make calories easier to see at a glance'
        : 'Get one useful next step for your meals'}
    targets={targetSummary(draft)}
    priorities={draft.recipePriorities}
    barrier={stepsSkippedForVariant(variant, 'hit_macros').includes('barrier') ? null : draft.macroBarrier}
  />;
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', paddingVertical: 24 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 27, lineHeight: 34, textAlign: 'center' },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
