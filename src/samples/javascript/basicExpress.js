let builder = require('botbuilder');
let simpleAuth = require('../../botbuilder-simple-authentication');
let express = require('express');


let app = express();
let router = express.Router();
app.use('/', router);

let port = process.env.PORT || 3978;

app.listen(port, () => {
	console.log(`Magic happening on ${port}`);
});

let adapter = new builder.BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

let storage = new builder.MemoryStorage();
const conversationState = new builder.ConversationState(storage);
adapter.use(conversationState);

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
	},
	azureADv2: {
		clientId: '934ab9ef-ad3e-4661-a265-910f78cfd57b',
		clientSecret: 'bhchfIQN348[^foKKOG54||'
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb'
	},
	twitter: {
		consumerKey: 'nJzeqg5RuQ1FFgLS7OSiDHAKa',
		consumerSecret: 'IZY0m0BuvFag922x9MFRRcbAcAEDEsXZNXSmw87bMbuTGG3aBD'
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7'
	}
};

//could also send in an Express Application directly
//adapter.use(new BotAuthenticationMiddleware(app, authenticationConfig));
adapter.use(new simpleAuth.BotAuthenticationMiddleware(router, authenticationConfig));

router.post('/api/messages', (req, res) => {
	adapter.processActivity(req, res, async (context) => {
		if (context.activity.type === 'message') {
			await context.sendActivity(`You said ${context.activity.text}`);
		};
	});
});