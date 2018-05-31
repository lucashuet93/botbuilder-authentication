import { TurnContext, Activity } from 'botbuilder';
import { AccessToken } from 'simple-oauth2';
import { Request, Response, Next } from 'restify';
import { ProviderType } from './enums';

//--------------------------------------- CONFIGURATION -----------------------------------------//

export interface BotAuthenticationConfiguration {
	isUserAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: string, provider: ProviderType) => Promise<void> | void;
	onLoginFailure?: (context: TurnContext, provider: ProviderType) => Promise<void> | void;
	customAuthenticationCardGenerator?: (context: TurnContext, authorizationUris: ProviderAuthorizationUri[]) => Promise<Partial<Activity>> | Partial<Activity>;
	customMagicCodeRedirectEndpoint?: string; 
	noUserFoundMessage?: string;
	facebook?: ProviderConfiguration;
	activeDirectory?: ProviderConfiguration;
	google?: ProviderConfiguration;
	github?: ProviderConfiguration;
}

export interface ProviderConfiguration {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

export interface ProviderAuthorizationUri {
	provider: ProviderType;
	authorizationUri: string;
}

//--------------------------------- PROVIDER DEFAULT OPTIONS ----------------------------------//

export interface DefaultProviderOptions {
	facebook: ProviderDefaults;
	activeDirectory: ProviderDefaults;
	google: ProviderDefaults;
	github: ProviderDefaults;
}

export interface ProviderDefaults {
	scopes: string[];
	buttonText: string;
}

//-------------------------------------- OAUTH ENDPOINTS -------------------------------------//

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
