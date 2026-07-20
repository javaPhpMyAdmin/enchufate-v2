// Default Metro configuration for Expo.
// https://docs.expo.dev/guides/customizing-metro/
// const { getDefaultConfig } = require('expo/metro-config');

// /** @type {import('expo/metro-config').MetroConfig} */
// module.exports = getDefaultConfig(__dirname);

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Activa el soporte nativo para los enlaces simbólicos de pnpm
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
