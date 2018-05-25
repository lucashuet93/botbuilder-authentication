
import { create as createOAuth, ModuleOptions, OAuthClient, AccessToken } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter, CardAction, ThumbnailCard, Attachment } from 'botbuilder';
import { BotAuthenticationConfiguration, ProviderConfiguration, ProviderDefaultOptions, ProviderDefaults, OAuthEndpointsConfiguration, OAuthEndpoints } from './interfaces';
import { ProviderType } from './enums';
import { providerDefaultOptions, oauthEndpoints } from './constants';

export class BotAuthenticationMiddleware {

	private server: Server;
	private adapter: BotFrameworkAdapter;
	private authenticationConfig: BotAuthenticationConfiguration;
	private callbackURL: string;
	private oauthEndpoints: OAuthEndpointsConfiguration;
	private oauthClients: {
		facebook: OAuthClient;
		activeDirectory: OAuthClient;
		github: OAuthClient;
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
		this.createOAuthClientObject();
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
			//parse the selected provider passed over in query string state (from card)
			let state: string = decodeURIComponent(req.query().split("&")[1].slice(6));
			let selectedOAuthClient: OAuthClient;
			switch (state) {
				case ProviderType.ActiveDirectory:
					selectedOAuthClient = this.oauthClients.activeDirectory;
					this.selectedProvider = ProviderType.ActiveDirectory;
					break;
				case ProviderType.Facebook:
					selectedOAuthClient = this.oauthClients.facebook;
					this.selectedProvider = ProviderType.Facebook;
					break;
				case ProviderType.Github:
					selectedOAuthClient = this.oauthClients.github;
					this.selectedProvider = ProviderType.Github;
					break;
				default:
					selectedOAuthClient = this.oauthClients.activeDirectory;
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

	createOAuthClientObject(): void {
		//Initialize OAuthClients - overcome javascript errors without adding nullability
		let initializationModule: ModuleOptions = {
			client: { id: '', secret: '', },
			auth: { tokenHost: this.oauthEndpoints.activeDirectory.tokenBaseUrl }
		};
		this.oauthClients = {
			facebook: createOAuth(initializationModule),
			activeDirectory: createOAuth(initializationModule),
			github: createOAuth(initializationModule)
		}
		//Add providers the user passed configuration options for
		if (this.authenticationConfig.facebook) this.oauthClients.facebook = this.createOAuthClient(ProviderType.Facebook);
		if (this.authenticationConfig.activeDirectory) this.oauthClients.activeDirectory = this.createOAuthClient(ProviderType.ActiveDirectory);
		if (this.authenticationConfig.github) this.oauthClients.github = this.createOAuthClient(ProviderType.Github);

	}

	createOAuthClient(provider: ProviderType): OAuthClient {
		const credentials: ModuleOptions = {
			client: {
				id: (this.authenticationConfig[provider] as ProviderConfiguration).clientId,
				secret: (this.authenticationConfig[provider] as ProviderConfiguration).clientSecret
			},
			auth: {
				authorizeHost: (this.oauthEndpoints[provider] as OAuthEndpoints).authorizationBaseUrl,
				authorizePath: (this.oauthEndpoints[provider] as OAuthEndpoints).authorizationEndpoint,
				tokenHost: (this.oauthEndpoints[provider] as OAuthEndpoints).tokenBaseUrl,
				tokenPath: (this.oauthEndpoints[provider] as OAuthEndpoints).tokenEndpoint
			}
		};
		return createOAuth(credentials);
	}

	createAuthenticationCard = (context: TurnContext): Partial<Activity> => {
		//Add buttons for each provider the user passed configuration options for
		let cardActions: CardAction[] = [];
		if (this.authenticationConfig.facebook) {
			cardActions.push(this.createAuthenticationButton(ProviderType.Facebook));
		}
		if (this.authenticationConfig.activeDirectory) {
			cardActions.push(this.createAuthenticationButton(ProviderType.ActiveDirectory));
		}
		if (this.authenticationConfig.github) {
			cardActions.push(this.createAuthenticationButton(ProviderType.Github));
		}
		let card: Attachment = CardFactory.thumbnailCard("", undefined, cardActions);
		let authMessage: Partial<Activity> = MessageFactory.attachment(card);
		return authMessage;
	}

	createAuthenticationButton(provider: ProviderType): CardAction {
		//pass the correct provider over in query string state, attach scopes and button text if provided		
		const authorizationUri: string = this.oauthClients[provider].authorizationCode.authorizeURL({
			redirect_uri: this.callbackURL,
			scope: (this.authenticationConfig[provider] as ProviderConfiguration).scopes ? (this.authenticationConfig[provider] as ProviderConfiguration).scopes : (providerDefaultOptions[provider] as ProviderDefaults).scopes,
			state: provider
		});
		let buttonTitle: string = (this.authenticationConfig[provider] as ProviderConfiguration).buttonText ? (this.authenticationConfig[provider] as ProviderConfiguration).buttonText! : (providerDefaultOptions[provider] as ProviderDefaults).buttonText;
		let button: CardAction = { type: "openUrl", value: authorizationUri, title: buttonTitle };
		return button;
	}
}