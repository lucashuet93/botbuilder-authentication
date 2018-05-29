import { TurnContext } from 'botbuilder';
import { AccessToken } from 'simple-oauth2';
import { ProviderType } from './enums';

export { AccessToken } from 'simple-oauth2';

//----------------------------Config-------------------------//

export interface BotAuthenticationConfiguration {
	userIsAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: string, provider: ProviderType) => Promise<void> | void;
	onLoginFailure: (context: TurnContext, provider: ProviderType) => Promise<void> | void;
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
