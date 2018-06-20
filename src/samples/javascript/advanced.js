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
		clientId: 'FACEBOOK_CLIENT_ID',
		clientSecret: 'FACEBOOK_CLIENT_SECRET',
		scopes: ['public_profile', 'email', 'user_likes']
	},
	azureADv1: {
		clientId: 'AZURE_AD_V1_CLIENT_ID',
		clientSecret: 'AZURE_AD_V1_CLIENT_SECRET',
		scopes: ['User.Read', 'User.ReadBasic'],
		tenant: 'microsoft.onmicrosoft.com',
		resource: 'https://graph.windows.net'
	},
	azureADv2: {
		clientId: 'AZURE_AD_V2_CLIENT_ID',
		clientSecret: 'AZURE_AD_V2_CLIENT_SECRET',
		scopes: ['profile', 'offline_access', 'https://graph.microsoft.com/mail.read'],
		tenant: 'microsoft.onmicrosoft.com'
	},
	google: {
		clientId: 'GOOGLE_CLIENT_ID',
		clientSecret: 'GOOGLE_CLIENT_SECRET',
		scopes: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/gmail.send']
	},
	twitter: {
		consumerKey: 'TWITTER_CONSUMER_KEY',
		consumerSecret: 'TWITTER_CONSUMER_SECRET'
	},
	github: {
		clientId: 'GITHUB_CLIENT_ID',
		clientSecret: 'GITHUB_CLIENT_SECRET',
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