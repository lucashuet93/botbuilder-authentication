
# botbuilder-simple-authentication

| Supported Providers |
|:-------------------:|
| Active Directory V2 |
| Facebook            |
| Google              |
| GitHub              |


## Basic Usage

#### Installation

```
npm install botbuilder-simple-authentication
```

#### Import the botbuilder-simple-authentication module

```javascript
let simpleAuth = require('botbuilder-simple-authentication');
```

#### Create a BotAuthenticationConfiguration

```javascript
let storage = new builder.MemoryStorage();
const conversationState = new builder.ConversationState(storage);
adapter.use(conversationState);

const authenticationConfig = {
	isUserAuthenticated: (context) => {
		//if this method returns false, the middleware will take over
		const state = conversationState.get(context);
		return state.authData;
	},
	onLoginSuccess: async (context, accessToken, provider) => {
		const state = conversationState.get(context);
		state.authData = { accessToken, provider };
		await context.sendActivity(`You're logged in!`);
	},
	onLoginFailure: async (context, provider) => {
		const state = conversationState.get(context);
		await context.sendActivity('Login failed.');
	},
	facebook: {
		clientId: 'FACEBOOK_CLIENT_ID',
		clientSecret: 'FACEBOOK_CLIENT_SECRET'
	}
};
```

#### Implement the BotAuthenticationMiddleware

```javascript
adapter.use(new simpleAuth.BotAuthenticationMiddleware(server, adapter, authenticationConfig));
```

## Samples

This repository provides basic and advanced examples for both JavaScript and TypeScript, found in **/src/samples**.

## Configuration Properties

#### BotAuthenticationConfiguration

| Property                           | Constraint    | Type                                                                  |
| ---------------------------------- | ------------- | --------------------------------------------------------------------- |
| isUserAuthenticated                | Required      | (context: TurnContext) => boolean                                     |
| onLoginSuccess                     | Required      | (context: TurnContext, accessToken: string, provider: string) => void |
| onLoginFailure                     | Required      | (context: TurnContext, provider: string) => void                      |
| customAuthenticationCardGenerator  | Optional      | (context: TurnContext, authorizationUris: {}[]) => Partial< Activity >|
| customMagicCodeRedirectEndpoint    | Optional      | string                                                                |
| noUserFoundMessage                 | Optional      | string                                                                |
| facebook                           | Optional      | ProviderConfiguration                                                 |
| activeDirectory                    | Optional      | ProviderConfiguration                                                 |
| google                             | Optional      | ProviderConfiguration                                                 |
| github                             | Optional      | ProviderConfiguration                                                 |

#### ProviderConfiguration

| Property                        | Constraint    | Type                  |
| ------------------------------- | ------------- | --------------------- |
| clientId                        | Required      | string                |
| clientSecret                    | Required      | string                |
| scopes                          | Optional      | string[]              |
| buttonText                      | Optional      | string                |

## Custom Scopes

Each provider declared in the BotAuthenticationConfiguration object has an optional `scope` property that accepts an array of strings. If custom scopes aren't provided, the following scopes are used by default:


| Provider                 | Scopes                                     |
| ------------------------ | ------------------------------------------ |
| Active Directory V2      | User.Read                                  |
| Facebook                 | public_profile                             |
| Google                   | https://www.googleapis.com/auth/plus.login |
| GitHub                   | user                                       |

#### Default Scopes

```javascript
facebook: {
	clientId: 'FACEBOOK_CLIENT_ID',
	clientSecret: 'FACEBOOK_CLIENT_SECRET'
}
```
#### Custom Scopes

```javascript
facebook: {
	clientId: 'FACEBOOK_CLIENT_ID',
	clientSecret: 'FACEBOOK_CLIENT_SECRET'
	scopes: ['public_profile', 'email', 'user_likes']
}
```

## Customizing Button Text

Each provider declared in the BotAuthenticationConfiguration object has an optional `buttonText` property that accepts a string. If custom button text isn't provided, the following strings are used by default:


| Provider                 | Button Text                                |
| ------------------------ | ------------------------------------------ |
| Active Directory V2      | Log in with Microsoft                      |
| Facebook                 | Log in with Facebook                       |
| Google                   | Log in with Google+                        |
| GitHub                   | Log in with GitHub                         |

#### Default Button Text

```
facebook: {
	clientId: 'FACEBOOK_CLIENT_ID',
	clientSecret: 'FACEBOOK_CLIENT_SECRET'
}
```
#### Custom Button Text

```
facebook: {
	clientId: 'FACEBOOK_CLIENT_ID',
	clientSecret: 'FACEBOOK_CLIENT_SECRET'
	buttonText: 'Facebook'
}
```

## Custom Authentication Card

## Custom Magic Code HTML

## Using Environment Variables