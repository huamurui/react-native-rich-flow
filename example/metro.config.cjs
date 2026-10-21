const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The library is the workspace root itself, rather than a sibling workspace.
// Expo watches child workspaces automatically, but Metro must also see this
// symlink's real target to resolve the package and its exported subpaths.
const libraryRoot = path.resolve(__dirname, '..');
config.watchFolders = [...new Set([...config.watchFolders, libraryRoot])];

module.exports = config;
