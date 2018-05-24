import { TurnContext } from "botbuilder";
import { AccessToken } from "simple-oauth2";

export { AccessToken } from "simple-oauth2";

//------------Config-------------//

export interface AuthenticationConfig {
	userIsAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: AccessToken) => Promise<void> | void;
	facebook: FacebookConfig;
}

export interface FacebookConfig {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
}

//------------Known Endpoints-------------//

export interface KnownEndpointsConfig {
	facebook: KnownEndpoints;
}

export interface KnownEndpoints {
	tokenBaseUrl: string;
	tokenEndpoint: string;
	authorizationBaseUrl: string;
	authorizationEndpoint: string;
}

