const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * react-native-web@0.21 still reaches into `inline-style-prefixer/lib/...`,
 * which that package's `exports` map does not expose — so the web bundle fails
 * to resolve it while iOS and Android build fine. Resolving those deep paths
 * the old way costs nothing here and only affects the web target.
 */
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
