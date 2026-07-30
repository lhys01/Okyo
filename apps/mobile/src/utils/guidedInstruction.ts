export function getConciseGuidedInstruction(value: string) {
  const instruction = value.replace(/\s+/g, ' ').trim();
  const sentences = instruction.match(/[^.!?]+[.!?]?/g) ?? [];
  const concise = sentences.slice(0, 2).join(' ').trim();
  const candidate = concise || instruction;

  if (candidate.length <= 220) {
    return candidate;
  }

  const shortened = candidate.slice(0, 217).replace(/\s+\S*$/, '').trim();
  return `${shortened}…`;
}
