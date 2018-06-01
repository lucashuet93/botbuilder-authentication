import * as restify from 'restify';
import * as passport from 'passport-restify';
import * as dotenv from 'dotenv';
import * as AzureAdOAuth2Strategy from 'passport-azure-ad-oauth2';
import { randomBytes } from 'crypto';
import { Server, Request, Response, Next } from 'restify';
import { TurnContext, Activity, MessageFactory, CardFactory, BotFrameworkAdapter, CardAction, ThumbnailCard, Attachment, Middleware, Promiseable } from 'botbuilder';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from 'passport-github';
import { OAuth2Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth';
import { BotAuthenticationConfiguration, ProviderConfiguration, DefaultProviderOptions, ProviderDefaults, ProviderAuthorizationUri } from './interfaces';
import { ProviderType } from './enums';
import { defaultProviderOptions } from './constants';

export class BotAuthenticationMiddleware implements Middleware {

	private server: Server;
	private adapter: BotFrameworkAdapter;
	private authenticationConfig: BotAuthenticationConfiguration;
	private baseUrl: string;
	private magicCode: string;
	private currentAccessToken: string;
	private sentCode: boolean;
	private selectedProvider: ProviderType;

	constructor(server: Server, adapter: BotFrameworkAdapter, authenticationConfig: BotAuthenticationConfiguration) {
		this.server = server;
		this.adapter = adapter;
		this.authenticationConfig = authenticationConfig;
		this.baseUrl = this.server.address().address === '::' ? `http://localhost:${this.server.address().port}` : this.server.address().address;
		this.initializeEnvironmentVariables();
		this.initializePassport();
		this.initializeRedirectEndpoints();
	};

	async onTurn(context: TurnContext, next: Function): Promise<void> {
		if (context.activity.type === 'message') {
			if (!this.authenticationConfig.isUserAuthenticated(context)) {
				//run auth
				if (!this.sentCode) {
					if (this.authenticationConfig.noUserFoundMessage) {
						await context.sendActivity(this.authenticationConfig.noUserFoundMessage);
					};
					await context.sendActivity(await this.createAuthenticationCard(context))
				} else {
					await this.handleMagicCode(context);
				};
				return;
			} else {
				//immediately pass on authenticated messages
				await next();
			};
		} else {
			//immediately pass on non-messages
			await next();
		};
	};

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
			};
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = '';
		};
	};

	//------------------------------------------ SERVER REDIRECTS --------------------------------------------//

	initializeRedirectEndpoints(): void {
		//add plugins necessary for Passport
		this.server.use(restify.plugins.queryParser());
		this.server.use(restify.plugins.bodyParser());
		//create redirect endpoint for login failure 
		this.server.get('/auth/failure', (req: Request, res: Response, next: Next) => {
			res.send(`Authentication Failed`);
		});
		//passport providers ultimately redirect here
		this.server.get('/auth/callback', (req: Request, res: Response, next: Next) => {
			//providers using Passport have already exchanged the authorization code for an access token
			let magicCode: string = this.generateMagicCode();
			this.renderMagicCode(req, res, next, magicCode);
		});
	};

	generateMagicCode(): string {
		//generate a magic code, store it for the next turn and set sentCode to true to prepare for the following turn
		let magicCode: string = randomBytes(4).toString('hex');
		this.magicCode = magicCode;
		this.sentCode = true;
		return magicCode;
	};

	renderMagicCode(req: Request, res: Response, next: Next, magicCode: string): void {
		if (this.authenticationConfig.customMagicCodeRedirectEndpoint) {
			//redirect to provided endpoint with the magic code in the body
			let url: string = this.authenticationConfig.customMagicCodeRedirectEndpoint + `?magicCode=${magicCode}`;
			res.redirect(302, url, next);
		} else {
			//send vanilla text to the user
			res.send(`Please enter the code into the bot: ${magicCode}`);
		};
	};

	//------------------------------------------ PASSPORT INIT ---------------------------------------------//

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
			this.server.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//GitHub
		if (this.authenticationConfig.github) {
			passport.use(new GitHubStrategy({
				clientID: this.authenticationConfig.github.clientId,
				clientSecret: this.authenticationConfig.github.clientSecret,
				callbackURL: `${this.baseUrl}/auth/github/callback`
			}, (accessToken: string, refreshToken: string, profile: GitHubProfile, done: Function) => {
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Github;
				done(null, profile);
			}));
			let githubScope: string[] = this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : defaultProviderOptions.github.scopes;
			this.server.get('/auth/github', passport.authenticate('github', { scope: githubScope }));
			this.server.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//Google
		if (this.authenticationConfig.google) {
			passport.use(new GoogleStrategy({
				clientID: this.authenticationConfig.google.clientId,
				clientSecret: this.authenticationConfig.google.clientSecret,
				callbackURL: `${this.baseUrl}/auth/google/callback`
			}, (accessToken: string, refreshToken: string, profile: GoogleProfile, done: Function) => {
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.Google;
				done(null, profile);
			}));
			let googleScope: string[] = this.authenticationConfig.google.scopes ? this.authenticationConfig.google.scopes : defaultProviderOptions.google.scopes;
			this.server.get('/auth/google', passport.authenticate('google', { scope: googleScope }));
			this.server.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//Active Directory
		if (this.authenticationConfig.activeDirectory) {
			let activeDirectoryScope: string[] = this.authenticationConfig.activeDirectory.scopes ? this.authenticationConfig.activeDirectory.scopes : defaultProviderOptions.activeDirectory.scopes;
			passport.use(new AzureAdOAuth2Strategy({
				clientID: this.authenticationConfig.activeDirectory.clientId,
				clientSecret: this.authenticationConfig.activeDirectory.clientSecret,
				callbackURL: `${this.baseUrl}/auth/activeDirectory/callback`,
				scope: activeDirectoryScope,
				resource: 'https://graph.windows.net',
				tenant: 'microsoft.onmicrosoft.com'
			}, (accessToken: string, refresh_token: string, params: any, profile: any, done: Function) => {
				this.currentAccessToken = accessToken;
				this.selectedProvider = ProviderType.ActiveDirectory;
				done(null, profile);
			}));
			this.server.get('/auth/activeDirectory', passport.authenticate('azure_ad_oauth2'));
			this.server.get('/auth/activeDirectory/callback', passport.authenticate('azure_ad_oauth2', { session: false, successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};
	};

	//--------------------------------------- ENVIRONMENT VARIABLES ------------------------------------------//

	initializeEnvironmentVariables() {
		//pull the environment variables declared by the user for the supported providers
		let environment: string = process.env.NODE_ENV || 'development';
		if (environment === 'development') {
			dotenv.load();
		};
		//update the authentication configuration accordingly
		if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, facebook: {
					... this.authenticationConfig.facebook,
					clientId: process.env.FACEBOOK_CLIENT_ID as string,
					clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
				}
			};
		};
		if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, google: {
					... this.authenticationConfig.google,
					clientId: process.env.GOOGLE_CLIENT_ID as string,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
				}
			};
		};
		if (process.env.ACTIVE_DIRECTORY_CLIENT_ID && process.env.ACTIVE_DIRECTORY_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, activeDirectory: {
					... this.authenticationConfig.activeDirectory,
					clientId: process.env.ACTIVE_DIRECTORY_CLIENT_ID as string,
					clientSecret: process.env.ACTIVE_DIRECTORY_CLIENT_SECRET as string
				}
			};
		};
		if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, github: {
					... this.authenticationConfig.github,
					clientId: process.env.GITHUB_CLIENT_ID as string,
					clientSecret: process.env.GITHUB_CLIENT_SECRET as string
				}
			};
		};
	};

	//------------------------------------------ CARD --------------------------------------------------------//

	createAuthorizationUris(): ProviderAuthorizationUri[] {
		//Pass the authorization uris set up in the Passport initialization back to the user
		let authorizationUris: ProviderAuthorizationUri[] = [];
		if (this.authenticationConfig.facebook) authorizationUris.push({ provider: ProviderType.Facebook, authorizationUri: `${this.baseUrl}/auth/facebook` });
		if (this.authenticationConfig.google) authorizationUris.push({ provider: ProviderType.Google, authorizationUri: `${this.baseUrl}/auth/google` });
		if (this.authenticationConfig.activeDirectory) authorizationUris.push({ provider: ProviderType.ActiveDirectory, authorizationUri: `${this.baseUrl}/auth/activeDirectory` });
		if (this.authenticationConfig.github) authorizationUris.push({ provider: ProviderType.Github, authorizationUri: `${this.baseUrl}/auth/github` });
		return authorizationUris;
	};

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
		};
	};

	flatMapActiveDirectoryScopes(scopes: string[]): string[] {
		//Active Directory expects a space delimited list of scopes, not commas. Flat map all the scopes into a single string
		let flatMappedScope = scopes.join(' ');
		return [flatMappedScope];
	};
};