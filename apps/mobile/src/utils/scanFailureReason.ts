import type { ScanRejectionType } from '../api/types';
import { getFoxSubjectName } from '../state/foxDisplayName';

export type ScanFailureReasonCode =
  | 'unclear_image'
  | 'not_food'
  | 'unreliable_result'
  | 'network_timeout'
  | 'malformed_response';

export type ScanFailureCopy = {
  title: string;
  body: string;
};

export type ScanFailureMode = 'image' | 'description';

const networkKeywords = ['network', 'abort', 'fetch', 'failed to fetch', 'timed out', 'timeout', 'connection'];

export function classifyScanErrorMessage(error: unknown): ScanFailureReasonCode {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (networkKeywords.some((keyword) => message.includes(keyword))) {
    return 'network_timeout';
  }

  return 'malformed_response';
}

export function classifyScanRejection(
  rejectionType: ScanRejectionType | undefined,
  rejectionReason: string | undefined,
): ScanFailureReasonCode {
  const reasonText = (rejectionReason ?? '').toLowerCase();

  if (networkKeywords.some((keyword) => reasonText.includes(keyword))) {
    return 'network_timeout';
  }
  if (rejectionType === 'not_food') {
    return 'not_food';
  }
  if (rejectionType === 'unclear_image' || reasonText.includes('too large')) {
    return 'unclear_image';
  }
  if (reasonText.includes('reliable') || reasonText.includes('recipe')) {
    return 'unreliable_result';
  }

  return 'malformed_response';
}

export function classifyScanFailure(
  failure: { rejectionType?: ScanRejectionType; rejectionReason?: string } | null | undefined,
  error?: unknown,
): ScanFailureReasonCode {
  if (error) {
    return classifyScanErrorMessage(error);
  }
  if (!failure) {
    return 'malformed_response';
  }

  return classifyScanRejection(failure.rejectionType, failure.rejectionReason);
}

const imageBodies: Record<ScanFailureReasonCode, string> = {
  unclear_image: 'Try a clearer photo with the whole dish visible.',
  not_food: 'This doesn’t look like a meal yet.',
  unreliable_result: 'Okyo couldn’t build a reliable recipe from this photo.',
  network_timeout: 'Okyo lost the connection. Try once more.',
  malformed_response: 'Okyo couldn’t finish this recipe. Try another photo.',
};

const descriptionBodies: Record<ScanFailureReasonCode, string> = {
  unclear_image: 'Try describing the dish with a bit more detail.',
  not_food: 'That doesn’t sound like a meal yet.',
  unreliable_result: 'Okyo couldn’t build a reliable recipe from that description.',
  network_timeout: 'Okyo lost the connection. Try once more.',
  malformed_response: 'Okyo couldn’t finish this recipe. Try rephrasing your description.',
};

export function getScanFailureCopy(reason: ScanFailureReasonCode, mode: ScanFailureMode = 'image', mascotName?: string | null): ScanFailureCopy {
  const subject = getFoxSubjectName(mascotName);
  if (mode === 'description') {
    return { title: `${subject} couldn’t build this one`, body: descriptionBodies[reason] };
  }

  return { title: `${subject} couldn’t read this one`, body: imageBodies[reason] };
}
