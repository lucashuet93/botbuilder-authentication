import { BotFrameworkAdapter } from 'botbuilder';
import { createServer, Server, Request, Response } from 'restify';

let server: Server = createServer();
let port: any = process.env.PORT || 3978;

server.listen(port, () => {
	console.log(`Magic happening on ${port}`)
});

let adapter = new BotFrameworkAdapter({
	appId: undefined,
	appPassword: undefined
});

server.post('/api/messages', (req: Request, res: Response) => {
	adapter.processActivity(req, res, async (context: any) => {
		if (context.activity.type === 'message') {
			await context.sendActivity(`You said ${context.activity.text}`)
		}
	})
})