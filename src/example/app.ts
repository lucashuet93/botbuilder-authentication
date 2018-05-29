import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { BotAuthenticationConfiguration, BotAuthenticationMiddleware, AccessToken, ProviderType } from '../botbuilder-simple-authentication';

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
			const state: StoreItem = conversationState.get(context) as StoreItem;
			if (context.activity.text === 'logout') {
				state.isAuthenticated = false;
				await context.sendActivity(`Logged out!`)
			} else {
				await context.sendActivity(`You said ${context.activity.text}`)
			}
		}
	})
})

//--------------------Usage-------------------------

const authenticationConfig: BotAuthenticationConfiguration = {
	userIsAuthenticated: (context: TurnContext): boolean => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		return state.isAuthenticated;
	},
	onLoginSuccess: async (context: TurnContext, accessToken: string, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.isAuthenticated = true;
		console.log("ACCESS TOKEN", accessToken, provider)
		await context.sendActivity("You're logged in!")		
	},
	onLoginFailure: async (context: TurnContext, provider: ProviderType): Promise<void> => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.isAuthenticated = false;
		await context.sendActivity("Login failed.")
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	},
	activeDirectory: {
		clientId: '934ab9ef-ad3e-4661-a265-910f78cfd57b',
		clientSecret: 'bhchfIQN348[^foKKOG54||'
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7'
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb'
	}
}

adapter.use(new BotAuthenticationMiddleware(server, adapter, authenticationConfig));

