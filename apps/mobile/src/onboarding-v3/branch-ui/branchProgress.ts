/**
 * One continuous progress fill for the development-preview goal branches.
 *
 * The bar advances one notch **per screen** — every Next nudges it forward a
 * little, every Back nudges it back — and it is a pure function of
 * `currentStep`, so it also restores correctly on hydrate. It is never derived
 * from how many answers sit in the draft (that stayed full on resume and never
 * retreated on Back) and it is not bucketed by "question" so three screens no
 * longer move it a single step.
 *
 * The `intro` screen shows no bar, so it is dropped from the sequence; the
 * final step (`complete`) is the last entry, so it renders as 100%. The shared
 * `BranchProgressBar` fills to `answered / total` and labels
 * `min(answered + 1, total)/total`.
 */
export function getBranchProgress(
  order: readonly string[],
  currentStep: string,
): { answered: number; total: number } {
  const sequence = order.filter((step) => step !== 'intro');
  const total = Math.max(sequence.length - 1, 1);
  const index = sequence.indexOf(currentStep);
  if (index < 0) return { answered: 0, total };
  return { answered: Math.min(index, total), total };
}
