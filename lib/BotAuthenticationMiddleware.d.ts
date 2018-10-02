import { Server } from 'restify';
import { Application, Router } from 'express';
import { TurnContext, Middleware } from 'botbuilder';
import { BotAuthenticationConfiguration } from './BotAuthenticationConfiguration';
export declare class BotAuthenticationMiddleware implements Middleware {
    private server;
    private authenticationConfig;
    private baseUrl;
    private magicCode;
    private authData;
    private sentCode;
    private serverType;
    private tenantId;
    private botId;
    /**
     * Creates a new BotAuthenticationMiddleware instance.
     * @param server Restify server, Express application, or Express router that routes requests to the adapter.
     * @param authenticationConfig Configuration settings for the authentication middleware.
    */
    constructor(server: Server | Application | Router, authenticationConfig: BotAuthenticationConfiguration, baseUrl?: string, tenantId?: string, botId?: string);
    onTurn(context: TurnContext, next: Function): Promise<void>;
    private handleMagicCode;
    private determineServerType;
    private isRestify;
    private initializeServerMiddleware;
    private customRestifyQueryParser;
    private initializeRedirectEndpoints;
    private generateMagicCode;
    private renderMagicCode;
    private initializePassport;
    private initializePassportProviders;
    private storeAuthenticationData;
    private initializeEnvironmentVariables;
    private createAuthorizationUris;
    private createAuthenticationCard;
}
