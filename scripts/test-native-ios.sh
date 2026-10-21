#!/usr/bin/env bash
set -euo pipefail

rich_flow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rich_flow_test_directory="$(mktemp -d "${TMPDIR:-/tmp}/rich-flow-models.XXXXXX")"
trap 'rm -rf "$rich_flow_test_directory"' EXIT

xcrun swiftc \
  -module-cache-path "$rich_flow_test_directory/cache" \
  "$rich_flow_root/ios/RichTextModels.swift" \
  "$rich_flow_root/ios/AttachmentViewport.swift" \
  "$rich_flow_root/tests/native/ModelsSmoke.swift" \
  -o "$rich_flow_test_directory/models-smoke"
"$rich_flow_test_directory/models-smoke"
