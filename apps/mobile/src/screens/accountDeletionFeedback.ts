export type AccountDeletionFailure = {
  title: string;
  message: string;
  canRetry: boolean;
};

/** Never show provider error text or imply deletion succeeded after an uncertain response. */
export function accountDeletionFailure(error: unknown): AccountDeletionFailure {
  const safe = error && typeof error === 'object'
    ? error as { status?: unknown; code?: unknown }
    : null;
  if (safe) {
    if (safe.status === 401 || safe.code === 'authentication_required') {
      return {
        title: 'Sign in again',
        message: 'Your session has expired. Sign in again before deleting your account. No deletion was confirmed.',
        canRetry: false,
      };
    }
    if (safe.status === 503 && (safe.code === 'account_deletion_unavailable' || safe.code === 'authentication_unavailable')) {
      return {
        title: 'Account deletion is unavailable',
        message: 'Okyo’s account-deletion service is not available right now. Your account was not confirmed deleted. Please try later or contact support.',
        canRetry: true,
      };
    }
    if (safe.status === 0) {
      return {
        title: 'Deletion status is uncertain',
        message: 'Okyo lost the connection before it could confirm deletion. Your account may still be active. Retry when connected, or contact support if you cannot sign in.',
        canRetry: true,
      };
    }
  }
  return {
    title: 'Couldn’t confirm account deletion',
    message: 'Okyo could not confirm that every server-side step finished. Your account may still be active. Please retry or contact support.',
    canRetry: true,
  };
}
