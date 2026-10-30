const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');
module.exports = function withReleasePermissions(config) {
  config = withInfoPlist(config, mod => {
    // Photo-only picker and SecureStore without biometric authentication.
    delete mod.modResults.NSMicrophoneUsageDescription;
    delete mod.modResults.NSFaceIDUsageDescription;
    return mod;
  });
  return withEntitlementsPlist(config, mod => {
    // Okyo schedules local reminders; it never registers a remote push token.
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
