import { TurnContext } from 'botbuilder';
import { AccessToken } from 'simple-oauth2';

export { AccessToken } from 'simple-oauth2';

//------------Config-------------//

export interface AuthenticationConfig {
	userIsAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: AccessToken) => Promise<void> | void;
	noUserFoundMessage?: string;
	facebook?: FacebookConfig;
	activeDirectory?: ActiveDirectoryConfig;
	github?: GithubConfig;
}

export interface FacebookConfig {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

export interface GithubConfig {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

export interface ActiveDirectoryConfig {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

//------------Known Endpoints-------------//

export interface KnownEndpointsConfig {
	facebook: KnownEndpoints;
	activeDirectory: KnownEndpoints;
	github: KnownEndpoints;
}

export interface KnownEndpoints {
	tokenBaseUrl: string;
	tokenEndpoint: string;
	authorizationBaseUrl: string;
	authorizationEndpoint: string;
}

//------------Enums-------------//

export enum StrategyType {
	ActiveDirectory = 'ActiveDirectory',
	Facebook = 'Facebook',
	Github = 'Github'
}