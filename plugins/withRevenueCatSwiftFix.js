/** Preserve RevenueCat 5.x's public initializer while avoiding Swift 6.4's
 * conflicting synthesized memberwise initializer. Move the existing initializer
 * into the struct body; its implementation and public API remain unchanged.
 */
const { withPodfile } = require('@expo/config-plugins');
const marker = 'serlo-revenuecat-swift-init:v1';
const patch = `
    # ${marker}: Swift 6.4 compatibility for the pinned RevenueCat SDK.
    serlo_rc_color = File.join(__dir__, 'Pods', 'RevenueCat', 'Sources', 'Paywalls', 'PaywallColor.swift')
    if File.exist?(serlo_rc_color)
      source = File.read(serlo_rc_color)
      initializer = <<~'SWIFT'.strip
        public init(stringRepresentation: String) throws {
                self.init(stringRepresentation: stringRepresentation, color: try Self.parseColor(stringRepresentation))
            }
      SWIFT
      if source.include?(initializer) && !source.include?('// ${marker}')
        declaration = 'public struct PaywallColor {'
        raise 'RevenueCat PaywallColor declaration changed; review Swift compatibility patch' unless source.include?(declaration)
        source = source.sub(initializer, '')
        source = source.sub(declaration, declaration + "\\n    // ${marker}\\n    #if canImport(SwiftUI)\\n    " + initializer + "\\n    #endif\\n")
        File.chmod(0644, serlo_rc_color)
        File.write(serlo_rc_color, source)
      end
    end
`;
module.exports = function withRevenueCatSwiftFix(config) {
  return withPodfile(config, (mod) => {
    const source = mod.modResults.contents;
    if (source.includes(marker)) return mod;
    const hook = /(\n\s*react_native_post_install\([\s\S]*?\n\s*\)\n)/;
    if (!hook.test(source)) throw new Error('Could not locate react_native_post_install in Podfile');
    mod.modResults.contents = source.replace(hook, match => match + patch);
    return mod;
  });
};
