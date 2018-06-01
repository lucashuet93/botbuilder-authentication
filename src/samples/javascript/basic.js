let builder = require('botbuilder');
let restify = require('restify');
let simpleAuth = require('../../botbuilder-simple-authentication');

let server = restify.createServer();
let port = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`);
});

let adapter = new builder.BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

let storage = new builder.MemoryStorage();
const conversationState = new builder.ConversationState(storage);
adapter.use(conversationState);

server.post('/api/messages', (req, res) => {
	adapter.processActivity(req, res, async (context) => {
		if (context.activity.type === 'message') {
			await context.sendActivity(`You said ${context.activity.text}`);
		};
	});
});

//----------------------------------------- USAGE --------------------------------------------------------//

const authenticationConfig = {
	isUserAuthenticated: (context) => {
		//if this method returns false, the middleware will take over
		const state = conversationState.get(context);
		return state.authData;
	},
	onLoginSuccess: async (context, accessToken, provider) => {
		//the middleware passes over the access token retrieved for the user
		const state = conversationState.get(context);
		state.authData = { accessToken, provider };
		await context.sendActivity(`You're logged in!`);
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	}
};

adapter.use(new simpleAuth.BotAuthenticationMiddleware(server, adapter, authenticationConfig));