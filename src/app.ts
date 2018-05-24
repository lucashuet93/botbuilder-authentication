import { BotFrameworkAdapter, MemoryStorage, ConversationState, MessageFactory, CardFactory, TurnContext, Activity } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { AuthenticationHelper } from './AuthenticationHelper';
import { AuthenticationConfig } from './interfaces';

let passport = require('passport');

let server: Server = createServer();
let port: any = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`)
});

let adapter = new BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

//--------------------Usage-------------------------

const authenticationConfig: AuthenticationConfig = {
	facebook: {
		clientId: '174907033110091',
		clientSecret: '482d08e1fa468e10d478ccc772452f24'
	}
}

adapter.use(new AuthenticationHelper(server, authenticationConfig));

server.post('/api/messages', (req: Request, res: Response) => {
	adapter.processActivity(req, res, async (context: TurnContext) => {
		if (context.activity.type === 'message') {
			await context.sendActivity(`You said ${context.activity.text}`)
		}
	})
})

