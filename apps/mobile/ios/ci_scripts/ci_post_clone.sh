#!/bin/sh
set -eu

# Xcode Cloud clones the repository without local node_modules or CocoaPods.
if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
  mobile_root="${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile"
else
  mobile_root="$(cd "$(dirname "$0")/../.." && pwd)"
fi

if [ ! -f "${mobile_root}/package-lock.json" ]; then
  echo "Okyo mobile package-lock.json is missing from the checkout." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" != "22" ]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Node.js 22 is required, and Homebrew is unavailable." >&2
    exit 1
  fi
  brew install node@22
  export PATH="$(brew --prefix node@22)/bin:${PATH}"
fi

cd "$mobile_root"
npm ci
cd ios
pod install
