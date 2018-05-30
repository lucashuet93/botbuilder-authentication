import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem, Activity, Attachment, CardFactory, MessageFactory, CardAction } from 'botbuilder';
import { createServer, Server, Request, Response, Next, plugins } from 'restify';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, ProviderType, ProviderAuthorizationUri } from '../../botbuilder-simple-authentication';
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
	onLoginSuccess: async (context: TurnContext, accessToken: string, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.authData = { accessToken, provider };
		await context.sendActivity(`You're logged in!`);
	},
	onLoginFailure: async (context: TurnContext, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		await context.sendActivity('Login failed.');
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24',
		scopes: ['public_profile', 'email', 'user_likes']
	},
	activeDirectory: {
		clientId: '934ab9ef-ad3e-4661-a265-910f78cfd57b',
		clientSecret: 'bhchfIQN348[^foKKOG54||',
		scopes: ['User.Read', 'User.ReadBasic.All']
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb',
		scopes: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/gmail.send']
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7',
		scopes: ['user', 'notifications']
	},
	noUserFoundMessage: `Please select an authentication provider...`,
	customAuthenticationCardGenerator: async (context: TurnContext, authorizationUris: ProviderAuthorizationUri[]): Promise<Partial<Activity>> => {
		let cardActions: CardAction[] = [];
		let buttonTitle: string;
		authorizationUris.map((auth: ProviderAuthorizationUri) => {
			if (auth.provider === ProviderType.ActiveDirectory) {
				buttonTitle = 'Microsoft';
			} else if (auth.provider === ProviderType.Facebook) {
				buttonTitle = 'Facebook';
			} else if (auth.provider === ProviderType.Google) {
				buttonTitle = 'Google';
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

adapter.use(new BotAuthenticationMiddleware(server, adapter, authenticationConfig));

