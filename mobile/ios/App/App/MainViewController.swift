import UIKit
import Capacitor

/// Capacitor's bridge view controller, subclassed only to register the app-local
/// StorefrontPlugin (plugins that live in the app target aren't auto-discovered).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorefrontPlugin())
    }
}
