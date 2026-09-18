import Capacitor
import UIKit

/// Registers the app-local Capacitor plugins (npm plugins register themselves).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(LiveActivityPlugin())
        #if DEBUG
        if #available(iOS 16.2, *), ProcessInfo.processInfo.arguments.contains("-LiveActivityDemo") {
            Task { await LiveActivities.showDemo() }
        }
        #endif
    }
}
