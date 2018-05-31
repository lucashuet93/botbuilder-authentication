
# botbuilder-simple-authentication

#### Table of Contents
1. [Basic Usage](#basic)
1. [Samples](#samples)
1. [Configuration Properties](#properties)
1. [Custom Scopes](#scopes)
1. [Custom Button Text](#text)
1. [Custom Authentication Card](#card)
1. [Custom Magic Code HTML](#code)
1. [Using Environment Variables](#env)

<div id='basic'></div>

## Basic Usage

#### Create an Application with a Supported Provider

Navigate to a supported provider's developer site and create a new application. Add the appropriate endpoints to your app's approved redirect urls (localhost and deployed site). Copy the clientId and clientSecret used to create the BotAuthenticationConfiguration.

| Supported Providers | Redirect URL                             | Developer Site                         |
| ------------------- | ---------------------------------------- | -------------------------------------- |
| Active Directory V2 | {ROOT_URL}/auth/callback                 | https://apps.dev.microsoft.com         |
| Facebook            | {ROOT_URL}/auth/facebook/callback        | https://developers.facebook.com/apps   |
| Google              | {ROOT_URL}/auth/google/callback          | https://console.cloud.google.com/home  |
| GitHub              | {ROOT_URL}/auth/callback                 | https://github.com/settings/developers |


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
<div id='samples'></div>

## Samples

This repository provides basic and advanced examples for both JavaScript and TypeScript, found in **/src/samples**.

<div id='properties'></div>

## Configuration Properties

#### BotAuthenticationConfiguration

| Property                           | Constraint    | Type                                                                  | Description                  |
| ---------------------------------- | ------------- | --------------------------------------------------------------------- | -----------------------------|
| isUserAuthenticated                | Required      | (context: TurnContext) => boolean                                     | Runs each converation turn. The middleware will prevent the bot logic from running when it returns false. | 
| onLoginSuccess                     | Required      | (context: TurnContext, accessToken: string, provider: string) => void | Runs when the user inputs the correct magic code.  |
| onLoginFailure                     | Required      | (context: TurnContext, provider: string) => void                      | Runs when the user inputs an incorrect magic code. |
| customAuthenticationCardGenerator  | Optional      | (context: TurnContext, authorizationUris: {}[]) => Partial< Activity >| Overrides the default Authentication Card. The middleware supplies the authorization uris necessary to build the card. |
| customMagicCodeRedirectEndpoint    | Optional      | string                                                                | Overrides the default magic code display page. The server endpoint provided will receive a request with the magic code in the querystring. |
| noUserFoundMessage                 | Optional      | string                                                                | Message sent on first conversation turn where the user is not authenticated, immediately prior to the Authentication Card. |
| facebook                           | Optional      | ProviderConfiguration                                                 | Configuration object that enabes Facebook authentication. |
| activeDirectory                    | Optional      | ProviderConfiguration                                                 | Configuration object that enables Azure AD V2 authentication. |
| google                             | Optional      | ProviderConfiguration                                                 | Configuration object that enables Google authentication. |
| github                             | Optional      | ProviderConfiguration                                                 | Configuration object that enables GitHub authentication. |

#### ProviderConfiguration

| Property                        | Constraint    | Type                  | Description                                                                          |
| ------------------------------- | ------------- | --------------------- | ------------------------------------------------------------------------------------ |
| clientId                        | Required      | string                | Client id taken from the provider's authentication application.                      |
| clientSecret                    | Required      | string                | Client secret taken from the provider's authentication application.                  |
| scopes                          | Optional      | string[]              | Scopes that the user will be asked to consent to as part of the authentication flow. |
| buttonText                      | Optional      | string                | Text displayed inside the button that triggers the provider's authentication flow.   |

<div id='scopes'></div>

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

<div id='text'></div>

## Custom Button Text

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

<div id='card'></div>

## Custom Authentication Card

<div id='code'></div>

## Custom Magic Code HTML

<div id='env'></div>

## Using Environment Variables