import { DefaultProviderOptions } from './interfaces';

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