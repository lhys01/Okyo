#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=production
node ../../scripts/security/audit.mjs
npm run preflight:release
node scripts/verify-public-release-urls.mjs
node --import tsx scripts/check-release-api.ts
xcodebuild -workspace ios/Okyo.xcworkspace -scheme Okyo -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${OKYO_ARCHIVE_PATH:-$PWD/.artifacts/Okyo.xcarchive}" archive
node ../../scripts/security/audit.mjs --artifacts "${OKYO_ARCHIVE_PATH:-$PWD/.artifacts/Okyo.xcarchive}/Products/Applications/Okyo.app"
