import type { OnboardingV4InFlightScan } from '../state/onboardingV4ScanPersistence';

export class FirstScanTransactionError extends Error {
  constructor(message: string, readonly preserveInFlight: boolean, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FirstScanTransactionError';
  }
}

export type OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated> = {
  writeInFlightScan: (scan: OnboardingV4InFlightScan) => Promise<void>;
  readFreeRecipeConsumed: () => Promise<boolean>;
  writeFreeRecipeConsumed: (value: true) => Promise<void>;
  clearInFlightScan: () => Promise<void>;
  findCommittedRecipe: (scanSessionId: string) => string | null;
  loadInput: (scan: OnboardingV4InFlightScan) => Promise<Input>;
  analyze: (input: Input) => Promise<Analysis>;
  generate: (analysis: Analysis, input: Input) => Promise<Generated>;
  commitUsableRecipe: (generated: Generated, analysis: Analysis, input: Input) => Promise<string>;
  onPersisted?: () => void;
  onAnalysisSucceeded?: (analysis: Analysis) => void;
};

export function createIdempotentFirstScanTransactionRunner() {
  const active = new Map<string, Promise<string>>();
  return function run<Input, Analysis, Generated>(scan: OnboardingV4InFlightScan, dependencies: OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated>) {
    const current = active.get(scan.scanSessionId);
    if (current) return current;
    const transaction = runOnboardingV4FirstScanTransaction(scan, dependencies)
      .finally(() => { if (active.get(scan.scanSessionId) === transaction) active.delete(scan.scanSessionId); });
    active.set(scan.scanSessionId, transaction);
    return transaction;
  };
}

/**
 * The Step 08 transaction. Its ordering is intentional and tested: the
 * attempt is durable before services start; consumption follows a usable
 * canonical commit; cleanup is last. Partial success keeps the in-flight
 * record so a cold restart can finish the transaction without another recipe.
 */
export async function runOnboardingV4FirstScanTransaction<Input, Analysis, Generated>(
  scan: OnboardingV4InFlightScan,
  dependencies: OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated>,
): Promise<string> {
  try {
    await dependencies.writeInFlightScan(scan);
  } catch (cause) {
    throw new FirstScanTransactionError('The scan could not be saved before starting.', false, { cause });
  }
  dependencies.onPersisted?.();

  const consumed = await dependencies.readFreeRecipeConsumed();
  const existingRecipeId = dependencies.findCommittedRecipe(scan.scanSessionId);
  if (consumed) {
    if (!existingRecipeId) {
      throw new FirstScanTransactionError('The free recipe was consumed but is not available.', true);
    }
    await clearAfterSuccess(dependencies);
    return existingRecipeId;
  }
  if (existingRecipeId) {
    await consumeAndClear(existingRecipeId, dependencies);
    return existingRecipeId;
  }

  let input: Input;
  let analysis: Analysis;
  let generated: Generated;
  let recipeId: string | null = null;
  try {
    input = await dependencies.loadInput(scan);
    analysis = await dependencies.analyze(input);
    dependencies.onAnalysisSucceeded?.(analysis);
    generated = await dependencies.generate(analysis, input);
    recipeId = await dependencies.commitUsableRecipe(generated, analysis, input);
  } catch (cause) {
    if (cause instanceof FirstScanTransactionError) throw cause;
    await clearAfterTerminalFailure(dependencies, cause);
  }
  if (!recipeId) throw new FirstScanTransactionError('The canonical recipe was not available after commit.', false);
  await consumeAndClear(recipeId, dependencies);
  return recipeId;
}

async function clearAfterTerminalFailure<Input, Analysis, Generated>(dependencies: OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated>, originalCause: unknown): Promise<never> {
  try {
    await dependencies.clearInFlightScan();
  } catch (clearCause) {
    throw new FirstScanTransactionError('The failed scan is waiting to be recovered.', true, { cause: clearCause });
  }
  throw new FirstScanTransactionError(originalCause instanceof Error ? originalCause.message : 'The scan could not be completed.', false, { cause: originalCause });
}

async function consumeAndClear<Input, Analysis, Generated>(recipeId: string, dependencies: OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated>) {
  try {
    await dependencies.writeFreeRecipeConsumed(true);
  } catch (cause) {
    throw new FirstScanTransactionError('The completed free recipe is waiting to be finalized.', true, { cause });
  }
  await clearAfterSuccess(dependencies);
  return recipeId;
}

async function clearAfterSuccess<Input, Analysis, Generated>(dependencies: OnboardingV4FirstScanTransactionDependencies<Input, Analysis, Generated>) {
  try {
    await dependencies.clearInFlightScan();
  } catch (cause) {
    throw new FirstScanTransactionError('The completed free recipe is safe and will resume.', true, { cause });
  }
}
