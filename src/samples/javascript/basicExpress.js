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
	onLoginSuccess: async (context, accessToken, profile, provider) => {
		//the middleware passes over the access token and profile retrieved for the user
		const state = conversationState.get(context);
		state.authData = { accessToken, profile, provider };
		await context.sendActivity(`Hi there ${profile.displayName}!`);
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	},
	//the middleware will only use the Azure AD V2 credentials if both versions are provided
	azureADv1: {
		clientId: 'bac92c74-e2b3-4dff-b581-117ce4123f72',
		clientSecret: 'VBqnvid29m5yZJQluprwgzWUcOB5eCGIGYElTzfTwDA=',
	},
	azureADv2: {
		clientId: '2b000a30-1af6-4ad8-b618-85268eada84a',
		clientSecret: 'uzjyQJ4491[~duaLYPHM9=~',
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