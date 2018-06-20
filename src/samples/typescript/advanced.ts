import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem, Activity, Attachment, CardFactory, MessageFactory, CardAction } from 'botbuilder';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, ProviderType, ProviderAuthorizationUri } from '../../index';
import { createServer, Server, Request, Response, Next, plugins } from 'restify';
import * as path from 'path';

let server: Server = createServer();
let port: any = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`);
});

let adapter = new BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

let storage: MemoryStorage = new MemoryStorage();
const conversationState: ConversationState = new ConversationState(storage);
adapter.use(conversationState);

server.post('/api/messages', (req: Request, res: Response) => {
	adapter.processActivity(req, res, async (context: TurnContext) => {
		if (context.activity.type === 'message') {
			const state: StoreItem = conversationState.get(context) as StoreItem;
			if (context.activity.text === 'logout') {
				state.authData = undefined;
				await context.sendActivity(`You're logged out!`);
			} else {
				await context.sendActivity(`You said ${context.activity.text}`);
			};
		};
	});
});

//----------------------------------------- USAGE --------------------------------------------------------//

const authenticationConfig: BotAuthenticationConfiguration = {
	isUserAuthenticated: (context: TurnContext): boolean => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		return state.authData;
	},
	onLoginSuccess: async (context: TurnContext, accessToken: string, profile: any, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.authData = { accessToken, profile, provider };
		await context.sendActivity(`Hi there ${profile.displayName}!`);
	},
	onLoginFailure: async (context: TurnContext, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		await context.sendActivity('Login failed.');
	},	
	facebook: {
		clientId: 'FACEBOOK_CLIENT_ID',
		clientSecret: 'FACEBOOK_CLIENT_SECRET',
		scopes: ['public_profile', 'email', 'user_likes']
	},
	azureADv1: {
		clientId: 'AZURE_AD_V1_CLIENT_ID',
		clientSecret: 'AZURE_AD_V1_CLIENT_SECRET',
		scopes: ['User.Read', 'User.ReadBasic'],
		tenant: 'microsoft.onmicrosoft.com',
		resource: 'https://graph.windows.net'
	},
	azureADv2: {
		clientId: 'AZURE_AD_V2_CLIENT_ID',
		clientSecret: 'AZURE_AD_V2_CLIENT_SECRET',
		scopes: ['profile', 'offline_access', 'https://graph.microsoft.com/mail.read'],
		tenant: 'microsoft.onmicrosoft.com'
	},
	google: {
		clientId: 'GOOGLE_CLIENT_ID',
		clientSecret: 'GOOGLE_CLIENT_SECRET',
		scopes: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/gmail.send']
	},
	twitter: {
		consumerKey: 'TWITTER_CONSUMER_KEY',
		consumerSecret: 'TWITTER_CONSUMER_SECRET'
	},
	github: {
		clientId: 'GITHUB_CLIENT_ID',
		clientSecret: 'GITHUB_CLIENT_SECRET',
		scopes: ['user', 'notifications']
	},
	noUserFoundMessage: `Please select an authentication provider...`,
	customAuthenticationCardGenerator: async (context: TurnContext, authorizationUris: ProviderAuthorizationUri[]): Promise<Partial<Activity>> => {
		let cardActions: CardAction[] = [];
		let buttonTitle: string;
		authorizationUris.map((auth: ProviderAuthorizationUri) => {
			if (auth.provider === ProviderType.AzureADv1 || auth.provider === ProviderType.AzureADv2) {
				buttonTitle = 'Microsoft';
			} else if (auth.provider === ProviderType.Facebook) {
				buttonTitle = 'Facebook';
			} else if (auth.provider === ProviderType.Google) {
				buttonTitle = 'Google';
			} else if (auth.provider === ProviderType.Twitter) {
				buttonTitle = 'Twitter';
			} else if (auth.provider === ProviderType.Github) {
				buttonTitle = 'GitHub';
			}
			cardActions.push({ type: 'openUrl', value: auth.authorizationUri, title: buttonTitle });
		});
		let card: Attachment = CardFactory.heroCard('', ['https://qualiscare.com/wp-content/uploads/2017/08/default-user.png'], cardActions);
		let authMessage: Partial<Activity> = MessageFactory.attachment(card);
		return authMessage;
	},
	customMagicCodeRedirectEndpoint: '/customCode'
};

server.get('/customCode', (req: Request, res: Response, next: Next) => {
	//simple redirect where we set the code in the hash and pull it down on the webpage that restify will serve at this endpoint
	let magicCode: string = req.query.magicCode;
	let hashedUrl = `/renderCustomCode#${magicCode}`;
	res.redirect(302, hashedUrl, next);
});

server.get('/renderCustomCode', plugins.serveStatic({
	//need a public folder in the same directory as this file that contains an index.html page expecting a hash
	'directory': path.join(__dirname, 'public'),
	'file': 'index.html'
}));

adapter.use(new BotAuthenticationMiddleware(server, authenticationConfig));