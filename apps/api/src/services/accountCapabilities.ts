/** Resolve private membership on the server; return capabilities, never a list. */
export function getAccountCapabilities(userId: string, configuredIds = process.env.OKYO_EXPERIMENT_ADMIN_USER_IDS ?? '') {
  const ids = configuredIds.split(',').map(value => value.trim()).filter(value => /^user_[A-Za-z0-9]{1,128}$/.test(value));
  return { canManageOnboardingExperiments: /^user_[A-Za-z0-9]{1,128}$/.test(userId) && ids.includes(userId) };
}
