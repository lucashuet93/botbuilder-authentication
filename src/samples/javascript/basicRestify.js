let builder = require('botbuilder');
let simpleAuth = require('../../botbuilder-simple-authentication');
let restify = require('restify');

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
	onLoginSuccess: async (context, accessToken, profile, provider) => {
		//the middleware passes over the access token and profile retrieved for the user
		const state = conversationState.get(context);
		state.authData = { accessToken, profile, provider };
		await context.sendActivity(`Hi there ${profile.displayName}!`);
	},
	facebook: {
		clientId: 'FACEBOOK_CLIENT_ID',
		clientSecret: 'FACEBOOK_CLIENT_SECRET'
	},
	//the middleware will only use the Azure AD V2 credentials if both versions are provided
	azureADv1: {
		clientId: 'AZURE_AD_V1_CLIENT_ID',
		clientSecret: 'AZURE_AD_V1_CLIENT_SECRET'
	},
	azureADv2: {
		clientId: 'AZURE_AD_V2_CLIENT_ID',
		clientSecret: 'AZURE_AD_V2_CLIENT_SECRET'
	},
	google: {
		clientId: 'GOOGLE_CLIENT_ID',
		clientSecret: 'GOOGLE_CLIENT_SECRET'
	},
	twitter: {
		consumerKey: 'TWITTER_CONSUMER_KEY',
		consumerSecret: 'TWITTER_CONSUMER_SECRET'
	},
	github: {
		clientId: 'GITHUB_CLIENT_ID',
		clientSecret: 'GITHUB_CLIENT_SECRET'
	}
};

adapter.use(new simpleAuth.BotAuthenticationMiddleware(server, authenticationConfig));