export interface OAuthEndpointsConfiguration {
	facebook: OAuthEndpoints;
	activeDirectory: OAuthEndpoints;
	github: OAuthEndpoints;
}

export interface OAuthEndpoints {
	tokenBaseUrl: string;
	tokenEndpoint: string;
	authorizationBaseUrl: string;
	authorizationEndpoint: string;
}

export const oauthEndpoints: OAuthEndpointsConfiguration = {
	facebook: {
		tokenBaseUrl: 'https://graph.facebook.com',
		tokenEndpoint: '/v3.0/oauth/access_token',
		authorizationBaseUrl: 'https://www.facebook.com',
		authorizationEndpoint: '/v3.0/dialog/oauth'
	},
	activeDirectory: {
		tokenBaseUrl: 'https://login.microsoftonline.com',
		tokenEndpoint: '/common/oauth2/v2.0/token',
		authorizationBaseUrl: 'https://login.microsoftonline.com',
		authorizationEndpoint: '/common/oauth2/v2.0/authorize'
	},
	github: {
		tokenBaseUrl: 'https://github.com',
		tokenEndpoint: '/login/oauth/access_token',
		authorizationBaseUrl: 'https://github.com',
		authorizationEndpoint: '/login/oauth/authorize'
	}
}