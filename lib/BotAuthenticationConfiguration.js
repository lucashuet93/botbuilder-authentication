"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Defines available authentication providers.
 * @enum {string}
 */
var ProviderType;
(function (ProviderType) {
    ProviderType["Facebook"] = "facebook";
    ProviderType["AzureADv1"] = "azureADv1";
    ProviderType["AzureADv2"] = "azureADv2";
    ProviderType["Google"] = "google";
    ProviderType["Twitter"] = "twitter";
    ProviderType["Github"] = "github";
})(ProviderType = exports.ProviderType || (exports.ProviderType = {}));
