
import { create as createOAuth, ModuleOptions, OAuthClient } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory } from 'botbuilder';
import { KnownEndpointsConfig, AuthenticationConfig } from './interfaces';

export class AuthenticationHelper {

	private authenticated: boolean;
	private server: Server;
	private oauth2: OAuthClient;
	private knownEndpoints: KnownEndpointsConfig;
	private authenticationConfig: AuthenticationConfig;
	private callbackURL: string;

	constructor(server: Server, authenticationConfig: AuthenticationConfig) {
		this.authenticated = false;
		this.server = server;
		this.authenticationConfig = authenticationConfig;
		this.knownEndpoints = {
			facebook: {
				tokenBaseUrl: 'https://graph.facebook.com',
				tokenEndpoint: '/v3.0/oauth/access_token',
				authorizationBaseUrl: 'https://www.facebook.com',
				authorizationEndpoint: '/v3.0/dialog/oauth',
			}
		}
		this.callbackURL = 'http://localhost:3978/auth/callback';

		//Create OAuth client
		const credentials: ModuleOptions = {
			client: {
				id: this.authenticationConfig.facebook.clientId,
				secret: this.authenticationConfig.facebook.clientSecret
			},
			auth: {
				authorizeHost: this.knownEndpoints.facebook.authorizationBaseUrl,
				authorizePath: this.knownEndpoints.facebook.authorizationEndpoint,
				tokenHost: this.knownEndpoints.facebook.tokenBaseUrl,
				tokenPath: this.knownEndpoints.facebook.tokenEndpoint
			}
		};
		this.oauth2 = createOAuth(credentials);
		this.createRedirectEndpoint();
	}

	async onTurn(context: TurnContext, next: Function) {
		if (context.activity.type === 'message') {
			if (!this.authenticated) {
				//run auth
				await context.sendActivity(this.createFacebookCard(context));
				return;
			} else {
				next();
			}
		} else {
			next();
		}
	}

	createRedirectEndpoint() {
		//Create redirect endpoint for inital authorization code
		this.server.get('/auth/callback', (req: Request, res: Response) => {
			let code = req.query().split("&")[0].slice(5);
			let contextReference: Activity = JSON.parse(decodeURIComponent(req.query().split("&")[1].slice(6)));
			const tokenConfig = {
				code: code,
				redirect_uri: this.callbackURL
			};
			this.oauth2.authorizationCode.getToken(tokenConfig)
				.then((result: any) => {
					const accessToken = this.oauth2.accessToken.create(result);
					console.log("ACCESS", accessToken)
					let magicCode: string = randomBytes(4).toString('hex');
					res.send(`Please enter the code into the bot: ${magicCode}`);
				})
				.catch((error: any) => {
					console.log('Access Token Error', error);
				});
		});
	}

	createFacebookCard = (context: TurnContext) => {
		//Open Url for Facebook authorization 
		const authorizationUri: string = this.oauth2.authorizationCode.authorizeURL({
			redirect_uri: this.callbackURL,
			scope: [],
			state: JSON.stringify(context.activity)
		});
		let cardActions = [{ type: "openUrl", value: authorizationUri, title: "Log in with Facebook" }];
		let card = CardFactory.thumbnailCard("", undefined, cardActions);
		let facebookAuthMessage = MessageFactory.attachment(card);
		return facebookAuthMessage;
	}
}