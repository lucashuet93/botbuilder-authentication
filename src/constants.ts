import { DefaultProviderOptions } from './interfaces';

//basic scopes and text options to be used by default
export const defaultProviderOptions: DefaultProviderOptions = {
	facebook: {
		scopes: ['public_profile'],
		buttonText: 'Log in with Facebook'
	},
	azureADv2: {
		scopes: ['User.Read'],
		buttonText: 'Log in with Microsoft',
		tenant: 'common',
		resource: 'https://graph.windows.net'
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