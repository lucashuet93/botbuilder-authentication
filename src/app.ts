import { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext, StoreItem } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { AuthenticationMiddleware } from './AuthenticationMiddleware';
import { AuthenticationConfig, AccessToken, ProviderType } from './interfaces';

let passport = require('passport');

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

const authenticationConfig: AuthenticationConfig = {
	userIsAuthenticated: (context: TurnContext): boolean => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		return state.isAuthenticated;
	},
	onLoginSuccess: (context: TurnContext, accessToken: AccessToken, provider: ProviderType): void => {
		const state: StoreItem = conversationState.get(context) as StoreItem;
		state.facebookAccessToken = accessToken;
		state.isAuthenticated = true;
		console.log("ACCESS TOKEN", provider, accessToken)
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
	}
}

adapter.use(new AuthenticationMiddleware(server, adapter, authenticationConfig));

