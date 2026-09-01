export const NUMBER_PICKER_ITEM_HEIGHT = 54;

export function clampNumberPickerIndex(index: number, optionCount: number): number {
  if (optionCount === 0) return 0;
  return Math.max(0, Math.min(optionCount - 1, Math.round(index)));
}

export function numberPickerIndexFromOffset(offset: number, optionCount: number): number {
  return clampNumberPickerIndex(offset / NUMBER_PICKER_ITEM_HEIGHT, optionCount);
}
