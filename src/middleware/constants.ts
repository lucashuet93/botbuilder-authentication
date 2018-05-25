import { ProviderDefaultOptions, OAuthEndpointsConfiguration } from "./interfaces";

export const providerDefaultOptions: ProviderDefaultOptions = {
	facebook: {
		scopes: ['public_profile'],
		buttonText: 'Log in with Facebook'
	},
	activeDirectory: {
		scopes: ['User.Read'],
		buttonText: 'Log in with Microsoft'
	},
	github: {
		scopes: ['user'],
		buttonText: 'Log in with GitHub'
	},
}

export const oauthEndpoints: OAuthEndpointsConfiguration = {
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