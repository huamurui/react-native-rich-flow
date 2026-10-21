#!/usr/bin/env bash
set -euo pipefail

rich_flow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rich_flow_test_directory="$(mktemp -d "${TMPDIR:-/tmp}/rich-flow-layout.XXXXXX")"
trap 'rm -rf "$rich_flow_test_directory"' EXIT

# Deliberately do not boot, create or erase a simulator on the caller's behalf.
rich_flow_booted_devices="$(xcrun simctl list devices booted)"
rich_flow_device="$(printf '%s\n' "$rich_flow_booted_devices" | awk '
  /^-- / { is_ios = $0 ~ /^-- iOS / }
  is_ios && /\(Booted\)/ {
    sub(/ *\(Booted\).*$/, "")
    sub(/^.*\(/, "")
    sub(/\).*$/, "")
    print
    exit
  }
')"
if [[ -z "$rich_flow_device" ]]; then
  echo "A booted iOS simulator is required. Open Simulator and boot an iPhone or iPad first." >&2
  exit 1
fi

rich_flow_sdk="$(xcrun --sdk iphonesimulator --show-sdk-path)"
rich_flow_arch="$(uname -m)"
xcrun --sdk iphonesimulator swiftc \
  -target "$rich_flow_arch-apple-ios15.1-simulator" \
  -sdk "$rich_flow_sdk" \
  -module-cache-path "$rich_flow_test_directory/cache" \
  "$rich_flow_root/ios/RichTextModels.swift" \
  "$rich_flow_root/ios/RichTextConfig.swift" \
  "$rich_flow_root/ios/RichTextAnnotations.swift" \
  "$rich_flow_root/ios/RichTextLayoutManager.swift" \
  "$rich_flow_root/tests/native/UIKitAnnotationsSmoke.swift" \
  -o "$rich_flow_test_directory/layout-smoke"

# Optional SIMCTL_CHILD_RICH_FLOW_SMOKE_IMAGE=/absolute/path.png exports a preview;
# SIMCTL_CHILD_RICH_FLOW_SMOKE_GUIDES=1 overlays the tested annotation bounds.
xcrun simctl spawn "$rich_flow_device" "$rich_flow_test_directory/layout-smoke"
