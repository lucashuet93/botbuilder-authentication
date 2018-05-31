import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem, Activity, Attachment, CardFactory, MessageFactory, CardAction } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, ProviderType, ProviderAuthorizationUri } from '../../botbuilder-simple-authentication';

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
			await context.sendActivity(`You said ${context.activity.text}`);
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
	}
};

adapter.use(new BotAuthenticationMiddleware(server, adapter, authenticationConfig));

