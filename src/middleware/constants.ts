import { DefaultProviderOptions, OAuthEndpointsConfiguration } from './interfaces';

//basic scopes and text options to be used by default
export const defaultProviderOptions: DefaultProviderOptions = {
	facebook: {
		scopes: ['public_profile'],
		buttonText: 'Log in with Facebook'
	},
	activeDirectory: {
		scopes: ['User.Read'],
		buttonText: 'Log in with Microsoft'
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

//used to create authorization uris and exchange authorization codes for tokens
export const defaultOAuthEndpoints: OAuthEndpointsConfiguration = {
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