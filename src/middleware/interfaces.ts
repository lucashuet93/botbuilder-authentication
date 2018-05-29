import { TurnContext, Activity } from 'botbuilder';
import { AccessToken } from 'simple-oauth2';
import { ProviderType } from './enums';

//----------------------------Config-------------------------//

export interface BotAuthenticationConfiguration {
	userIsAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: string, provider: ProviderType) => Promise<void> | void;
	onLoginFailure: (context: TurnContext, provider: ProviderType) => Promise<void> | void;
	createCustomAuthenticationCard?: (context: TurnContext, authorizationUris: ProviderAuthorizationUri[]) => Promise<Partial<Activity>> | Partial<Activity>;
	facebook?: ProviderConfiguration;
	activeDirectory?: ProviderConfiguration;
	google?: ProviderConfiguration;
	github?: ProviderConfiguration;
	noUserFoundMessage?: string;
}

export interface ProviderConfiguration {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

//------------------Authorization Uris-------------------//

export interface ProviderAuthorizationUri {
	provider: ProviderType;
	authorizationUri: string;
}

//------------------Provider Default Options-------------------//

export interface ProviderDefaultOptions {
	facebook: ProviderDefaults;
	activeDirectory: ProviderDefaults;
	google: ProviderDefaults;
	github: ProviderDefaults;
}

export interface ProviderDefaults {
	scopes: string[];
	buttonText: string;
}

//----------------------OAuth Endpoints------------------------//

export interface OAuthEndpointsConfiguration {
	activeDirectory: OAuthEndpoints;
	github: OAuthEndpoints;
}

export interface OAuthEndpoints {
	tokenBaseUrl: string;
	tokenEndpoint: string;
	authorizationBaseUrl: string;
	authorizationEndpoint: string;
}
