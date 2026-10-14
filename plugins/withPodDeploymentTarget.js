/** Keep all CocoaPods (including resource bundles) at the app's supported iOS floor.
 * Xcode 27 rejects older pod defaults such as iOS 9, even when the app targets 16.
 */
const { withPodfile } = require('@expo/config-plugins');
const marker = 'serlo-pod-deployment-target:v1';
const patch = `
    # ${marker}: raise old pod targets to the configured app minimum.
    serlo_min_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || min_ios_version_supported)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |configuration|
        current = configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < serlo_min_ios
          configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = serlo_min_ios.to_s
        end
      end
    end
`;
module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, (mod) => {
    const contents = mod.modResults.contents;
    if (contents.includes(marker)) return mod;
    const hook = /(\n\s*react_native_post_install\([\s\S]*?\n\s*\)\n)/;
    if (!hook.test(contents)) throw new Error('Could not locate react_native_post_install in Podfile');
    mod.modResults.contents = contents.replace(hook, () => contents.match(hook)[0] + patch);
    return mod;
  });
};
