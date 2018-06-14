//basic scopes and text options to be used by default
export const defaultProviderOptions: DefaultProviderOptions = {
	facebook: {
		scopes: ['public_profile'],
		buttonText: 'Log in with Facebook'
	},
	azureADv2: {
		scopes: ['User.Read'],
		buttonText: 'Log in with Microsoft',
		tenant: 'common',
		resource: 'https://graph.windows.net'
	},
	google: {
		scopes: ['https://www.googleapis.com/auth/plus.login'],
		buttonText: 'Log in with Google+'
	},
	github: {
		scopes: ['user'],
		buttonText: 'Log in with GitHub'
	}
}

export interface DefaultProviderOptions {
    /**
     * Facebook default options.
    */
	facebook: ProviderDefaults;
    /**
     * Azure AD V2 default options.
    */
	azureADv2: AzureADv2Defaults;
    /**
     * Google default options.
    */
	google: ProviderDefaults;
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

export interface AzureADv2Defaults extends ProviderDefaults {
    /**
     * Organizational tenant domain.
    */
	tenant: string;
    /**
     * Identifier of the WebAPI that your client wants to access on behalf of the user.
    */
	resource: string;
}