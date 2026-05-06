const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Monorepo: `yarn dev:both` often starts Expo with cwd at the repo root, so Expo’s default .env scan
// can miss packages/seller-app/.env. Load both roots before Metro reads EXPO_PUBLIC_* for the bundle.
(function loadMonorepoDotenv() {
  try {
    const dotenv = require('dotenv');
    const chain = [
      path.join(workspaceRoot, '.env'),
      path.join(workspaceRoot, '.env.local'),
      path.join(projectRoot, '.env'),
      path.join(projectRoot, '.env.local'),
    ];
    for (const p of chain) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p, override: true });
      }
    }
  } catch (_) {
    /* optional: dotenv missing in some installs */
  }
})();

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Map the shared package and ensure React resolves to app's instance
config.resolver.extraNodeModules = {
  'shared': path.resolve(workspaceRoot, 'packages/shared'),
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

// 4. Force Metro to resolve symlinked packages (crucial for workspaces)
config.resolver.disableHierarchicalLookup = false;

// 5. Enable package exports (for newer Expo packages)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;

