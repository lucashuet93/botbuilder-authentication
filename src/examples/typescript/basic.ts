import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem, Activity, Attachment, CardFactory, MessageFactory, CardAction } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, ProviderType, ProviderAuthorizationUri } from '../../botbuilder-simple-authentication';

let server: Server = createServer();
let port: any = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`)
});

let adapter = new BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

const conversationState = new ConversationState(new MemoryStorage());
adapter.use(conversationState);

server.post('/api/messages', (req: Request, res: Response) => {
	adapter.processActivity(req, res, async (context: TurnContext) => {
		if (context.activity.type === 'message') {
			await context.sendActivity(`You said ${context.activity.text}`)
		}
	})
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
		await context.sendActivity(`You're logged in!`)
	},
	onLoginFailure: async (context: TurnContext, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		await context.sendActivity('Login failed.')
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	}
};

adapter.use(new BotAuthenticationMiddleware(server, adapter, authenticationConfig));

