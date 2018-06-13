import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem, Activity, Attachment, CardFactory, MessageFactory, CardAction } from 'botbuilder';
import { createServer, Server, Request, Response, plugins } from 'restify';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, ProviderType, ProviderAuthorizationUri } from '../../botbuilder-simple-authentication';

let server: Server = createServer();
let port: any = process.env.PORT || 3978;

server.use(plugins.queryParser());
server.use(plugins.bodyParser());

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
		//if this method returns false, the middleware will take over
		const state: StoreItem = conversationState.get(context) as StoreItem;
		return state.authData;
	},
	onLoginSuccess: async (context: TurnContext, accessToken: string, provider: ProviderType): Promise<void> => {
		//the middleware passes over the access token retrieved for the user
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.authData = { accessToken, provider };
		await context.sendActivity(`You're logged in!`);
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	},
	azureADv2: {
		clientId: '934ab9ef-ad3e-4661-a265-910f78cfd57b',
		clientSecret: 'bhchfIQN348[^foKKOG54||'
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb'
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7'
	}
};

adapter.use(new BotAuthenticationMiddleware(server, authenticationConfig));