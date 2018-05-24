
import { create as createOAuth, ModuleOptions, OAuthClient, AccessToken } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter } from 'botbuilder';
import { KnownEndpointsConfig, AuthenticationConfig } from './interfaces';

export class AuthenticationMiddleware {

	private authenticated: boolean;
	private server: Server;
	private adapter: BotFrameworkAdapter;
	private oauth2: OAuthClient;
	private knownEndpoints: KnownEndpointsConfig;
	private authenticationConfig: AuthenticationConfig;
	private callbackURL: string;
	private magicCode: string;
	private currentAccessToken: AccessToken | undefined;
	private sentCode: boolean;

	constructor(server: Server, adapter: BotFrameworkAdapter, authenticationConfig: AuthenticationConfig) {
		this.authenticated = false;
		this.server = server;
		this.adapter = adapter;
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
			if (!this.authenticationConfig.userIsAuthenticated(context)) {
				//run auth
				!this.sentCode ? await context.sendActivity(this.createAuthenticationCard(context)) : await this.handleMagicCode(context);
				return;
			} else {
				//immediately pass on authenticated messages
				await next();
			}
		} else {
			//immediately pass on non-messages
			await next();
		}
	}

	async handleMagicCode(context: TurnContext) {
		let submittedCode = context.activity.text;
		if (submittedCode.toLowerCase() === this.magicCode.toLowerCase()) {
			//recreate context and pass it and the access token to the user
			await this.authenticationConfig.onLoginSuccess(context, this.currentAccessToken!);
			//reset necessary properties
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = undefined;
			await context.sendActivity("Authentication Success");
		} else {
			//reset necessary properties
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = undefined;
			await context.sendActivity("Authentication Failure");
		}
	}

	createRedirectEndpoint() {
		//Create redirect endpoint for authorization code, then exchange it for access token and save necessary properties
		this.server.get('/auth/callback', (req: Request, res: Response) => {
			let code = req.query().split("&")[0].slice(5);
			const tokenConfig = {
				code: code,
				redirect_uri: this.callbackURL
			};
			this.oauth2.authorizationCode.getToken(tokenConfig)
				.then((result: any) => {
					const accessToken: AccessToken = this.oauth2.accessToken.create(result);
					let magicCode: string = randomBytes(4).toString('hex');
					this.currentAccessToken = accessToken;
					this.magicCode = magicCode;
					this.sentCode = true;
					res.send(`Please enter the code into the bot: ${magicCode}`);
				})
				.catch((error: any) => {
					console.log('Access Token Error', error);
				});
		});
	}

	createAuthenticationCard = (context: TurnContext) => {
		//Open Url for Facebook authorization 
		const authorizationUri: string = this.oauth2.authorizationCode.authorizeURL({
			redirect_uri: this.callbackURL,
			scope: this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : [],
			state: undefined
		});
		let cardActions = [{ type: "openUrl", value: authorizationUri, title: "Log in with Facebook" }];
		let card = CardFactory.thumbnailCard("", undefined, cardActions);
		let facebookAuthMessage = MessageFactory.attachment(card);
		return facebookAuthMessage;
	}
}