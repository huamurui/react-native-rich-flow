#!/usr/bin/env bash
set -euo pipefail

rich_flow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
consumer_dir="$(mktemp -d "${TMPDIR:-/tmp}/rich-flow-sdk54.XXXXXX")"
trap 'rm -rf "$consumer_dir"' EXIT
export CI=1 EXPO_NO_TELEMETRY=1

cd "$rich_flow_root"
npm pack --silent --pack-destination "$consumer_dir"
cd "$consumer_dir"
cat > package.json <<'JSON'
{
  "name": "rich-flow-sdk54-consumer",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "expo": "54.0.38",
    "expo-modules-core": "3.0.30",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
JSON
cat > app.json <<'JSON'
{"expo":{"name":"Rich Flow SDK 54","slug":"rich-flow-sdk54","android":{"package":"example.richflow.sdk54"}}}
JSON
cat > index.js <<'JS'
import React from 'react';
import { registerRootComponent } from 'expo';
import { View } from 'react-native';
import { compileDocument } from 'react-native-rich-flow';
import { parseMarkdown } from 'react-native-rich-flow/adapters';
import { PlainTextStream, RichFlow } from 'react-native-rich-flow/native';

const flow = compileDocument(parseMarkdown('Hello **SDK 54**', { id: 'hello' }));
registerRootComponent(() => React.createElement(View, null,
  React.createElement(RichFlow, { flow, preserveSelectionOnUpdate: true }),
  React.createElement(PlainTextStream, { documentId: 'stream', text: 'Hello' })));
JS

npm install --no-audit --no-fund --save-exact ./*.tgz
./node_modules/.bin/expo prebuild --platform android --no-install
./node_modules/.bin/expo export --platform android --max-workers 2
cd android
bash ./gradlew :react-native-rich-flow:compileDebugKotlin :react-native-rich-flow:testDebugUnitTest \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain
# Gradle also succeeds with NO-SOURCE if a tarball omits the JVM tests.
test_reports="$consumer_dir/node_modules/react-native-rich-flow/android/build/test-results/testDebugUnitTest"
grep -Eq 'tests="[1-9][0-9]*"' "$test_reports"/TEST-*.xml
