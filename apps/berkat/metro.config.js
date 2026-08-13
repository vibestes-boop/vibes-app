// Bewusst eigenständig: Berkat hat eigene node_modules und schaut NICHT ins
// Repo-Root. Dieselbe Isolation wie apps/web — Root-Dependencies dürfen den
// Build hier nie beeinflussen.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
