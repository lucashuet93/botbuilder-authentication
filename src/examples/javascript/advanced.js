let builder = require('botbuilder');
let restify = require('restify');
let path = require('path');
let simpleAuth = require('../../botbuilder-simple-authentication');

let server = restify.createServer();
let port = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`)
});

let adapter = new builder.BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

const conversationState = new builder.ConversationState(new builder.MemoryStorage());
adapter.use(conversationState);

server.post('/api/messages', (req, res) => {
	adapter.processActivity(req, res, async (context) => {
		if (context.activity.type === 'message') {
			const state = conversationState.get(context);
			if (context.activity.text === 'logout') {
				state.authData = undefined;
				await context.sendActivity(`You're logged out!`)
			} else {
				await context.sendActivity(`You said ${context.activity.text}`)
			}
		}
	})
})

//----------------------------------------- USAGE --------------------------------------------------------//

const authenticationConfig = {
	isUserAuthenticated: (context) => {
		const state = conversationState.get(context);
		return state.authData;
	},
	onLoginSuccess: async (context, accessToken, provider) => {
		const state = conversationState.get(context);
		state.authData = { accessToken, provider };
		await context.sendActivity(`You're logged in!`)
	},
	onLoginFailure: async (context, provider) => {
		const state = conversationState.get(context);
		await context.sendActivity('Login failed.')
	},
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	},
	activeDirectory: {
		clientId: '934ab9ef-ad3e-4661-a265-910f78cfd57b',
		clientSecret: 'bhchfIQN348[^foKKOG54||'
	},
	google: {
		clientId: '785481848945-dfmivt5k5qgkvnk2ar2par8vednh8hrr.apps.googleusercontent.com',
		clientSecret: '1rhqSfoGGS3nbIv_h8lFhUAb'
	},
	github: {
		clientId: 'f998ca5d45caba4cfac2',
		clientSecret: '322d492454f27e2d88c1fc5bfe5f9793d0e4c7d7'
	},
	noUserFoundMessage: `Hmm, it doesn't look like I have you authenticated...`,
	createCustomAuthenticationCard: async (context, authorizationUris) => {
		let cardActions = [];
		let buttonTitle;
		authorizationUris.map((auth) => {
			if (auth.provider === 'activeDirectory') {
				buttonTitle = 'Log in with Microsoft';
			} else if (auth.provider === 'facebook') {
				buttonTitle = 'Log in with Facebook';
			} else if (auth.provider === 'google') {
				buttonTitle = 'Log in with Google';
			} else if (auth.provider === 'github') {
				buttonTitle = 'Log in with GitHub';
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

adapter.use(new simpleAuth.BotAuthenticationMiddleware(server, adapter, authenticationConfig));

