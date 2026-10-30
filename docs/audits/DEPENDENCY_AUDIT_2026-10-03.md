# Dependency audit — 2026-10-03

Commands run:

```sh
cd apps/mobile && npm audit --omit=dev
cd apps/api && npm audit --omit=dev
cd apps/mobile && npx expo install --check
```

The API audit reports zero vulnerabilities. Expo dependency validation reports
that the mobile dependencies are up to date for SDK 55.

The mobile audit reports 43 vulnerabilities: 20 moderate and 23 high, with no
critical findings. The high findings resolve through the current Expo SDK 55
and React Native 0.83 toolchain, plus direct audit propagation from the
`@clerk/expo` and `@sentry/react-native` roots. The known paths include:

- `expo` → Expo CLI / code-signing support → `node-forge`;
- `expo` → Metro → `micromatch` / `braces`;
- `react-native` → Metro and Jest support packages.

`npm audit` does not offer a compatible remediation for the Expo, React Native,
Clerk, or Sentry findings. Its dry-run remediation proposes a React Native 0.87
major upgrade and broad lockfile restructuring, which is outside Expo SDK 55
compatibility and was not applied. The reported Sentry “fix” is a major
downgrade to an older package line, so it was also not applied.

Most named high paths are build, Metro, test, or Expo CLI dependencies rather
than app code executing inside the shipped iOS binary. That is not a finding of
no risk: the mobile release remains blocked on maintaining an Expo-supported
SDK/RN upgrade path and reevaluating the audit after that upgrade. No
uncontrolled `npm audit fix --force` or React Native major upgrade was made.
