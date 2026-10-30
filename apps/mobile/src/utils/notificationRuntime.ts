/** Keep this decision pure so it can be regression-tested without loading
 * React Native or expo-notifications in the Node test runner. */
export function shouldLoadNotifications(platform: string | undefined, isDevice: boolean): boolean {
  return platform !== 'web' && isDevice;
}
