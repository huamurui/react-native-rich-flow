import UIKit

@objc(RichFlowPlaygroundSceneDelegate)
final class PlaygroundSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene,
          let host = UIApplication.shared.delegate as? AppDelegate,
          let factory = host.reactNativeFactory else { return }
    let window = UIWindow(windowScene: scene)
    self.window = window
    host.window = window
    var launch = host.initialLaunchOptions ?? [:]
    if let context = options.urlContexts.first {
      launch[.url] = context.url
      launch[.sourceApplication] = context.options.sourceApplication
    }
    if let activity = options.userActivities.first {
      launch[.userActivityDictionary] = [UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
                                          "UIApplicationLaunchOptionsUserActivityKey": activity]
    }
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launch)
    host.initialLaunchOptions = nil
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    guard let host = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      options[.sourceApplication] = context.options.sourceApplication
      _ = host.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let host = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = host.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidBecomeActive(UIApplication.shared)
  }
  func sceneWillResignActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillResignActive(UIApplication.shared)
  }
  func sceneWillEnterForeground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillEnterForeground(UIApplication.shared)
  }
  func sceneDidEnterBackground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidEnterBackground(UIApplication.shared)
  }
}
