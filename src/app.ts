import { BotFrameworkAdapter, MemoryStorage, ConversationState, MessageFactory, CardFactory } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { create as createOAuth, ModuleOptions, OAuthClient } from 'simple-oauth2';

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

let storage: MemoryStorage = new MemoryStorage();
let conversationState: ConversationState = new ConversationState(storage);

adapter.use(conversationState);

server.post('/api/messages', (req: Request, res: Response) => {
	adapter.processActivity(req, res, async (context: any) => {
		if (context.activity.type === 'message') {
			let state: any = conversationState.get(context);
			if (!state.authData) {
				//run auth
				let cardActions = [{ type: "openUrl", value: 'http://localhost:3978/auth/facebook', title: "Log in with Facebook" }];
				let card = CardFactory.thumbnailCard("", undefined, cardActions);
				let facebookAuthMessage = MessageFactory.attachment(card);
				await context.sendActivity(facebookAuthMessage);
			} else {
				//echo
				await context.sendActivity(`You said ${context.activity.text}`)
			}
		}
	})
})

//---------------------Facebook----------------//

//Given credentials

let callbackURL = 'http://localhost:3978/auth/callback';

let facebookClientId = '174907033110091';
let facebookClientSecret = '482d08e1fa468e10d478ccc772452f24';
let facebookBaseUrl = 'https://graph.facebook.com';
let facebookTokenEndpoint = '/v2.11/oauth/access_token';
let facebookAuthorizationEndpoint = '/v2.11/dialog/oauth';

//Create OAuth client

const credentials: ModuleOptions = {
	client: {
		id: facebookClientId,
		secret: facebookClientSecret
	},
	auth: {
		tokenHost: facebookBaseUrl,
		authorizePath: facebookAuthorizationEndpoint,
		tokenPath: facebookTokenEndpoint
	}
};
const oauth2: OAuthClient = createOAuth(credentials);

passport.use(new FacebookStrategy({
	clientID: facebookClientId,
	clientSecret: facebookClientSecret,
	callbackURL: callbackURL
}, (accessToken: string, refreshToken: string, profile: FacebookProfile, done: Function) => {
	//handle token
	console.log(accessToken, refreshToken, profile, done)
	done();
}));

server.get('/auth/facebook', passport.authenticate('facebook'));

server.get('/auth/callback', (req: Request, res: Response) => {
	let code = req.query().split("&")[0].slice(5);
	const tokenConfig = {
		code: code,
		redirect_uri: callbackURL
	};
	console.log(tokenConfig)
	oauth2.authorizationCode.getToken(tokenConfig)
		.then((result: any) => {
			const accessToken = oauth2.accessToken.create(result);
			console.log("ACCESS", accessToken)
		})
		.catch((error: any) => {
			console.log('Access Token Error', error);
		});
	res.send("Code to come")
});
