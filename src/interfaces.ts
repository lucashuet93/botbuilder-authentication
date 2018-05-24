export interface KnownEndpoints {
	tokenBaseUrl: string;
	tokenEndpoint: string;
	authorizationBaseUrl: string;
	authorizationEndpoint: string;
}

export interface KnownEndpointsConfig {
	facebook: KnownEndpoints;
}

export interface FacebookConfig {
	clientId: string;
	clientSecret: string;
}

export interface AuthenticationConfig {
	facebook: FacebookConfig;
}