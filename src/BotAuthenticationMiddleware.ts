import * as dotenv from 'dotenv';
import * as restify from 'restify';
import * as express from 'express';
import * as expressSession from 'express-session';
import * as passportRestify from 'passport-restify';
import * as passportExpress from 'passport';
import * as passportAzure from 'passport-azure-ad';
import * as queryString from 'querystring';
import * as uuidv4 from 'uuid/v4';
import { randomBytes } from 'crypto';
import { Server } from 'restify';
import { Application, Router } from 'express';
import { TurnContext, Activity, MessageFactory, CardFactory, CardAction, ThumbnailCard, Attachment, Middleware } from 'botbuilder';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { Strategy as TwitterStrategy, Profile as TwitterProfile } from 'passport-twitter';
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from 'passport-github';
import { OAuth2Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth';
import { BotAuthenticationConfiguration, ProviderAuthorizationUri, ProviderType, AzureADConfiguration } from './BotAuthenticationConfiguration';
import { defaultProviderOptions, AzureADDefaults } from './DefaultProviderOptions';
import { ServerType } from './ServerType';

interface AuthData {
	selectedProvider: ProviderType;
	currentAccessToken: string;
	currentProfile: any;
}

export class BotAuthenticationMiddleware implements Middleware {

	private server: any;
	private authenticationConfig: BotAuthenticationConfiguration;
	private baseUrl: string;
	private magicCode: string;
	private authData: AuthData;
	private sentCode: boolean;
	private serverType: ServerType;

    /**
     * Creates a new BotAuthenticationMiddleware instance.
     * @param server Restify server, Express application, or Express router that routes requests to the adapter.
     * @param authenticationConfig Configuration settings for the authentication middleware.
    */
	constructor(server: Server | Application | Router, authenticationConfig: BotAuthenticationConfiguration, baseUrl: string = '::') {
		this.server = server;
		this.authenticationConfig = authenticationConfig;
		this.serverType = this.determineServerType(server);
		this.initializeServerMiddleware();
		this.initializeRedirectEndpoints();
		this.initializeEnvironmentVariables();
		this.initializePassport(baseUrl);
		//initialize auth data so we can set its properties later
		this.authData = {
			selectedProvider: ProviderType.Facebook,
			currentAccessToken: '',
			currentProfile: null
		}
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
			await this.authenticationConfig.onLoginSuccess(context, this.authData.currentAccessToken, this.authData.currentProfile, this.authData.selectedProvider);
			this.magicCode = '';
			this.sentCode = false;
		} else {
			//incorrect code, reset necessary properties
			if (this.authenticationConfig.onLoginFailure) {
				await this.authenticationConfig.onLoginFailure(context, this.authData.selectedProvider);
			} else {
				let loginFailedMessage: Partial<Activity> = MessageFactory.text('Invalid code. Please try again');
				await context.sendActivities([loginFailedMessage, await this.createAuthenticationCard(context)]);
			};
			this.magicCode = '';
			this.sentCode = false;
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

	private initializeServerMiddleware(): void {
		//initialize express session middleware, enables Azure AD
		this.server.use(expressSession({ secret: uuidv4(), resave: true, saveUninitialized: false }));
		if (this.serverType === ServerType.Restify) {
			//restify requires query parsing
			this.server.use(this.customRestifyQueryParser);
		}
	}

	private customRestifyQueryParser(req: restify.Request, res: restify.Response, next: restify.Next): void {
		//using the restify plugins anywhere in the project breaks the express functionality, had to write a custom query parser
		let url: string = req.url ? decodeURIComponent(req.url) : '';
		let querystring: string = url.split('?')[1];
		let parsed: object = queryString.parse(querystring);
		req.query = parsed;
		next();
	}

	//--------------------------------------- SERVER REDIRECTS -------------------------------------------//

	private initializeRedirectEndpoints(): void {
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

	private initializePassport(baseUrl: string): void {
		if (this.serverType === ServerType.Restify) {
			//restify servers can fetch the base url immediately
			this.baseUrl = baseUrl;
			this.initializePassportProviders();
		} else {
			//express is unable to fetch the base url internally, but can inspect incoming requests to do so
			this.server.use((req: any, res: any, next: any) => {
				if (!this.baseUrl) {
					this.baseUrl = req.protocol + '://' + req.get('host');
					this.initializePassportProviders();
				};
				next();
			})
		}
	};

	private initializePassportProviders() {
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

		//Twitter
		if (this.authenticationConfig.twitter) {
			passport.use(new TwitterStrategy({
				consumerKey: this.authenticationConfig.twitter.consumerKey,
				consumerSecret: this.authenticationConfig.twitter.consumerSecret,
				callbackURL: `${this.baseUrl}/auth/twitter/callback`,
				passReqToCallback: true
			}, (req: any, accessToken: any, refreshToken: any, profile: TwitterProfile, done: Function) => {
				this.storeAuthenticationData(accessToken, ProviderType.Twitter, profile, done);
			}));
			//twitter scopes are set in the developer console
			this.server.get('/auth/twitter', passport.authenticate('twitter'));
			this.server.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
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
		if (this.authenticationConfig.azureADv1 || this.authenticationConfig.azureADv2) {
			//Maximally save one Azure AD provider. If both are provided, use the Azure AD V2 credentials
			let azureAD: AzureADConfiguration = this.authenticationConfig.azureADv2 ? this.authenticationConfig.azureADv2 : this.authenticationConfig.azureADv1 as AzureADConfiguration;
			let defaultAzureAD: AzureADDefaults = this.authenticationConfig.azureADv2 ? defaultProviderOptions.azureADv2 : defaultProviderOptions.azureADv1;
			let azureADScope: string[] = azureAD.scopes ? azureAD.scopes : defaultAzureAD.scopes;
			let azureADTenant: string = azureAD.tenant ? azureAD.tenant : defaultAzureAD.tenant;
			let azureADResource: string = azureAD.resource ? azureAD.resource : defaultAzureAD.resource;
			let isV2: boolean = this.authenticationConfig.azureADv2 ? true : false;
			let isHttps: boolean = this.baseUrl.toLowerCase().includes('https');
			let isCommonEndpoint: boolean = azureADTenant === 'common';
			//Resources are placed in the resourceURL property for V1 apps. V2 apps combine resources with scopes.
			let options: object = isV2 ?
				{
					failureRedirect: '/auth/failure',
					tenantIdOrName: azureADTenant
				} : {
					failureRedirect: '/auth/failure',
					tenantIdOrName: azureADTenant,
					resourceURL: azureADResource
				}
			//specify v2.0 in identity metadata for V2 apps
			let metadata: string = isV2 ? `https://login.microsoftonline.com/${azureADTenant}/v2.0/.well-known/openid-configuration` : `https://login.microsoftonline.com/${azureADTenant}/.well-known/openid-configuration`;
			passport.use(new passportAzure.OIDCStrategy({
				identityMetadata: metadata,
				clientID: azureAD.clientId,
				clientSecret: azureAD.clientSecret,
				passReqToCallback: false,
				responseType: 'code',
				responseMode: 'query',
				redirectUrl: `${this.baseUrl}/auth/azureAD/callback`,
				allowHttpForRedirectUrl: !isHttps,
				scope: azureADScope,
				//do not validate the issuer unless a tenant is provided. Common doesn't work
				validateIssuer: !isCommonEndpoint,
				issuer: azureADTenant
			}, (iss: any, sub: any, profile: any, accessToken: string, refreshToken: string, done: Function) => {
				let provider: ProviderType = isV2 ? ProviderType.AzureADv2 : ProviderType.AzureADv1
				this.storeAuthenticationData(accessToken, provider, profile, done);
			}));
			let url: string = '/auth/callback';
			this.server.get('/auth/azureAD', passport.authenticate('azuread-openidconnect'));
			this.server.get('/auth/azureAD/callback', passport.authenticate('azuread-openidconnect', options), (req: any, res: any, next: any) => {
				//Azure AD auth works a bit differently, capture the response here and immediately redirect to the shared callback endpoint
				this.serverType === ServerType.Express ? res.redirect(url, 302) : res.redirect(302, url, next);
			});;
			this.server.post('/auth/azureAD/callback', passport.authenticate('azuread-openidconnect', options), (req: any, res: any, next: any) => {
				this.serverType === ServerType.Express ? res.redirect(url, 302) : res.redirect(302, url, next);
			});;
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
		//store the the relevant data in authData after successful login (callback runs before successRedirect)	
		this.authData.currentAccessToken = accessToken;
		this.authData.selectedProvider = provider;
		this.authData.currentProfile = profile;
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
		if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
			this.authenticationConfig = {
				...this.authenticationConfig, twitter: {
					... this.authenticationConfig.twitter,
					consumerKey: process.env.TWITTER_CONSUMER_KEY as string,
					consumerSecret: process.env.TWITTER_CONSUMER_SECRET as string,
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
		if (process.env.AZURE_AD_V1_CLIENT_ID && process.env.AZURE_AD_V1_CLIENT_SECRET) {
			let azureADv1Tenant: string = this.authenticationConfig.azureADv1 && this.authenticationConfig.azureADv1.tenant ? this.authenticationConfig.azureADv1.tenant : defaultProviderOptions.azureADv1.tenant;
			let azureADv1Resource: string = this.authenticationConfig.azureADv1 && this.authenticationConfig.azureADv1.resource ? this.authenticationConfig.azureADv1.resource : defaultProviderOptions.azureADv1.resource;
			this.authenticationConfig = {
				...this.authenticationConfig, azureADv1: {
					... this.authenticationConfig.azureADv1,
					clientId: process.env.AZURE_AD_V1_CLIENT_ID as string,
					clientSecret: process.env.AZURE_AD_V1_CLIENT_SECRET as string,
					tenant: azureADv1Tenant,
					resource: azureADv1Resource
				}
			};
		};
		if (process.env.AZURE_AD_V2_CLIENT_ID && process.env.AZURE_AD_V2_CLIENT_SECRET) {
			let azureADv2Tenant: string = this.authenticationConfig.azureADv2 && this.authenticationConfig.azureADv2.tenant ? this.authenticationConfig.azureADv2.tenant : defaultProviderOptions.azureADv2.tenant;
			this.authenticationConfig = {
				...this.authenticationConfig, azureADv2: {
					... this.authenticationConfig.azureADv2,
					clientId: process.env.AZURE_AD_V2_CLIENT_ID as string,
					clientSecret: process.env.AZURE_AD_V2_CLIENT_SECRET as string,
					tenant: azureADv2Tenant,
					resource: defaultProviderOptions.azureADv2.resource
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
		if (this.authenticationConfig.twitter) authorizationUris.push({ provider: ProviderType.Twitter, authorizationUri: `${this.baseUrl}/auth/twitter` });
		if (this.authenticationConfig.github) authorizationUris.push({ provider: ProviderType.Github, authorizationUri: `${this.baseUrl}/auth/github` });
		if (this.authenticationConfig.azureADv1 || this.authenticationConfig.azureADv2) {
			//Maximally send one Azure AD provider. If both are provided, send Azure AD V2
			let azureADProvider: ProviderType = this.authenticationConfig.azureADv2 ? ProviderType.AzureADv2 : ProviderType.AzureADv1;
			authorizationUris.push({ provider: azureADProvider, authorizationUri: `${this.baseUrl}/auth/azureAD` });
		}
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
				if (providerAuthUri.provider === ProviderType.AzureADv1) {
					//we can be sure authenticationConfig.azureADv1 is not undefined given the Provider Type
					buttonTitle = (this.authenticationConfig.azureADv1!.buttonText ? this.authenticationConfig.azureADv1!.buttonText : defaultProviderOptions.azureADv1.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.AzureADv2) {
					buttonTitle = (this.authenticationConfig.azureADv2!.buttonText ? this.authenticationConfig.azureADv2!.buttonText : defaultProviderOptions.azureADv2.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Facebook) {
					buttonTitle = (this.authenticationConfig.facebook!.buttonText ? this.authenticationConfig.facebook!.buttonText : defaultProviderOptions.facebook.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Google) {
					buttonTitle = (this.authenticationConfig.google!.buttonText ? this.authenticationConfig.google!.buttonText : defaultProviderOptions.google.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Github) {
					buttonTitle = (this.authenticationConfig.github!.buttonText ? this.authenticationConfig.github!.buttonText : defaultProviderOptions.github.buttonText) as string;
				} else if (providerAuthUri.provider === ProviderType.Twitter) {
					buttonTitle = (this.authenticationConfig.twitter!.buttonText ? this.authenticationConfig.twitter!.buttonText : defaultProviderOptions.twitter.buttonText) as string;
				}
				cardActions.push({ type: 'openUrl', value: providerAuthUri.authorizationUri, title: buttonTitle });
			});
			let card: Attachment = CardFactory.thumbnailCard('', undefined, cardActions);
			let authMessage: Partial<Activity> = MessageFactory.attachment(card);
			return authMessage;
		};
	};
};