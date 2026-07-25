export type GuidedCookingPreviewStep = {
  instruction?: unknown;
  title?: unknown;
};

export function getNextGuidedCookingPreview(
  steps: readonly GuidedCookingPreviewStep[],
  currentStepIndex: number,
) {
  const nextStep = steps[currentStepIndex + 1];
  if (!nextStep) {
    return null;
  }

  const title = getUsableStepText(nextStep.title);
  if (title && !/^step\s+\d+$/i.test(title)) {
    return title;
  }

  return getFirstSentence(nextStep.instruction);
}

function getUsableStepText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function getFirstSentence(value: unknown) {
  const text = getUsableStepText(value);
  if (!text) {
    return null;
  }

  const sentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  return sentence ?? text;
}
