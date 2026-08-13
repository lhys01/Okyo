export function getConciseGuidedInstruction(value: string) {
  // Guided Cooking renders this inside a scrollable region. Preserve the
  // complete generated instruction so useful technique and finish cues are
  // never silently removed before the user starts cooking.
  return value.replace(/\s+/g, ' ').trim();
}
