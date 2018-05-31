import * as restify from 'restify';
import * as passport from 'passport-restify';
import * as dotenv from 'dotenv';
import { create as createOAuth, ModuleOptions, OAuthClient, AccessToken, Token, AuthorizationTokenConfig } from 'simple-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response, Next } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter, CardAction, ThumbnailCard, Attachment } from 'botbuilder';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { OAuth2Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth';
import { BotAuthenticationConfiguration, ProviderConfiguration, DefaultProviderOptions, ProviderDefaults, OAuthEndpointsConfiguration, OAuthEndpoints, ProviderAuthorizationUri } from './interfaces';
import { ProviderType } from './enums';
import { defaultProviderOptions, defaultOAuthEndpoints } from './constants';

export class BotAuthenticationMiddleware {

	private server: Server;
	private adapter: BotFrameworkAdapter;
	private authenticationConfig: BotAuthenticationConfiguration;
	private baseUrl: string;
	private callbackURL: string;
	private oauthEndpoints: OAuthEndpointsConfiguration;
	private oauthClients: {
		activeDirectory: OAuthClient;
		github: OAuthClient;
	}
	private magicCode: string;
	private currentAccessToken: string;
	private sentCode: boolean;
	private selectedProvider: ProviderType;

	constructor(server: Server, adapter: BotFrameworkAdapter, authenticationConfig: BotAuthenticationConfiguration) {
		this.server = server;
		this.adapter = adapter;
		this.authenticationConfig = authenticationConfig;
		this.oauthEndpoints = defaultOAuthEndpoints;
		this.baseUrl = this.server.address().address === '::' ? `http://localhost:${this.server.address().port}`: this.server.address().address;
		this.callbackURL = `${this.baseUrl}/auth/callback`;
		this.initializeEnvironmentVariables();
		this.initializeOAuth();
		this.initializePassport();
		this.createRedirectEndpoints();
	}

	async onTurn(context: TurnContext, next: Function) {
		if (context.activity.type === 'message') {
			if (!this.authenticationConfig.isUserAuthenticated(context)) {
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
			if (this.authenticationConfig.onLoginFailure) {
				await this.authenticationConfig.onLoginFailure(context, this.selectedProvider);
			} else {
				let loginFailedMessage: Partial<Activity> = MessageFactory.text('Invalid code. Please try again');
				await context.sendActivities([loginFailedMessage, await this.createAuthenticationCard(context)]);
			}
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = '';
		}
	}

	//------------------------------------------ SERVER REDIRECTS --------------------------------------------//

	createRedirectEndpoints(): void {
		//add plugins necessary for Passport
		this.server.use(restify.plugins.queryParser());
		this.server.use(restify.plugins.bodyParser());
		//create redirect endpoint for login failure 
		this.server.get('/auth/failure', (req: Request, res: Response, next: Next) => {
			res.send(`Authentication Failed`);
		});
		this.server.get('/auth/activeDirectory/callback', (req: Request, res: Response, next: Next) => {
			console.log('here')
			res.redirect(302, this.callbackURL, next);
		});
		this.server.get('/auth/github/callback', (req: Request, res: Response, next: Next) => {
			console.log('here2')
			res.redirect(302, this.callbackURL, next);
		});
		//create redirect endpoint for login success 
		this.server.get('/auth/callback', (req: Request, res: Response, next: Next) => {
			let code: string | undefined = req.query.code;
			let magicCode: string = this.generateMagicCode();
			//providers using Passport do not have a code in the query string, those using OAuth do.
			if (!code) {
				//providers using Passport have already exchanged the authorization code for an access token
				this.renderMagicCode(req, res, next, magicCode);
			} else {
				//providers using OAuth must exchange the authorization code for access token
				const tokenConfig: AuthorizationTokenConfig = {
					code: code,
					redirect_uri: this.callbackURL
				};
				//parse the selected provider passed over in query string state (from card)
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
				//exchange the authorization code for the access token
				selectedOAuthClient.authorizationCode.getToken(tokenConfig)
					.then((result: any) => {
						const accessToken: AccessToken = selectedOAuthClient.accessToken.create(result);
						this.currentAccessToken = accessToken.token['access_token'] as string;
						this.renderMagicCode(req, res, next, magicCode);
					})
					.catch((error: any) => {
						console.log('Access Token Error', error);
					});
			}
		});
	}

	generateMagicCode(): string {
		//generate a magic code, store it for the next turn and set sentCode to true to prepare for the following turn
		let magicCode: string = randomBytes(4).toString('hex');
		this.magicCode = magicCode;
		this.sentCode = true;
		return magicCode;
	}

	renderMagicCode(req: Request, res: Response, next: Next, magicCode: string): void {
		if (this.authenticationConfig.customMagicCodeRedirectEndpoint) {
			//redirect to provided endpoint with the magic code in the body
			let url: string = this.authenticationConfig.customMagicCodeRedirectEndpoint + `?magicCode=${magicCode}`;
			res.redirect(302, url, next);
		} else {
			//send vanilla text to the user
			res.send(`Please enter the code into the bot: ${magicCode}`);
		}
	}

	//---------------------------- PASSPORT INIT (Facebook, Google, and Twitter) -----------------------------//

	initializePassport() {
		//initialize Passport
		this.server.use(passport.initialize());
		this.server.use(passport.session());
		// used to serialize the user for the session
		passport.serializeUser((user: any, done: Function) => {
			done(null, user);
		});
		// used to deserialize the user
		passport.deserializeUser((id: any, done: Function) => {
			done(null, id);
		});

		//Facebook
		if (this.authenticationConfig.facebook) {
			passport.use(new FacebookStrategy({
				clientID: this.authenticationConfig.facebook.clientId,
				clientSecret: this.authenticationConfig.facebook.clientSecret,
				callbackURL: `${this.baseUrl}/auth/facebook/callback`
			}, (accessToken: string, refreshToken: string, profile: FacebookProfile, done: Function) => {
				//store the access token on successful login (callback runs before successRedirect)
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Facebook;
				done(null, profile);
			}));
			let facebookScope: string[] = this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : defaultProviderOptions.facebook.scopes;
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
				clientID: this.authenticationConfig.google.clientId,
				clientSecret: this.authenticationConfig.google.clientSecret,
				callbackURL: `${this.baseUrl}/auth/google/callback`
			}, (accessToken: string, refreshToken: string, profile: GoogleProfile, done: Function) => {
				//store the access token on successful login (callback runs before successRedirect)
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Google;
				done(null, profile);
			}));
			let googleScope: string[] = this.authenticationConfig.google.scopes ? this.authenticationConfig.google.scopes : defaultProviderOptions.google.scopes;
			this.server.get('/auth/google', passport.authenticate('google', { scope: googleScope }));
			this.server.get('/auth/google/callback',
				passport.authenticate('google', {
					successRedirect: '/auth/callback',
					failureRedirect: '/auth/failure'
				}));
		}
	}

	//------------------------------ OAUTH INIT (Active Directory and Github) --------------------------------//

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
		//add providers the user passed configuration options for
		if (this.authenticationConfig.activeDirectory) this.oauthClients.activeDirectory = this.createOAuthClient(ProviderType.ActiveDirectory);
		if (this.authenticationConfig.github) this.oauthClients.github = this.createOAuthClient(ProviderType.Github);
	}

	createOAuthClient(provider: ProviderType): OAuthClient {
		//take the provided client id and secret with the provider's default oauth endpoints to create an OAuth client
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

	//--------------------------------------- ENVIRONMENT VARIABLES ------------------------------------------//

	initializeEnvironmentVariables() {
		//pull the environment variables declared by the user for the supported providers
		let environment: string = process.env.NODE_ENV || 'development';
		if (environment === 'development') {
			dotenv.load();
		}
		//update the authentication configuration accordingly
		if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, facebook: {
					... this.authenticationConfig.facebook,
					clientId: process.env.FACEBOOK_CLIENT_ID as string,
					clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
				}
			}
		}
		if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, google: {
					... this.authenticationConfig.google,
					clientId: process.env.GOOGLE_CLIENT_ID as string,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
				}
			}
		}
		if (process.env.ACTIVE_DIRECTORY_CLIENT_ID && process.env.ACTIVE_DIRECTORY_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, activeDirectory: {
					... this.authenticationConfig.activeDirectory,
					clientId: process.env.ACTIVE_DIRECTORY_CLIENT_ID as string,
					clientSecret: process.env.ACTIVE_DIRECTORY_CLIENT_SECRET as string
				}
			}
		}
		if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, github: {
					... this.authenticationConfig.github,
					clientId: process.env.GITHUB_CLIENT_ID as string,
					clientSecret: process.env.GITHUB_CLIENT_SECRET as string
				}
			}
		}
	}

	//------------------------------------------ CARD --------------------------------------------------------//

	createAuthorizationUris(): ProviderAuthorizationUri[] {
		//Pass the proper authorization uris back to the user
		let authorizationUris: ProviderAuthorizationUri[] = [];
		if (this.authenticationConfig.facebook) {
			//facebook authorization uri is the endpoint we set up in the Passport initialization
			let facebookAuthorizationUri: ProviderAuthorizationUri = {
				provider: ProviderType.Facebook,
				authorizationUri: `${this.baseUrl}/auth/facebook`
			};
			authorizationUris.push(facebookAuthorizationUri);
		}
		if (this.authenticationConfig.google) {
			//google authorization uri is the endpoint we set up in the Passport initialization
			let googleAuthorizationUri: ProviderAuthorizationUri = {
				provider: ProviderType.Google,
				authorizationUri: `${this.baseUrl}/auth/google`
			};
			authorizationUris.push(googleAuthorizationUri);
		}
		if (this.authenticationConfig.activeDirectory) {
			//active directory authorization uri is created via its oauth client 
			let activeDirectoryScope = this.authenticationConfig.activeDirectory.scopes ? this.flatMapActiveDirectoryScopes(this.authenticationConfig.activeDirectory.scopes) : defaultProviderOptions.activeDirectory.scopes
			let adAuthorizationUri: ProviderAuthorizationUri = {
				provider: ProviderType.ActiveDirectory,
				authorizationUri: this.oauthClients.activeDirectory.authorizationCode.authorizeURL({
					redirect_uri: `${this.baseUrl}/auth/activeDirectory/callback`,
					scope: activeDirectoryScope,
					state: ProviderType.ActiveDirectory
				})
			};
			authorizationUris.push(adAuthorizationUri);
		}
		if (this.authenticationConfig.github) {
			//github authorization uri is created via its oauth client 
			let githubAuthorizationUri: ProviderAuthorizationUri = {
				provider: ProviderType.Github,
				authorizationUri: this.oauthClients.github.authorizationCode.authorizeURL({
					redirect_uri: `${this.baseUrl}/auth/github/callback`,
					scope: this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : defaultProviderOptions.github.scopes,
					state: ProviderType.Github
				})
			};
			authorizationUris.push(githubAuthorizationUri);
		}
		return authorizationUris;
	}

	async createAuthenticationCard(context: TurnContext): Promise<Partial<Activity>> {
		let authorizationUris: ProviderAuthorizationUri[] = this.createAuthorizationUris();
		if (this.authenticationConfig.customAuthenticationCardGenerator) {
			//immediately pass the authorization uris to the user for custom cards
			return await this.authenticationConfig.customAuthenticationCardGenerator(context, authorizationUris);
		} else {
			//add buttons for each provider the user passed configuration options for, or use the default options			
			let cardActions: CardAction[] = [];
			let buttonTitle: string;
			authorizationUris.map((providerAuthUri: ProviderAuthorizationUri) => {
				if (providerAuthUri.provider === ProviderType.ActiveDirectory) {
					//we can be sure activeDirectory is not undefined given the Provider Type
					buttonTitle = (this.authenticationConfig.activeDirectory!.buttonText ? this.authenticationConfig.activeDirectory!.buttonText : defaultProviderOptions.activeDirectory.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Facebook) {
					buttonTitle = (this.authenticationConfig.facebook!.buttonText ? this.authenticationConfig.facebook!.buttonText : defaultProviderOptions.facebook.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Google) {
					buttonTitle = (this.authenticationConfig.google!.buttonText ? this.authenticationConfig.google!.buttonText : defaultProviderOptions.google.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Github) {
					buttonTitle = (this.authenticationConfig.github!.buttonText ? this.authenticationConfig.github!.buttonText : defaultProviderOptions.github.buttonText) as string;
				}
				cardActions.push({ type: 'openUrl', value: providerAuthUri.authorizationUri, title: buttonTitle });
			});
			let card: Attachment = CardFactory.thumbnailCard('', undefined, cardActions);
			let authMessage: Partial<Activity> = MessageFactory.attachment(card);
			return authMessage;
		}
	}

	flatMapActiveDirectoryScopes(scopes: string[]): string[] {
		//Active Directory expects a space delimited list of scopes, not commas. Flat map all the scopes into a single string
		let flatMappedScope = scopes.join(' ');
		return [flatMappedScope];
	}
}