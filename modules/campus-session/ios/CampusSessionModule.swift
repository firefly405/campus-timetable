import ExpoModulesCore
import WebKit

public class CampusSessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CampusSession")
    AsyncFunction("clear") { (promise: Promise) in
      DispatchQueue.main.async {
        // This is the app's WebKit store, not the user's Safari/Edge session.
        WKWebsiteDataStore.default().removeData(
          ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
          modifiedSince: Date.distantPast
        ) { promise.resolve(nil) }
      }
    }
  }
}
