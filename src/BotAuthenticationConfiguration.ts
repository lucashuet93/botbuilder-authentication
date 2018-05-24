import { TurnContext } from 'botbuilder';
import { AccessToken } from 'simple-oauth2';

export { AccessToken } from 'simple-oauth2';

//------------Config-------------//

export interface BotAuthenticationConfiguration {
	userIsAuthenticated: (context: TurnContext) => Promise<boolean> | boolean;
	onLoginSuccess: (context: TurnContext, accessToken: AccessToken, provider: ProviderType) => Promise<void> | void;
	noUserFoundMessage?: string;
	facebook?: ProviderConfiguration;
	activeDirectory?: ProviderConfiguration;
	github?: ProviderConfiguration;
}

export interface ProviderConfiguration {
	clientId: string;
	clientSecret: string;
	scopes?: string[];
	buttonText?: string;
}

//------------Enums-------------//

export enum ProviderType {
	ActiveDirectory = 'ActiveDirectory',
	Facebook = 'Facebook',
	Github = 'Github'
}