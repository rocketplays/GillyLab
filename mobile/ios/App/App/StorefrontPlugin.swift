import Foundation
import Capacitor
import StoreKit

/// Reports the device's App Store storefront country (ISO 3166 alpha-3, e.g. "USA").
/// JS side: js/native.js -> Capacitor.registerPlugin('Storefront').getCountry().
/// Used only to decide whether upgrade/purchase links may be shown (App Store
/// guideline 3.1.1(a): external purchase CTAs are allowed on the US storefront only).
@objc(StorefrontPlugin)
public class StorefrontPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorefrontPlugin"
    public let jsName = "Storefront"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCountry", returnType: CAPPluginReturnPromise)
    ]

    @objc func getCountry(_ call: CAPPluginCall) {
        Task {
            if let storefront = await Storefront.current {
                call.resolve(["country": storefront.countryCode])
            } else if let code = SKPaymentQueue.default().storefront?.countryCode {
                call.resolve(["country": code])
            } else {
                call.resolve(["country": ""])
            }
        }
    }
}
