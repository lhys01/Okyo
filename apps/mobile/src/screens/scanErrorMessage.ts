import type { ApiError } from '../api/client';

export function getUploadFailureReasonFromError(error: unknown) {
  if (error instanceof Error && error.name === 'ScanRequestTimeoutError') {
    return 'This scan took too long. Try again with a clear, well-lit food photo.';
  }
  if (error instanceof Error && error.name === 'ScanConnectionError') {
    return 'Okyo could not reach the scanner. Check your connection and try again.';
  }
  if (isApiError(error)) {
    switch (error.code) {
      case 'image_payload_too_large':
        return 'This photo was too large to scan. Try a smaller image.';
      case 'fable_not_enabled':
        return 'Okyo had trouble scanning this photo. Try again in a second.';
      case 'fable_daily_cap_exceeded':
      case 'ai_daily_cap_exceeded':
      case 'scan_limit_reached':
        return 'Okyo has reached its daily scan limit. Try again tomorrow.';
      case 'capacity_unavailable':
        return 'Okyo could not reach the scanner. Please try again in a moment.';
      case 'rate_limit_exceeded':
        return 'Too many scan requests. Please wait a moment before trying again.';
      case 'scan_timeout':
        return 'This scan took too long. Try again with a clear, well-lit food photo.';
      default:
        return 'Okyo had trouble scanning this photo. Try again in a second.';
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('too large')) {
    return 'This photo was too large to scan. Try a smaller image.';
  }
  if (
    message.includes('network') ||
    message.includes('abort') ||
    message.includes('fetch') ||
    message.includes('failed to fetch')
  ) {
    return 'Okyo could not reach the scanner. Check the API server and try again.';
  }

  return 'Okyo had trouble scanning this photo. Try again in a second.';
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error &&
    error.name === 'ApiError' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'httpStatus' in error &&
    typeof error.httpStatus === 'number';
}
