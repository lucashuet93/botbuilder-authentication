export declare const defaultProviderOptions: DefaultProviderOptions;
export interface DefaultProviderOptions {
    /**
     * Facebook default options.
    */
    facebook: ProviderDefaults;
    /**
     * Azure AD V2 default options.
    */
    azureADv1: AzureADDefaults;
    /**
     * Azure AD V2 default options.
    */
    azureADv2: AzureADDefaults;
    /**
     * Google default options.
    */
    google: ProviderDefaults;
    /**
     * Twitter default options.
    */
    twitter: ProviderDefaults;
    /**
     * GitHub default options.
    */
    github: ProviderDefaults;
}
export interface ProviderDefaults {
    /**
     * Scopes that the user will be asked to consent to as part of the authentication flow.
    */
    scopes: string[];
    /**
     * Text displayed inside the button that triggers the provider's authentication flow.
    */
    buttonText: string;
}
export interface AzureADDefaults extends ProviderDefaults {
    /**
     * Organizational tenant domain.
    */
    tenant: string;
    /**
     * Identifier of the WebAPI that your client wants to access on behalf of the user.
    */
    resource: string;
}
