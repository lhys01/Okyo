import type { ScanRejectionType, ScanStatus } from '../api/types';

export type ScanFailureCategory =
  | 'unclear_image'
  | 'not_food'
  | 'unreliable_result'
  | 'network_timeout'
  | 'malformed_response'
  | 'generic';

const NETWORK_REASON_PATTERN = /network|connection|reach the scanner|fetch|abort|timed? ?out/i;

export function getScanFailureCategory(input: {
  isTimeout: boolean;
  rejectionReason?: string | null;
  rejectionType?: ScanRejectionType | null;
  status: ScanStatus | 'pending' | null | undefined;
  usable: boolean;
}): ScanFailureCategory {
  if (input.isTimeout) {
    return 'network_timeout';
  }
  if (typeof input.rejectionReason === 'string' && NETWORK_REASON_PATTERN.test(input.rejectionReason)) {
    return 'network_timeout';
  }
  if (input.rejectionType === 'not_food') {
    return 'not_food';
  }
  if (input.rejectionType === 'unclear_image') {
    return 'unclear_image';
  }
  if (input.status === 'partial') {
    return 'unreliable_result';
  }
  if (input.status === 'success' && !input.usable) {
    return 'malformed_response';
  }
  return 'generic';
}

export type ScanFailureCopy = {
  body: string;
  title: string;
};

const photoBodyByCategory: Record<ScanFailureCategory, string> = {
  unclear_image: 'Try a clearer photo with the whole dish visible.',
  not_food: "This doesn't look like a meal yet.",
  unreliable_result: 'Okyo couldn’t build a reliable recipe from this photo.',
  network_timeout: 'Okyo lost the connection. Try once more.',
  malformed_response: 'Okyo couldn’t finish this recipe. Try another photo.',
  generic: 'Try another angle or choose a clearer photo.',
};

const descriptionBodyByCategory: Record<ScanFailureCategory, string> = {
  unclear_image: 'Add a few more details about the dish and try again.',
  not_food: "That doesn't sound like a meal yet. Try describing what you're craving.",
  unreliable_result: 'Okyo couldn’t build a reliable recipe from that description.',
  network_timeout: 'Okyo lost the connection. Try once more.',
  malformed_response: 'Okyo couldn’t finish this recipe. Try describing it another way.',
  generic: 'Try describing the meal a different way.',
};

export function getInlineFailureCopy(category: ScanFailureCategory, isDescriptionScan: boolean): ScanFailureCopy {
  return {
    title: isDescriptionScan ? 'Kiko couldn’t build that one' : 'Kiko couldn’t read this one',
    body: isDescriptionScan ? descriptionBodyByCategory[category] : photoBodyByCategory[category],
  };
}
