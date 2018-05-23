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
				await context.sendActivity(createFacebookCard());
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
let facebookBaseAuthorizationUrl = 'https://www.facebook.com';
let facebookBaseTokenUrl = 'https://graph.facebook.com';
let facebookAuthorizationEndpoint = '/v3.0/dialog/oauth';
let facebookTokenEndpoint = '/v3.0/oauth/access_token';

//Create OAuth client
const credentials: ModuleOptions = {
	client: {
		id: facebookClientId,
		secret: facebookClientSecret
	},
	auth: {
		authorizeHost: facebookBaseAuthorizationUrl,
		tokenHost: facebookBaseTokenUrl,
		authorizePath: facebookAuthorizationEndpoint,
		tokenPath: facebookTokenEndpoint
	}
};
const oauth2: OAuthClient = createOAuth(credentials);

//Open Url for Facebook authorization 
const createFacebookCard = () => {
	const authorizationUri: string = oauth2.authorizationCode.authorizeURL({
		redirect_uri: callbackURL,
		scope: [],
		state: undefined
	});
	let cardActions = [{ type: "openUrl", value: authorizationUri, title: "Log in with Facebook" }];
	let card = CardFactory.thumbnailCard("", undefined, cardActions);
	let facebookAuthMessage = MessageFactory.attachment(card);
	return facebookAuthMessage;
}

//Create redirect endpoint for inital authorization code
server.get('/auth/callback', (req: Request, res: Response) => {
	let code = req.query().split("&")[0].slice(5);
	const tokenConfig = {
		code: code,
		redirect_uri: callbackURL
	};
	oauth2.authorizationCode.getToken(tokenConfig)
		.then((result: any) => {
			const accessToken = oauth2.accessToken.create(result);
			console.log("ACCESS", accessToken)
			res.send("Code to come")
		})
		.catch((error: any) => {
			console.log('Access Token Error', error);
		});
});
