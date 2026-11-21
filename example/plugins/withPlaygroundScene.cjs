const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');

// SDK 55's template starts the React host inside UIApplicationDelegate. The
// playground built with the iOS 27 SDK must attach its window to a UIWindowScene.
module.exports = function withPlaygroundScene(config) {
  config = withPodfile(config, mod => {
    const contents = mod.modResults.contents;
    const hostMinimum = '  playground_ios_minimum = current_target_definition.platform.deployment_target';
    if (contents.includes(hostMinimum)) return mod;
    const hook = '  post_install do |installer|';
    if (!contents.includes(hook)) throw new Error('Review the playground post_install hook for the new Expo Podfile.');
    // SDWebImage 5.21 generates a privacy resource bundle targeting iOS 9,
    // which Xcode 27 rejects even though the application targets iOS 15.1+.
    mod.modResults.contents = contents.replace(hook, `${hostMinimum}
${hook}
    bundle = installer.pods_project.targets.find { |target| target.name == 'SDWebImage-SDWebImage' }
    bundle&.build_configurations&.each do |configuration|
      current = configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if current && Pod::Version.new(current) < playground_ios_minimum
        configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = playground_ios_minimum.to_s
      end
    end
`);
    return mod;
  });
  config = withInfoPlist(config, mod => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Playground',
          UISceneDelegateClassName: 'RichFlowPlaygroundSceneDelegate',
        }],
      },
    };
    return mod;
  });
  return withAppDelegate(config, mod => {
    let source = mod.modResults.contents;
    if (source.includes('@objc(RichFlowPlaygroundSceneDelegate)')) return mod;
    const launch = /window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)/;
    if (mod.modResults.language !== 'swift' || !launch.test(source) || !source.includes('var window: UIWindow?')) {
      throw new Error('Review the Expo iOS template before applying the playground scene delegate.');
    }
    source = source.replace('var window: UIWindow?', 'var window: UIWindow?\n  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?');
    source = source.replace(launch, 'initialLaunchOptions = launchOptions');
    mod.modResults.contents = source + '\n' + readFileSync(join(__dirname, 'PlaygroundSceneDelegate.swift'), 'utf8');
    return mod;
  });
};
