import * as dotenv from 'dotenv';
import * as restify from 'restify';
import * as express from 'express';
import * as passportRestify from 'passport-restify';
import * as passportExpress from 'passport';
import * as AzureAdOAuth2Strategy from 'passport-azure-ad-oauth2';
import * as queryString from 'querystring';
import { randomBytes } from 'crypto';
import { Server } from 'restify';
import { Application, Router } from 'express';
import { TurnContext, Activity, MessageFactory, CardFactory, CardAction, ThumbnailCard, Attachment, Middleware } from 'botbuilder';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from 'passport-github';
import { OAuth2Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth';
import { BotAuthenticationConfiguration, ProviderConfiguration, ProviderAuthorizationUri, ProviderType } from './BotAuthenticationConfiguration';
import { defaultProviderOptions } from './DefaultProviderOptions';
import { ServerType } from './ServerType';

export class BotAuthenticationMiddleware implements Middleware {

	private server: any;
	private authenticationConfig: BotAuthenticationConfiguration;
	private baseUrl: string;
	private magicCode: string;
	private currentAccessToken: string;
	private sentCode: boolean;
	private selectedProvider: ProviderType;
	private serverType: ServerType;

    /**
     * Creates a new BotAuthenticationMiddleware instance.
     * @param server Restify server, Express application, or Express router that routes requests to the adapter.
     * @param authenticationConfig Configuration settings for the authentication middleware.
    */
	constructor(server: Server | Application | Router, authenticationConfig: BotAuthenticationConfiguration) {
		this.server = server;
		this.authenticationConfig = authenticationConfig;
		this.serverType = this.determineServerType(server);
		this.captureBaseUrl();
		this.initializeEnvironmentVariables();
		this.initializeRedirectEndpoints();
	};

	//---------------------------------------- CONVERSATIONAL LOGIC -------------------------------------------//

	async onTurn(context: TurnContext, next: Function): Promise<void> {
		if (context.activity.type === 'message') {
			if (!this.authenticationConfig.isUserAuthenticated(context)) {
				//run auth
				if (!this.sentCode) {
					//send the authentication card, triggering the auth flow
					if (this.authenticationConfig.noUserFoundMessage) {
						await context.sendActivity(this.authenticationConfig.noUserFoundMessage);
					};
					await context.sendActivity(await this.createAuthenticationCard(context))
				} else {
					//auth flow is underway, validate that the user has input the correct code
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

	private async handleMagicCode(context: TurnContext): Promise<void> {
		let submittedCode: string = context.activity.text;
		if (submittedCode.toLowerCase() === this.magicCode.toLowerCase()) {
			//correct code, reset necessary properties and run provided onLoginSuccess
			await this.authenticationConfig.onLoginSuccess(context, this.currentAccessToken, this.selectedProvider);
			this.magicCode = '';
			this.sentCode = false;
			this.currentAccessToken = '';
		} else {
			//incorrect code, reset necessary properties
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

	//-------------------------------------- SERVER INITIALIZATION ------------------------------------------//

	private determineServerType(server: Server | Application | Router): ServerType {
		return this.isRestify(server) ? ServerType.Restify : ServerType.Express;
	}

	private isRestify(server: Server | Application | Router): server is Server {
		//restify servers have an address property and express applications and routers do not
		return (<Server>server).address !== undefined;
	}

	private captureBaseUrl(): void {
		if (this.serverType === ServerType.Restify) {
			//restify servers can fetch the base url immediately
			this.baseUrl = (this.server as Server).address().address === '::' ? `http://localhost:${(this.server as Server).address().port}` : (this.server as Server).address().address;
			this.initializePassport();
		} else {
			//express is unable to fetch the base url internally, but can inspect incoming requests to do so
			this.server.use((req: any, res: any, next: any) => {
				if (!this.baseUrl) {
					this.baseUrl = req.protocol + '://' + req.get('host');
					this.initializePassport();
				};
				next();
			})
		}
	};

	private initializeRedirectEndpoints(): void {
		if (this.serverType === ServerType.Restify) {
			this.server.use(this.customRestifyQueryParser);
		}
		//create redirect endpoint for login failure 
		this.server.get('/auth/failure', (req: any, res: any, next: any) => {
			res.json(`Authentication Failed`);
		});
		//passport providers ultimately redirect here
		this.server.get('/auth/callback', (req: any, res: any, next: any) => {
			//providers using Passport have already exchanged the authorization code for an access token
			let magicCode: string = this.generateMagicCode();
			this.renderMagicCode(req, res, next, magicCode);
		});
	};

	private customRestifyQueryParser(req: restify.Request, res: restify.Response, next: restify.Next): void {
		//using the restify plugins anywhere in the project breaks the express functionality, had to write a custom query parser
		let url: string = req.url ? decodeURIComponent(req.url) : '';
		let querystring: string = url.split('?')[1];
		let parsed: object = queryString.parse(querystring);
		req.query = parsed;
		next();
	}

	private generateMagicCode(): string {
		//generate a magic code, store it for the next turn and set sentCode to true to prepare for the following turn
		let magicCode: string = randomBytes(4).toString('hex');
		this.magicCode = magicCode;
		this.sentCode = true;
		return magicCode;
	};

	private renderMagicCode(req: any, res: any, next: any, magicCode: string): void {
		if (this.authenticationConfig.customMagicCodeRedirectEndpoint) {
			//redirect to provided endpoint with the magic code in the body
			let url: string = this.authenticationConfig.customMagicCodeRedirectEndpoint + `?magicCode=${magicCode}`;
			this.serverType === ServerType.Express ? res.redirect(url, 302) : res.redirect(302, url, next);
		} else {
			//send vanilla text to the user
			res.json(`Please enter the code into the bot: ${magicCode}`)
		};
	};

	//------------------------------------------ PASSPORT INIT ---------------------------------------------//

	private initializePassport() {
		let passport = this.serverType === ServerType.Express ? passportExpress : passportRestify;
		//initialize passport middleware
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
				this.storeAuthenticationData(accessToken, ProviderType.Facebook, profile, done);
			}));
			let facebookScope: string[] = this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : defaultProviderOptions.facebook.scopes;
			this.server.get('/auth/facebook', passport.authenticate('facebook', { scope: facebookScope }));
			this.server.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//Google
		if (this.authenticationConfig.google) {
			passport.use(new GoogleStrategy({
				clientID: this.authenticationConfig.google.clientId,
				clientSecret: this.authenticationConfig.google.clientSecret,
				callbackURL: `${this.baseUrl}/auth/google/callback`
			}, (accessToken: string, refreshToken: string, profile: GoogleProfile, done: Function) => {
				this.storeAuthenticationData(accessToken, ProviderType.Google, profile, done);
			}));
			let googleScope: string[] = this.authenticationConfig.google.scopes ? this.authenticationConfig.google.scopes : defaultProviderOptions.google.scopes;
			this.server.get('/auth/google', passport.authenticate('google', { scope: googleScope }));
			this.server.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//Azure AD v2
		if (this.authenticationConfig.azureADv2) {
			let azureADv2Scope: string[] = this.authenticationConfig.azureADv2.scopes ? this.authenticationConfig.azureADv2.scopes : defaultProviderOptions.azureADv2.scopes;
			let azureADv2Resource: string = this.authenticationConfig.azureADv2.resource ? this.authenticationConfig.azureADv2.resource : defaultProviderOptions.azureADv2.resource;
			let azureADv2Tenant: string = this.authenticationConfig.azureADv2 && this.authenticationConfig.azureADv2.tenant ? this.authenticationConfig.azureADv2.tenant : defaultProviderOptions.azureADv2.tenant;
			passport.use(new AzureAdOAuth2Strategy({
				clientID: this.authenticationConfig.azureADv2.clientId,
				clientSecret: this.authenticationConfig.azureADv2.clientSecret,
				callbackURL: `${this.baseUrl}/auth/azureADv2/callback`,
				scope: azureADv2Scope,
				resource: azureADv2Resource,
				tenant: azureADv2Tenant
			}, (accessToken: string, refresh_token: string, params: any, profile: any, done: Function) => {
				this.storeAuthenticationData(accessToken, ProviderType.AzureADv2, profile, done);
			}));
			this.server.get('/auth/azureADv2', passport.authenticate('azure_ad_oauth2'));
			this.server.get('/auth/azureADv2/callback', passport.authenticate('azure_ad_oauth2', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};

		//GitHub
		if (this.authenticationConfig.github) {
			passport.use(new GitHubStrategy({
				clientID: this.authenticationConfig.github.clientId,
				clientSecret: this.authenticationConfig.github.clientSecret,
				callbackURL: `${this.baseUrl}/auth/github/callback`,
			}, (accessToken: string, refreshToken: string, profile: GitHubProfile, done: Function) => {
				this.storeAuthenticationData(accessToken, ProviderType.Github, profile, done);
			}));
			let githubScope: string[] = this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : defaultProviderOptions.github.scopes;
			this.server.get('/auth/github', passport.authenticate('github', { scope: githubScope }));
			this.server.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
		};
	};

	private storeAuthenticationData(accessToken: string, provider: ProviderType, profile: any, done: Function): void {
		//store the access token on successful login (callback runs before successRedirect)		
		this.currentAccessToken = accessToken;
		this.selectedProvider = provider;
		return done(null, profile);
	}

	//--------------------------------------- ENVIRONMENT VARIABLES ------------------------------------------//

	private initializeEnvironmentVariables() {
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
		if (process.env.AZURE_AD_V2_CLIENT_ID && process.env.AZURE_AD_V2_CLIENT_SECRET) {
			let azureADv2Resource: string = this.authenticationConfig.azureADv2 && this.authenticationConfig.azureADv2.resource ? this.authenticationConfig.azureADv2.resource : defaultProviderOptions.azureADv2.resource;
			let azureADv2Tenant: string = this.authenticationConfig.azureADv2 && this.authenticationConfig.azureADv2.tenant ? this.authenticationConfig.azureADv2.tenant : defaultProviderOptions.azureADv2.tenant;
			this.authenticationConfig = {
				...this.authenticationConfig, azureADv2: {
					... this.authenticationConfig.azureADv2,
					clientId: process.env.AZURE_AD_V2_CLIENT_ID as string,
					clientSecret: process.env.AZURE_AD_V2_CLIENT_SECRET as string,
					resource: azureADv2Resource,
					tenant: azureADv2Tenant
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

	//------------------------------------------------ CARD ----------------------------------------------------------//

	private createAuthorizationUris(): ProviderAuthorizationUri[] {
		//Pass the authorization uris set up in the Passport initialization back to the user
		let authorizationUris: ProviderAuthorizationUri[] = [];
		if (this.authenticationConfig.facebook) authorizationUris.push({ provider: ProviderType.Facebook, authorizationUri: `${this.baseUrl}/auth/facebook` });
		if (this.authenticationConfig.google) authorizationUris.push({ provider: ProviderType.Google, authorizationUri: `${this.baseUrl}/auth/google` });
		if (this.authenticationConfig.azureADv2) authorizationUris.push({ provider: ProviderType.AzureADv2, authorizationUri: `${this.baseUrl}/auth/azureADv2` });
		if (this.authenticationConfig.github) authorizationUris.push({ provider: ProviderType.Github, authorizationUri: `${this.baseUrl}/auth/github` });
		return authorizationUris;
	};

	private async createAuthenticationCard(context: TurnContext): Promise<Partial<Activity>> {
		let authorizationUris: ProviderAuthorizationUri[] = this.createAuthorizationUris();
		if (this.authenticationConfig.customAuthenticationCardGenerator) {
			//immediately pass the authorization uris to the user for custom cards
			return await this.authenticationConfig.customAuthenticationCardGenerator(context, authorizationUris);
		} else {
			//add buttons for each provider the user passed configuration options for, or use the default options			
			let cardActions: CardAction[] = [];
			let buttonTitle: string;
			authorizationUris.map((providerAuthUri: ProviderAuthorizationUri) => {
				if (providerAuthUri.provider === ProviderType.AzureADv2) {
					//we can be sure azureADv2 is not undefined given the Provider Type
					buttonTitle = (this.authenticationConfig.azureADv2!.buttonText ? this.authenticationConfig.azureADv2!.buttonText : defaultProviderOptions.azureADv2.buttonText) as string;
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
};