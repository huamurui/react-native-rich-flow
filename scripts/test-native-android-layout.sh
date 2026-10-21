#!/usr/bin/env bash
set -euo pipefail

rich_flow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rich_flow_android_project="${1:-$rich_flow_root/example/android}"

if [[ ! -f "$rich_flow_android_project/gradlew" ]]; then
  echo 'Generate the example Android project first: cd example && npx expo prebuild --platform android' >&2
  exit 1
fi

# Runs on an already connected Android device or emulator. ANDROID_SERIAL may
# select one device; this script never creates or stops an emulator.
cd "$rich_flow_android_project"
bash ./gradlew :react-native-rich-flow:connectedDebugAndroidTest
