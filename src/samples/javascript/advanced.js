let builder = require('botbuilder');
let simpleAuth = require('../../botbuilder-simple-authentication');
let restify = require('restify');
let path = require('path');

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
			const state = conversationState.get(context);
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

const authenticationConfig = {
	isUserAuthenticated: (context) => {
		const state = conversationState.get(context);
		return state.authData;
	},
	onLoginSuccess: async (context, accessToken, profile, provider) => {
		const state = conversationState.get(context);
		state.authData = { accessToken, profile, provider };
		await context.sendActivity(`Hi there ${profile.displayName}!`);
	},
	onLoginFailure: async (context, provider) => {
		const state = conversationState.get(context);
		await context.sendActivity('Login failed.');
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24',
		scopes: ['public_profile', 'email', 'user_likes']
	},
	azureADv1: {
		clientId: 'bac92c74-e2b3-4dff-b581-117ce4123f72',
		clientSecret: 'VBqnvid29m5yZJQluprwgzWUcOB5eCGIGYElTzfTwDA=',
		scopes: ['User.Read', 'User.ReadBasic'],
		tenant: 'microsoft.onmicrosoft.com',
		resource: 'https://graph.windows.net'
	},
	azureADv2: {
		clientId: '2b000a30-1af6-4ad8-b618-85268eada84a',
		clientSecret: 'uzjyQJ4491[~duaLYPHM9=~',
		scopes: ['profile', 'offline_access', 'https://graph.microsoft.com/mail.read'],
		tenant: 'microsoft.onmicrosoft.com'
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb',
		scopes: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/gmail.send']
	},
	twitter: {
		consumerKey: 'nJzeqg5RuQ1FFgLS7OSiDHAKa',
		consumerSecret: 'IZY0m0BuvFag922x9MFRRcbAcAEDEsXZNXSmw87bMbuTGG3aBD'
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7',
		scopes: ['user', 'notifications']
	},
	noUserFoundMessage: `Please select an authentication provider...`,
	customAuthenticationCardGenerator: async (context, authorizationUris) => {
		let cardActions = [];
		let buttonTitle;
		authorizationUris.map((auth) => {
			if (auth.provider === 'azureADv1' || auth.provider === 'azureADv2') {
				buttonTitle = 'Microsoft';
			} else if (auth.provider === 'facebook') {
				buttonTitle = 'Facebook';
			} else if (auth.provider === 'google') {
				buttonTitle = 'Google';
			} else if (auth.provider === 'twitter') {
				buttonTitle = 'Twitter';
			} else if (auth.provider === 'github') {
				buttonTitle = 'GitHub';
			}
			cardActions.push({ type: 'openUrl', value: auth.authorizationUri, title: buttonTitle });
		});
		let card = builder.CardFactory.heroCard('', ['https://qualiscare.com/wp-content/uploads/2017/08/default-user.png'], cardActions);
		let authMessage = builder.MessageFactory.attachment(card);
		return authMessage;
	},
	customMagicCodeRedirectEndpoint: '/customCode'
};

server.get('/customCode', (req, res, next) => {
	//simple redirect where we set the code in the hash and pull it down on the webpage that restify will serve at this endpoint
	let magicCode = req.query.magicCode;
	let hashedUrl = `/renderCustomCode#${magicCode}`;
	res.redirect(302, hashedUrl, next);
});

server.get('/renderCustomCode', restify.plugins.serveStatic({
	//need a public folder in the same directory as this file that contains an index.html page expecting a hash
	'directory': path.join(__dirname, 'public'),
	'file': 'index.html'
}));

adapter.use(new simpleAuth.BotAuthenticationMiddleware(server, authenticationConfig));