"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var expressSession = require("express-session");
var passportRestify = require("passport-restify");
var passportExpress = require("passport");
var passportAzure = require("passport-azure-ad");
var queryString = require("querystring");
var uuidv4 = require("uuid/v4");
var crypto_1 = require("crypto");
var botbuilder_1 = require("botbuilder");
var passport_facebook_1 = require("passport-facebook");
var passport_twitter_1 = require("passport-twitter");
var passport_github_1 = require("passport-github");
var passport_google_oauth_1 = require("passport-google-oauth");
var BotAuthenticationConfiguration_1 = require("./BotAuthenticationConfiguration");
var DefaultProviderOptions_1 = require("./DefaultProviderOptions");
var ServerType_1 = require("./ServerType");
var BotAuthenticationMiddleware = /** @class */ (function () {
    /**
     * Creates a new BotAuthenticationMiddleware instance.
     * @param server Restify server, Express application, or Express router that routes requests to the adapter.
     * @param authenticationConfig Configuration settings for the authentication middleware.
    */
    function BotAuthenticationMiddleware(server, authenticationConfig, baseUrl) {
        if (baseUrl === void 0) { baseUrl = '::'; }
        this.server = server;
        this.authenticationConfig = authenticationConfig;
        this.serverType = this.determineServerType(server);
        this.initializeServerMiddleware();
        this.initializeRedirectEndpoints();
        this.initializeEnvironmentVariables();
        this.initializePassport(baseUrl);
        //initialize auth data so we can set its properties later
        this.authData = {
            selectedProvider: BotAuthenticationConfiguration_1.ProviderType.Facebook,
            currentAccessToken: '',
            currentProfile: null
        };
    }
    ;
    //---------------------------------------- CONVERSATIONAL LOGIC -------------------------------------------//
    BotAuthenticationMiddleware.prototype.onTurn = function (context, next) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!(context.activity.type === 'message')) return [3 /*break*/, 11];
                        if (!!this.authenticationConfig.isUserAuthenticated(context)) return [3 /*break*/, 8];
                        if (!!this.sentCode) return [3 /*break*/, 5];
                        if (!this.authenticationConfig.noUserFoundMessage) return [3 /*break*/, 2];
                        return [4 /*yield*/, context.sendActivity(this.authenticationConfig.noUserFoundMessage)];
                    case 1:
                        _c.sent();
                        _c.label = 2;
                    case 2:
                        ;
                        _b = (_a = context).sendActivity;
                        return [4 /*yield*/, this.createAuthenticationCard(context)];
                    case 3: return [4 /*yield*/, _b.apply(_a, [_c.sent()])];
                    case 4:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 5: 
                    //auth flow is underway, validate that the user has input the correct code
                    return [4 /*yield*/, this.handleMagicCode(context)];
                    case 6:
                        //auth flow is underway, validate that the user has input the correct code
                        _c.sent();
                        _c.label = 7;
                    case 7:
                        ;
                        return [2 /*return*/];
                    case 8: 
                    //immediately pass on authenticated messages
                    return [4 /*yield*/, next()];
                    case 9:
                        //immediately pass on authenticated messages
                        _c.sent();
                        _c.label = 10;
                    case 10:
                        ;
                        return [3 /*break*/, 13];
                    case 11: 
                    //immediately pass on non-messages
                    return [4 /*yield*/, next()];
                    case 12:
                        //immediately pass on non-messages
                        _c.sent();
                        _c.label = 13;
                    case 13:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    BotAuthenticationMiddleware.prototype.handleMagicCode = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var submittedCode, loginFailedMessage, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        submittedCode = context.activity.text;
                        if (!(submittedCode.toLowerCase() === this.magicCode.toLowerCase())) return [3 /*break*/, 2];
                        //correct code, reset necessary properties and run provided onLoginSuccess
                        return [4 /*yield*/, this.authenticationConfig.onLoginSuccess(context, this.authData.currentAccessToken, this.authData.currentProfile, this.authData.selectedProvider)];
                    case 1:
                        //correct code, reset necessary properties and run provided onLoginSuccess
                        _d.sent();
                        this.magicCode = '';
                        this.sentCode = false;
                        return [3 /*break*/, 8];
                    case 2:
                        if (!this.authenticationConfig.onLoginFailure) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.authenticationConfig.onLoginFailure(context, this.authData.selectedProvider)];
                    case 3:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        loginFailedMessage = botbuilder_1.MessageFactory.text('Invalid code. Please try again');
                        _b = (_a = context).sendActivities;
                        _c = [loginFailedMessage];
                        return [4 /*yield*/, this.createAuthenticationCard(context)];
                    case 5: return [4 /*yield*/, _b.apply(_a, [_c.concat([_d.sent()])])];
                    case 6:
                        _d.sent();
                        _d.label = 7;
                    case 7:
                        ;
                        this.magicCode = '';
                        this.sentCode = false;
                        _d.label = 8;
                    case 8:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    //-------------------------------------- SERVER INITIALIZATION ------------------------------------------//
    BotAuthenticationMiddleware.prototype.determineServerType = function (server) {
        return this.isRestify(server) ? ServerType_1.ServerType.Restify : ServerType_1.ServerType.Express;
    };
    BotAuthenticationMiddleware.prototype.isRestify = function (server) {
        //restify servers have an address property and express applications and routers do not
        return server.address !== undefined;
    };
    BotAuthenticationMiddleware.prototype.initializeServerMiddleware = function () {
        //initialize express session middleware, enables Azure AD
        this.server.use(expressSession({ secret: uuidv4(), resave: true, saveUninitialized: false }));
        if (this.serverType === ServerType_1.ServerType.Restify) {
            //restify requires query parsing
            this.server.use(this.customRestifyQueryParser);
        }
    };
    BotAuthenticationMiddleware.prototype.customRestifyQueryParser = function (req, res, next) {
        //using the restify plugins anywhere in the project breaks the express functionality, had to write a custom query parser
        var url = req.url ? decodeURIComponent(req.url) : '';
        var querystring = url.split('?')[1];
        var parsed = queryString.parse(querystring);
        req.query = parsed;
        next();
    };
    //--------------------------------------- SERVER REDIRECTS -------------------------------------------//
    BotAuthenticationMiddleware.prototype.initializeRedirectEndpoints = function () {
        var _this = this;
        //create redirect endpoint for login failure 
        this.server.get('/auth/failure', function (req, res, next) {
            res.json("Authentication Failed");
        });
        //passport providers ultimately redirect here
        this.server.get('/auth/callback', function (req, res, next) {
            //providers using Passport have already exchanged the authorization code for an access token
            var magicCode = _this.generateMagicCode();
            _this.renderMagicCode(req, res, next, magicCode);
        });
    };
    ;
    BotAuthenticationMiddleware.prototype.generateMagicCode = function () {
        //generate a magic code, store it for the next turn and set sentCode to true to prepare for the following turn
        var magicCode = crypto_1.randomBytes(4).toString('hex');
        this.magicCode = magicCode;
        this.sentCode = true;
        return magicCode;
    };
    ;
    BotAuthenticationMiddleware.prototype.renderMagicCode = function (req, res, next, magicCode) {
        if (this.authenticationConfig.customMagicCodeRedirectEndpoint) {
            //redirect to provided endpoint with the magic code in the body
            var url = this.authenticationConfig.customMagicCodeRedirectEndpoint + ("?magicCode=" + magicCode);
            this.serverType === ServerType_1.ServerType.Express ? res.redirect(url, 302) : res.redirect(302, url, next);
        }
        else {
            //send vanilla text to the user
            res.json("Please enter the code into the bot: " + magicCode);
        }
        ;
    };
    ;
    //------------------------------------------ PASSPORT INIT ---------------------------------------------//
    BotAuthenticationMiddleware.prototype.initializePassport = function (baseUrl) {
        var _this = this;
        if (this.serverType === ServerType_1.ServerType.Restify) {
            //restify servers can fetch the base url immediately
            this.baseUrl = baseUrl;
            this.initializePassportProviders();
        }
        else {
            //express is unable to fetch the base url internally, but can inspect incoming requests to do so
            this.server.use(function (req, res, next) {
                if (!_this.baseUrl) {
                    _this.baseUrl = req.protocol + '://' + req.get('host');
                    _this.initializePassportProviders();
                }
                ;
                next();
            });
        }
    };
    ;
    BotAuthenticationMiddleware.prototype.initializePassportProviders = function () {
        var _this = this;
        var passport = this.serverType === ServerType_1.ServerType.Express ? passportExpress : passportRestify;
        //initialize passport middleware
        this.server.use(passport.initialize());
        this.server.use(passport.session());
        // used to serialize the user for the session
        passport.serializeUser(function (user, done) {
            done(null, user);
        });
        // used to deserialize the user
        passport.deserializeUser(function (id, done) {
            done(null, id);
        });
        //Facebook
        if (this.authenticationConfig.facebook) {
            passport.use(new passport_facebook_1.Strategy({
                clientID: this.authenticationConfig.facebook.clientId,
                clientSecret: this.authenticationConfig.facebook.clientSecret,
                callbackURL: this.baseUrl + "/auth/facebook/callback"
            }, function (accessToken, refreshToken, profile, done) {
                _this.storeAuthenticationData(accessToken, BotAuthenticationConfiguration_1.ProviderType.Facebook, profile, done);
            }));
            var facebookScope = this.authenticationConfig.facebook.scopes ? this.authenticationConfig.facebook.scopes : DefaultProviderOptions_1.defaultProviderOptions.facebook.scopes;
            this.server.get('/auth/facebook', passport.authenticate('facebook', { scope: facebookScope }));
            this.server.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
        }
        ;
        //Twitter
        if (this.authenticationConfig.twitter) {
            passport.use(new passport_twitter_1.Strategy({
                consumerKey: this.authenticationConfig.twitter.consumerKey,
                consumerSecret: this.authenticationConfig.twitter.consumerSecret,
                callbackURL: this.baseUrl + "/auth/twitter/callback",
                passReqToCallback: true
            }, function (req, accessToken, refreshToken, profile, done) {
                _this.storeAuthenticationData(accessToken, BotAuthenticationConfiguration_1.ProviderType.Twitter, profile, done);
            }));
            //twitter scopes are set in the developer console
            this.server.get('/auth/twitter', passport.authenticate('twitter'));
            this.server.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
        }
        ;
        //Google
        if (this.authenticationConfig.google) {
            passport.use(new passport_google_oauth_1.OAuth2Strategy({
                clientID: this.authenticationConfig.google.clientId,
                clientSecret: this.authenticationConfig.google.clientSecret,
                callbackURL: this.baseUrl + "/auth/google/callback"
            }, function (accessToken, refreshToken, profile, done) {
                _this.storeAuthenticationData(accessToken, BotAuthenticationConfiguration_1.ProviderType.Google, profile, done);
            }));
            var googleScope = this.authenticationConfig.google.scopes ? this.authenticationConfig.google.scopes : DefaultProviderOptions_1.defaultProviderOptions.google.scopes;
            this.server.get('/auth/google', passport.authenticate('google', { scope: googleScope }));
            this.server.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
        }
        ;
        //Azure AD v2
        if (this.authenticationConfig.azureADv1 || this.authenticationConfig.azureADv2) {
            //Maximally save one Azure AD provider. If both are provided, use the Azure AD V2 credentials
            var azureAD = this.authenticationConfig.azureADv2 ? this.authenticationConfig.azureADv2 : this.authenticationConfig.azureADv1;
            var defaultAzureAD = this.authenticationConfig.azureADv2 ? DefaultProviderOptions_1.defaultProviderOptions.azureADv2 : DefaultProviderOptions_1.defaultProviderOptions.azureADv1;
            var azureADScope = azureAD.scopes ? azureAD.scopes : defaultAzureAD.scopes;
            var azureADTenant = azureAD.tenant ? azureAD.tenant : defaultAzureAD.tenant;
            var azureADResource = azureAD.resource ? azureAD.resource : defaultAzureAD.resource;
            var isV2_1 = this.authenticationConfig.azureADv2 ? true : false;
            var isHttps = this.baseUrl.toLowerCase().includes('https');
            var isCommonEndpoint = azureADTenant === 'common';
            //Resources are placed in the resourceURL property for V1 apps. V2 apps combine resources with scopes.
            var options = isV2_1 ?
                {
                    failureRedirect: '/auth/failure',
                    tenantIdOrName: azureADTenant
                } : {
                failureRedirect: '/auth/failure',
                tenantIdOrName: azureADTenant,
                resourceURL: azureADResource
            };
            //specify v2.0 in identity metadata for V2 apps
            var metadata = isV2_1 ? "https://login.microsoftonline.com/" + azureADTenant + "/v2.0/.well-known/openid-configuration" : "https://login.microsoftonline.com/" + azureADTenant + "/.well-known/openid-configuration";
            passport.use(new passportAzure.OIDCStrategy({
                identityMetadata: metadata,
                clientID: azureAD.clientId,
                clientSecret: azureAD.clientSecret,
                passReqToCallback: false,
                responseType: 'code',
                responseMode: 'query',
                redirectUrl: this.baseUrl + "/auth/azureAD/callback",
                allowHttpForRedirectUrl: !isHttps,
                scope: azureADScope,
                //do not validate the issuer unless a tenant is provided. Common doesn't work
                validateIssuer: !isCommonEndpoint,
                issuer: azureADTenant
            }, function (iss, sub, profile, accessToken, refreshToken, done) {
                var provider = isV2_1 ? BotAuthenticationConfiguration_1.ProviderType.AzureADv2 : BotAuthenticationConfiguration_1.ProviderType.AzureADv1;
                _this.storeAuthenticationData(accessToken, provider, profile, done);
            }));
            var url_1 = '/auth/callback';
            this.server.get('/auth/azureAD', passport.authenticate('azuread-openidconnect'));
            this.server.get('/auth/azureAD/callback', passport.authenticate('azuread-openidconnect', options), function (req, res, next) {
                //Azure AD auth works a bit differently, capture the response here and immediately redirect to the shared callback endpoint
                _this.serverType === ServerType_1.ServerType.Express ? res.redirect(url_1, 302) : res.redirect(302, url_1, next);
            });
            ;
            this.server.post('/auth/azureAD/callback', passport.authenticate('azuread-openidconnect', options), function (req, res, next) {
                _this.serverType === ServerType_1.ServerType.Express ? res.redirect(url_1, 302) : res.redirect(302, url_1, next);
            });
            ;
        }
        ;
        //GitHub
        if (this.authenticationConfig.github) {
            passport.use(new passport_github_1.Strategy({
                clientID: this.authenticationConfig.github.clientId,
                clientSecret: this.authenticationConfig.github.clientSecret,
                callbackURL: this.baseUrl + "/auth/github/callback",
            }, function (accessToken, refreshToken, profile, done) {
                _this.storeAuthenticationData(accessToken, BotAuthenticationConfiguration_1.ProviderType.Github, profile, done);
            }));
            var githubScope = this.authenticationConfig.github.scopes ? this.authenticationConfig.github.scopes : DefaultProviderOptions_1.defaultProviderOptions.github.scopes;
            this.server.get('/auth/github', passport.authenticate('github', { scope: githubScope }));
            this.server.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/auth/callback', failureRedirect: '/auth/failure' }));
        }
        ;
    };
    ;
    BotAuthenticationMiddleware.prototype.storeAuthenticationData = function (accessToken, provider, profile, done) {
        //store the the relevant data in authData after successful login (callback runs before successRedirect)	
        this.authData.currentAccessToken = accessToken;
        this.authData.selectedProvider = provider;
        this.authData.currentProfile = profile;
        return done(null, profile);
    };
    //--------------------------------------- ENVIRONMENT VARIABLES ------------------------------------------//
    BotAuthenticationMiddleware.prototype.initializeEnvironmentVariables = function () {
        //pull the environment variables declared by the user for the supported providers
        var environment = process.env.NODE_ENV || 'development';
        if (environment === 'development') {
            dotenv.load();
        }
        ;
        //update the authentication configuration accordingly
        if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
            this.authenticationConfig = __assign({}, this.authenticationConfig, { facebook: __assign({}, this.authenticationConfig.facebook, { clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET }) });
        }
        ;
        if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
            this.authenticationConfig = __assign({}, this.authenticationConfig, { twitter: __assign({}, this.authenticationConfig.twitter, { consumerKey: process.env.TWITTER_CONSUMER_KEY, consumerSecret: process.env.TWITTER_CONSUMER_SECRET }) });
        }
        ;
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            this.authenticationConfig = __assign({}, this.authenticationConfig, { google: __assign({}, this.authenticationConfig.google, { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }) });
        }
        ;
        if (process.env.AZURE_AD_V1_CLIENT_ID && process.env.AZURE_AD_V1_CLIENT_SECRET) {
            var azureADv1Tenant = this.authenticationConfig.azureADv1 && this.authenticationConfig.azureADv1.tenant ? this.authenticationConfig.azureADv1.tenant : DefaultProviderOptions_1.defaultProviderOptions.azureADv1.tenant;
            var azureADv1Resource = this.authenticationConfig.azureADv1 && this.authenticationConfig.azureADv1.resource ? this.authenticationConfig.azureADv1.resource : DefaultProviderOptions_1.defaultProviderOptions.azureADv1.resource;
            this.authenticationConfig = __assign({}, this.authenticationConfig, { azureADv1: __assign({}, this.authenticationConfig.azureADv1, { clientId: process.env.AZURE_AD_V1_CLIENT_ID, clientSecret: process.env.AZURE_AD_V1_CLIENT_SECRET, tenant: azureADv1Tenant, resource: azureADv1Resource }) });
        }
        ;
        if (process.env.AZURE_AD_V2_CLIENT_ID && process.env.AZURE_AD_V2_CLIENT_SECRET) {
            var azureADv2Tenant = this.authenticationConfig.azureADv2 && this.authenticationConfig.azureADv2.tenant ? this.authenticationConfig.azureADv2.tenant : DefaultProviderOptions_1.defaultProviderOptions.azureADv2.tenant;
            this.authenticationConfig = __assign({}, this.authenticationConfig, { azureADv2: __assign({}, this.authenticationConfig.azureADv2, { clientId: process.env.AZURE_AD_V2_CLIENT_ID, clientSecret: process.env.AZURE_AD_V2_CLIENT_SECRET, tenant: azureADv2Tenant, resource: DefaultProviderOptions_1.defaultProviderOptions.azureADv2.resource }) });
        }
        ;
        if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
            this.authenticationConfig = __assign({}, this.authenticationConfig, { github: __assign({}, this.authenticationConfig.github, { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }) });
        }
        ;
    };
    ;
    //------------------------------------------------ CARD ----------------------------------------------------------//
    BotAuthenticationMiddleware.prototype.createAuthorizationUris = function () {
        //Pass the authorization uris set up in the Passport initialization back to the user
        var authorizationUris = [];
        if (this.authenticationConfig.facebook)
            authorizationUris.push({ provider: BotAuthenticationConfiguration_1.ProviderType.Facebook, authorizationUri: this.baseUrl + "/auth/facebook" });
        if (this.authenticationConfig.google)
            authorizationUris.push({ provider: BotAuthenticationConfiguration_1.ProviderType.Google, authorizationUri: this.baseUrl + "/auth/google" });
        if (this.authenticationConfig.twitter)
            authorizationUris.push({ provider: BotAuthenticationConfiguration_1.ProviderType.Twitter, authorizationUri: this.baseUrl + "/auth/twitter" });
        if (this.authenticationConfig.github)
            authorizationUris.push({ provider: BotAuthenticationConfiguration_1.ProviderType.Github, authorizationUri: this.baseUrl + "/auth/github" });
        if (this.authenticationConfig.azureADv1 || this.authenticationConfig.azureADv2) {
            //Maximally send one Azure AD provider. If both are provided, send Azure AD V2
            var azureADProvider = this.authenticationConfig.azureADv2 ? BotAuthenticationConfiguration_1.ProviderType.AzureADv2 : BotAuthenticationConfiguration_1.ProviderType.AzureADv1;
            authorizationUris.push({ provider: azureADProvider, authorizationUri: this.baseUrl + "/auth/azureAD" });
        }
        return authorizationUris;
    };
    ;
    BotAuthenticationMiddleware.prototype.createAuthenticationCard = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var authorizationUris, cardActions_1, buttonTitle_1, card, authMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        authorizationUris = this.createAuthorizationUris();
                        if (!this.authenticationConfig.customAuthenticationCardGenerator) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.authenticationConfig.customAuthenticationCardGenerator(context, authorizationUris)];
                    case 1: 
                    //immediately pass the authorization uris to the user for custom cards
                    return [2 /*return*/, _a.sent()];
                    case 2:
                        cardActions_1 = [];
                        authorizationUris.map(function (providerAuthUri) {
                            if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.AzureADv1) {
                                //we can be sure authenticationConfig.azureADv1 is not undefined given the Provider Type
                                buttonTitle_1 = (_this.authenticationConfig.azureADv1.buttonText ? _this.authenticationConfig.azureADv1.buttonText : DefaultProviderOptions_1.defaultProviderOptions.azureADv1.buttonText);
                            }
                            else if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.AzureADv2) {
                                buttonTitle_1 = (_this.authenticationConfig.azureADv2.buttonText ? _this.authenticationConfig.azureADv2.buttonText : DefaultProviderOptions_1.defaultProviderOptions.azureADv2.buttonText);
                            }
                            else if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.Facebook) {
                                buttonTitle_1 = (_this.authenticationConfig.facebook.buttonText ? _this.authenticationConfig.facebook.buttonText : DefaultProviderOptions_1.defaultProviderOptions.facebook.buttonText);
                            }
                            else if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.Google) {
                                buttonTitle_1 = (_this.authenticationConfig.google.buttonText ? _this.authenticationConfig.google.buttonText : DefaultProviderOptions_1.defaultProviderOptions.google.buttonText);
                            }
                            else if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.Github) {
                                buttonTitle_1 = (_this.authenticationConfig.github.buttonText ? _this.authenticationConfig.github.buttonText : DefaultProviderOptions_1.defaultProviderOptions.github.buttonText);
                            }
                            else if (providerAuthUri.provider === BotAuthenticationConfiguration_1.ProviderType.Twitter) {
                                buttonTitle_1 = (_this.authenticationConfig.twitter.buttonText ? _this.authenticationConfig.twitter.buttonText : DefaultProviderOptions_1.defaultProviderOptions.twitter.buttonText);
                            }
                            cardActions_1.push({ type: 'openUrl', value: providerAuthUri.authorizationUri, title: buttonTitle_1 });
                        });
                        card = botbuilder_1.CardFactory.thumbnailCard('', undefined, cardActions_1);
                        authMessage = botbuilder_1.MessageFactory.attachment(card);
                        return [2 /*return*/, authMessage];
                    case 3:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    return BotAuthenticationMiddleware;
}());
exports.BotAuthenticationMiddleware = BotAuthenticationMiddleware;
;
