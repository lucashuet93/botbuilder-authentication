
import { create as createOAuth, ModuleOptions, OAuthClient, AccessToken } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter, CardAction, ThumbnailCard, Attachment } from 'botbuilder';
import { BotAuthenticationConfiguration, ProviderType } from './BotAuthenticationConfiguration';
import { OAuthEndpointsConfiguration, oauthEndpoints } from './OAuthEndpoints';

export class BotAuthenticationMiddleware {

	private server: Server;
	private adapter: BotFrameworkAdapter;
	private authenticationConfig: BotAuthenticationConfiguration;
	private callbackURL: string;
	private oauthEndpoints: OAuthEndpointsConfiguration;
	private oauthClients: {
		facebookOAuthClient: OAuthClient;
		activeDirectoryOAuthClient: OAuthClient;
		githubOAuthClient: OAuthClient;
	}
	private authenticated: boolean;
	private magicCode: string;
	private currentAccessToken: AccessToken | undefined;
	private sentCode: boolean;
	private selectedProvider: ProviderType;

	constructor(server: Server, adapter: BotFrameworkAdapter, authenticationConfig: BotAuthenticationConfiguration) {
		this.authenticated = false;
		this.server = server;
		this.adapter = adapter;
		this.authenticationConfig = authenticationConfig;
		this.oauthEndpoints = oauthEndpoints;
		this.callbackURL = 'http://localhost:3978/auth/callback';
		this.createRedirectEndpoint();
		this.createOAuthClients();
	}

	async onTurn(context: TurnContext, next: Function) {
		if (context.activity.type === 'message') {
			if (!this.authenticationConfig.userIsAuthenticated(context)) {
				//run auth
				if (!this.sentCode) {
					if (this.authenticationConfig.noUserFoundMessage) {
						await context.sendActivity(this.authenticationConfig.noUserFoundMessage);
					}
					await context.sendActivity(this.createAuthenticationCard(context))
				} else {
					await this.handleMagicCode(context);
				}
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

	async handleMagicCode(context: TurnContext): Promise<void> {
		let submittedCode: string = context.activity.text;
		if (submittedCode.toLowerCase() === this.magicCode.toLowerCase()) {
			//recreate context and pass it and the access token to the user
			await this.authenticationConfig.onLoginSuccess(context, this.currentAccessToken!, this.selectedProvider);
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

	createRedirectEndpoint(): void {
		//Create redirect endpoint for authorization code, then exchange it for access token and save necessary properties
		this.server.get('/auth/callback', (req: Request, res: Response) => {
			let code: string = req.query().split("&")[0].slice(5);
			const tokenConfig = {
				code: code,
				redirect_uri: this.callbackURL
			};
			//grab the correct provider passed over in query string state (from card)
			let state: string = decodeURIComponent(req.query().split("&")[1].slice(6));
			let selectedOAuthClient: OAuthClient;
			switch (state) {
				case ProviderType.ActiveDirectory:
					selectedOAuthClient = this.oauthClients.activeDirectoryOAuthClient;
					this.selectedProvider = ProviderType.ActiveDirectory;
					break;
				case ProviderType.Facebook:
					selectedOAuthClient = this.oauthClients.facebookOAuthClient;
					this.selectedProvider = ProviderType.Facebook;
					break;
				case ProviderType.Github:
					selectedOAuthClient = this.oauthClients.githubOAuthClient;
					this.selectedProvider = ProviderType.Github;
					break;
				default:
					selectedOAuthClient = this.oauthClients.activeDirectoryOAuthClient;
					this.selectedProvider = ProviderType.ActiveDirectory;
					break;
			}
			//exchange the authorization code for the access token
			selectedOAuthClient.authorizationCode.getToken(tokenConfig)
				.then((result: any) => {
					const accessToken: AccessToken = selectedOAuthClient.accessToken.create(result);
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
	createOAuthClients(): void {
		//Initialize OAuthClients - overcome javascript errors without adding nullability
		let initializationModule: ModuleOptions = {
			client: {
				id: '',
				secret: '',
			},
			auth: {
				tokenHost: this.oauthEndpoints.activeDirectory.tokenBaseUrl,
			}
		};
		this.oauthClients = {
			facebookOAuthClient: createOAuth(initializationModule),
			activeDirectoryOAuthClient: createOAuth(initializationModule),
			githubOAuthClient: createOAuth(initializationModule)
		}
		//Add providers the user passed configuration options for
		if (this.authenticationConfig.facebook) {
			const facebookCredentials: ModuleOptions = {
				client: {
					id: this.authenticationConfig.facebook.clientId,
					secret: this.authenticationConfig.facebook.clientSecret
				},
				auth: {
					authorizeHost: this.oauthEndpoints.facebook.authorizationBaseUrl,
					authorizePath: this.oauthEndpoints.facebook.authorizationEndpoint,
					tokenHost: this.oauthEndpoints.facebook.tokenBaseUrl,
					tokenPath: this.oauthEndpoints.facebook.tokenEndpoint
				}
			};
			this.oauthClients.facebookOAuthClient = createOAuth(facebookCredentials);
		}
		if (this.authenticationConfig.activeDirectory) {
			const activeDirectoryCredentials: ModuleOptions = {
				client: {
					id: this.authenticationConfig.activeDirectory.clientId,
					secret: this.authenticationConfig.activeDirectory.clientSecret
				},
				auth: {
					authorizeHost: this.oauthEndpoints.activeDirectory.authorizationBaseUrl,
					authorizePath: this.oauthEndpoints.activeDirectory.authorizationEndpoint,
					tokenHost: this.oauthEndpoints.activeDirectory.tokenBaseUrl,
					tokenPath: this.oauthEndpoints.activeDirectory.tokenEndpoint
				}
			};
			this.oauthClients.activeDirectoryOAuthClient = createOAuth(activeDirectoryCredentials);
		}
		if (this.authenticationConfig.github) {
			const githubCredentials: ModuleOptions = {
				client: {
					id: this.authenticationConfig.github.clientId,
					secret: this.authenticationConfig.github.clientSecret
				},
				auth: {
					authorizeHost: this.oauthEndpoints.github.authorizationBaseUrl,
					authorizePath: this.oauthEndpoints.github.authorizationEndpoint,
					tokenHost: this.oauthEndpoints.github.tokenBaseUrl,
					tokenPath: this.oauthEndpoints.github.tokenEndpoint
				}
			};
			this.oauthClients.githubOAuthClient = createOAuth(githubCredentials);
		}
	}

	createAuthenticationCard = (context: TurnContext): Partial<Activity> => {
		//Add buttons for each provider the user passed configuration options for
		let cardActions: CardAction[] = [];
		if (this.authenticationConfig.facebook) {
			//pass the correct provider over in query string state		
			const facebookAuthorizationUri: string = this.oauthClients.facebookOAuthClient.authorizationCode.authorizeURL({
				redirect_uri: this.callbackURL,
				scope: this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : ['public_profile'],
				state: ProviderType.Facebook
			});
			let facebookButtonTitle: string = this.authenticationConfig.facebook.buttonText ? this.authenticationConfig.facebook.buttonText : 'Log in with Facebook';
			cardActions.push({ type: "openUrl", value: facebookAuthorizationUri, title: facebookButtonTitle });
		}
		if (this.authenticationConfig.activeDirectory) {
			//pass the correct provider over in query string state		
			const activeDirectoryAuthorizationUri: string = this.oauthClients.activeDirectoryOAuthClient.authorizationCode.authorizeURL({
				redirect_uri: this.callbackURL,
				scope: this.authenticationConfig.activeDirectory.scopes ? this.authenticationConfig.activeDirectory.scopes : ['User.Read'],
				state: ProviderType.ActiveDirectory
			});
			let activeDirectoryButtonTitle: string = this.authenticationConfig.activeDirectory.buttonText ? this.authenticationConfig.activeDirectory.buttonText : 'Log in with Microsoft';
			cardActions.push({ type: "openUrl", value: activeDirectoryAuthorizationUri, title: activeDirectoryButtonTitle });
		}
		if (this.authenticationConfig.github) {
			//pass the correct provider over in query string state		
			const githubAuthorizationUri: string = this.oauthClients.githubOAuthClient.authorizationCode.authorizeURL({
				redirect_uri: this.callbackURL,
				scope: this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : ['user'],
				state: ProviderType.Github
			});
			let githubButtonTitle: string = this.authenticationConfig.github.buttonText ? this.authenticationConfig.github.buttonText : 'Log in with GitHub';
			cardActions.push({ type: "openUrl", value: githubAuthorizationUri, title: githubButtonTitle });
		}
		let card: Attachment = CardFactory.thumbnailCard("", undefined, cardActions);
		let authMessage: Partial<Activity> = MessageFactory.attachment(card);
		return authMessage;
	}
}