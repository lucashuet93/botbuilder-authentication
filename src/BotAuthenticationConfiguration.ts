import { TurnContext, Activity } from 'botbuilder';

/**
 * Defines available authentication providers.
 * @enum {string}
 */
export enum ProviderType {
    AzureADv2 = 'azureADv2',
    Facebook = 'facebook',
    Google = 'google',
    Twitter = 'twitter',
    Github = 'github'
}

export interface BotAuthenticationConfiguration {
	/**
     * Runs each converation turn. The middleware will prevent the bot logic from running when it returns false.
    */
    isUserAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	/**
     * Runs when the user inputs the correct magic code. The middleware passes the user's access token.
    */
    onLoginSuccess: (context: TurnContext, accessToken: string, provider: ProviderType) => Promise<void> | void;
	/**
     * (Optional) Runs when the user inputs an incorrect magic code. The middleware will force another login attempt by default.
    */
    onLoginFailure?: (context: TurnContext, provider: ProviderType) => Promise<void> | void;
	/**
     * (Optional) Overrides the default Authentication Card. The middleware supplies the authorization uris necessary to build the card.
    */
    customAuthenticationCardGenerator?: (context: TurnContext, authorizationUris: ProviderAuthorizationUri[]) => Promise<Partial<Activity>> | Partial<Activity>;
    /**
     * (Optional) Overrides the default magic code display page. The server endpoint provided will receive a redirect with the magic code in the query string.
    */
    customMagicCodeRedirectEndpoint?: string;
    /**
     * (Optional) Message sent on first conversation turn where the user is not authenticated, immediately prior to the Authentication Card. 
    */
    noUserFoundMessage?: string;
    /**
     * (Optional) Configuration object that enables Facebook authentication
    */
    facebook?: DefaultProviderConfiguration;
    /**
     * (Optional) Configuration object that enables Azure AD V2 authentication
    */
    azureADv2?: AzureADv2Configuration;
    /**
     * (Optional) Configuration object that enables Google authentication
    */
    google?: DefaultProviderConfiguration;
    /**
     * (Optional) Configuration object that enables Twitter authentication
    */
    twitter?: TwitterConfiguration;
    /**
     * (Optional) Configuration object that enables GitHub authentication
    */
    github?: DefaultProviderConfiguration;
}

export interface DefaultProviderConfiguration {
    /**
     * ClientId taken from the provider's authentication application.
    */
    clientId: string;
    /**
     * ClientSecret taken from the provider's authentication application.
    */
    clientSecret: string;
    /**
     * (Optional) Scopes that the user will be asked to consent to as part of the authentication flow.
    */
    scopes?: string[];
    /**
     * (Optional) Text displayed inside the button that triggers the provider's authentication flow.
    */
    buttonText?: string;
}

export interface TwitterConfiguration {
    /**
     * ConsumerKey taken from the Twitter Application Management page.
    */
    consumerKey: string;
    /**
     * ConsumerSecret taken from the Twitter Application Management page.
    */
    consumerSecret: string;
    /**
     * (Optional) Text displayed inside the button that triggers the provider's authentication flow.
    */
    buttonText?: string;
}

export interface AzureADv2Configuration extends DefaultProviderConfiguration {
    /**
     * (Optional) Organizational tenant domain.
    */
    tenant?: string;
}

export interface ProviderAuthorizationUri {
    /**
     * Selected authentication provider
    */
    provider: ProviderType;
    /**
     * Uri that triggers authentication flow once opened.
    */
    authorizationUri: string;
}