
import { create as createOAuth, ModuleOptions, OAuthClient, AccessToken, Token } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import * as restify from 'restify';
import { Server, Request, Response, RequestHandler, RequestHandlerType } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter, CardAction, ThumbnailCard, Attachment } from 'botbuilder';
import { BotAuthenticationConfiguration, ProviderConfiguration, ProviderDefaultOptions, ProviderDefaults, OAuthEndpointsConfiguration, OAuthEndpoints, ProviderAuthorizationUri } from './interfaces';
import { ProviderType } from './enums';
import { providerDefaultOptions, oauthEndpoints } from './constants';
import * as passport from 'passport-restify';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { OAuth2Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth';

export class BotAuthenticationMiddleware {

	private server: Server;
	private adapter: BotFrameworkAdapter;
	private authenticationConfig: BotAuthenticationConfiguration;
	private callbackURL: string;
	private oauthEndpoints: OAuthEndpointsConfiguration;
	private oauthClients: {
		activeDirectory: OAuthClient;
		github: OAuthClient;
	}
	private authenticated: boolean;
	private magicCode: string;
	private currentAccessToken: string;
	private sentCode: boolean;
	private selectedProvider: ProviderType;

	constructor(server: Server, adapter: BotFrameworkAdapter, authenticationConfig: BotAuthenticationConfiguration) {
		this.authenticated = false;
		this.server = server;
		this.adapter = adapter;
		this.authenticationConfig = authenticationConfig;
		this.oauthEndpoints = oauthEndpoints;
		this.callbackURL = 'http://localhost:3978/auth/callback';
		this.createRedirectEndpoints();
		this.initializeOAuth();
		this.initializePassport();
	}

	async onTurn(context: TurnContext, next: Function) {
		if (context.activity.type === 'message') {
			if (!this.authenticationConfig.userIsAuthenticated(context)) {
				//run auth
				if (!this.sentCode) {
					if (this.authenticationConfig.noUserFoundMessage) {
						await context.sendActivity(this.authenticationConfig.noUserFoundMessage);
					}
					await context.sendActivity(await this.createAuthenticationCard(context))
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
			//reset necessary properties
			await this.authenticationConfig.onLoginSuccess(context, this.currentAccessToken, this.selectedProvider);
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = '';
		} else {
			//reset necessary properties
			await this.authenticationConfig.onLoginFailure(context, this.selectedProvider);
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = '';
		}
	}

	//------------------------------------------Helpers------------------------------------------

	generateMagicCode(): string {
		let magicCode: string = randomBytes(4).toString('hex');
		this.magicCode = magicCode;
		this.sentCode = true;
		return magicCode;
	}

	async createAuthenticationCard(context: TurnContext): Promise<Partial<Activity>> {
		if (this.authenticationConfig.createCustomAuthenticationCard) {
			//Pass the proper authorization uris back to the user
			let authorizationUris: ProviderAuthorizationUri[] = [];
			if (this.authenticationConfig.facebook) {
				let facebookAuthorizationUri: ProviderAuthorizationUri = {
					provider: ProviderType.Facebook,
					authorizationUri: 'http://localhost:3978/auth/facebook'
				};
				authorizationUris.push(facebookAuthorizationUri);
			}
			if (this.authenticationConfig.google) {
				let googleAuthorizationUri: ProviderAuthorizationUri = {
					provider: ProviderType.Google,
					authorizationUri: 'http://localhost:3978/auth/google'
				};
				authorizationUris.push(googleAuthorizationUri);
			}
			if (this.authenticationConfig.activeDirectory) {
				let adAuthorizationUri: ProviderAuthorizationUri = {
					provider: ProviderType.ActiveDirectory,
					authorizationUri: this.oauthClients.activeDirectory.authorizationCode.authorizeURL({
						redirect_uri: this.callbackURL,
						scope: this.authenticationConfig.activeDirectory.scopes ? this.authenticationConfig.activeDirectory.scopes : providerDefaultOptions.activeDirectory.scopes,
						state: ProviderType.ActiveDirectory
					})
				};
				authorizationUris.push(adAuthorizationUri);
			}
			if (this.authenticationConfig.github) {
				let githubAuthorizationUri: ProviderAuthorizationUri = {
					provider: ProviderType.Github,
					authorizationUri: this.oauthClients.github.authorizationCode.authorizeURL({
						redirect_uri: this.callbackURL,
						scope: this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : providerDefaultOptions.github.scopes,
						state: ProviderType.Github
					})
				};
				authorizationUris.push(githubAuthorizationUri);
			}
			return await this.authenticationConfig.createCustomAuthenticationCard(context, authorizationUris);
		} else {
			//Add buttons for each provider the user passed configuration options for			
			let cardActions: CardAction[] = [];
			if (this.authenticationConfig.facebook) {
				let facebookAuthorizationUrl: string = 'http://localhost:3978/auth/facebook';
				let facebookButtonTitle: string = this.authenticationConfig.facebook.buttonText ? this.authenticationConfig.facebook.buttonText : providerDefaultOptions.facebook.buttonText;
				let facebookButton: CardAction = { type: "openUrl", value: facebookAuthorizationUrl, title: facebookButtonTitle };
				cardActions.push(facebookButton);
			}
			if (this.authenticationConfig.google) {
				let googleAuthorizationUrl: string = 'http://localhost:3978/auth/google';
				let googleButtonTitle: string = this.authenticationConfig.google.buttonText ? this.authenticationConfig.google.buttonText : providerDefaultOptions.google.buttonText;
				let googleButton: CardAction = { type: "openUrl", value: googleAuthorizationUrl, title: googleButtonTitle };
				cardActions.push(googleButton);
			}
			if (this.authenticationConfig.activeDirectory) {
				let adAuthorizationUri: string = this.oauthClients.activeDirectory.authorizationCode.authorizeURL({
					redirect_uri: this.callbackURL,
					scope: this.authenticationConfig.activeDirectory.scopes ? this.authenticationConfig.activeDirectory.scopes : providerDefaultOptions.activeDirectory.scopes,
					state: ProviderType.ActiveDirectory
				});
				let adButtonTitle: string = this.authenticationConfig.activeDirectory.buttonText ? this.authenticationConfig.activeDirectory.buttonText : providerDefaultOptions.activeDirectory.buttonText;
				let adButton: CardAction = { type: "openUrl", value: adAuthorizationUri, title: adButtonTitle };
				cardActions.push(adButton);
			}
			if (this.authenticationConfig.github) {
				let githubAuthorizationUri: string = this.oauthClients.github.authorizationCode.authorizeURL({
					redirect_uri: this.callbackURL,
					scope: this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : providerDefaultOptions.github.scopes,
					state: ProviderType.Github
				});
				let githubButtonTitle: string = this.authenticationConfig.github.buttonText ? this.authenticationConfig.github.buttonText : providerDefaultOptions.github.buttonText;
				let githubButton: CardAction = { type: "openUrl", value: githubAuthorizationUri, title: githubButtonTitle };
				cardActions.push(githubButton);
			}
			let card: Attachment = CardFactory.thumbnailCard("", undefined, cardActions);
			let authMessage: Partial<Activity> = MessageFactory.attachment(card);
			return authMessage;
		}
	}

	//------------------------------------------Passport------------------------------------------

	//Used for Facebook, Google, and Twitter

	initializePassport() {
		//Initialize Passport
		this.server.use(passport.initialize());
		this.server.use(passport.session());
		passport.serializeUser((user: any, done: Function) => {
			done(null, user);
		});
		passport.serializeUser((user: any, done: Function) => {
			done(null, user);
		});

		//Facebook
		if (this.authenticationConfig.facebook) {
			passport.use(new FacebookStrategy({
				clientID: this.authenticationConfig.facebook!.clientId,
				clientSecret: this.authenticationConfig.facebook!.clientSecret,
				callbackURL: 'http://localhost:3978/auth/facebook/callback'
			}, (accessToken: string, refreshToken: string, profile: FacebookProfile, done: Function) => {
				//store the access token on successful login (runs before successRedirect)
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Facebook;
				done(null, profile);
			}));
			let facebookScope: string[] = this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : providerDefaultOptions.facebook.scopes;
			this.server.get('/auth/facebook', passport.authenticate('facebook', { scope: facebookScope }));
			this.server.get('/auth/facebook/callback',
				passport.authenticate('facebook', {
					successRedirect: '/auth/callback',
					failureRedirect: '/auth/failure'
				}));
		}

		//Google
		if (this.authenticationConfig.google) {
			passport.use(new GoogleStrategy({
				clientID: this.authenticationConfig.google!.clientId,
				clientSecret: this.authenticationConfig.google!.clientSecret,
				callbackURL: 'http://localhost:3978/auth/google/callback'
			}, (accessToken: string, refreshToken: string, profile: GoogleProfile, done: Function) => {
				//store the access token on successful login (runs before successRedirect)
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Google;
				done(null, profile);
			}));
			let googleScope: string[] = this.authenticationConfig.google.scopes ? this.authenticationConfig.google.scopes : providerDefaultOptions.google.scopes;
			this.server.get('/auth/google', passport.authenticate('google', { scope: googleScope }));
			this.server.get('/auth/google/callback',
				passport.authenticate('google', {
					successRedirect: '/auth/callback',
					failureRedirect: '/auth/failure'
				}));
		}
	}

	//------------------------------------------OAuth------------------------------------------

	//Used for Active Directory and Github

	initializeOAuth(): void {
		//Initialize OAuthClients - overcome javascript errors without adding nullability
		let initializationModule: ModuleOptions = {
			client: { id: '', secret: '', },
			auth: { tokenHost: this.oauthEndpoints.activeDirectory.tokenBaseUrl }
		};
		this.oauthClients = {
			activeDirectory: createOAuth(initializationModule),
			github: createOAuth(initializationModule)
		}
		//Add providers the user passed configuration options for
		if (this.authenticationConfig.activeDirectory) this.oauthClients.activeDirectory = this.createOAuthClient(ProviderType.ActiveDirectory);
		if (this.authenticationConfig.github) this.oauthClients.github = this.createOAuthClient(ProviderType.Github);
	}

	createOAuthClient(provider: ProviderType): OAuthClient {
		//Take the provided client id and secret with the provider's default oauth endpoints to create an OAuth client
		let providerConfig: ProviderConfiguration = provider === ProviderType.ActiveDirectory ? this.authenticationConfig.activeDirectory! : this.authenticationConfig.github!;
		let oauthEndpoints: OAuthEndpoints = provider === ProviderType.ActiveDirectory ? this.oauthEndpoints.activeDirectory : this.oauthEndpoints.github;
		const credentials: ModuleOptions = {
			client: {
				id: providerConfig.clientId,
				secret: providerConfig.clientSecret
			},
			auth: {
				authorizeHost: oauthEndpoints.authorizationBaseUrl,
				authorizePath: oauthEndpoints.authorizationEndpoint,
				tokenHost: oauthEndpoints.tokenBaseUrl,
				tokenPath: oauthEndpoints.tokenEndpoint
			}
		};
		return createOAuth(credentials);
	}

	//------------------------------------------Redirects------------------------------------------

	createRedirectEndpoints(): void {
		//Add plugins necessary for Passport
		this.server.use(restify.plugins.queryParser());
		this.server.use(restify.plugins.bodyParser());
		//Create redirect endpoint for login failure 
		this.server.get('/auth/failure', (req: Request, res: Response) => {
			res.send(`Authentication Failed`);
		});
		//Create redirect endpoint for login success 
		this.server.get('/auth/callback', (req: Request, res: Response) => {
			let code: string | undefined = req.query.code;
			let magicCode: string = this.generateMagicCode();
			//Providers using Passport do not have a code in the query string, those using OAuth do.
			if (!code) {
				//Providers using Passport have already exchanged the authorization code for an access token
				res.send(`Please enter the code into the bot: ${magicCode}`);
			} else {
				//Providers using OAuth must exchange the authorization code for access token
				const tokenConfig = {
					code: code,
					redirect_uri: this.callbackURL
				};
				//Parse the selected provider passed over in query string state (from card)
				let selectedOAuthClient: OAuthClient;
				switch (req.query.state) {
					case ProviderType.ActiveDirectory:
						selectedOAuthClient = this.oauthClients.activeDirectory;
						this.selectedProvider = ProviderType.ActiveDirectory;
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
				//Exchange the authorization code for the access token
				selectedOAuthClient.authorizationCode.getToken(tokenConfig)
					.then((result: any) => {
						const accessToken: AccessToken = selectedOAuthClient.accessToken.create(result);
						this.currentAccessToken = accessToken.token['access_token'] as string;
						res.send(`Please enter the code into the bot: ${magicCode}`);
					})
					.catch((error: any) => {
						console.log('Access Token Error', error);
					});
			}
		});
	}
}