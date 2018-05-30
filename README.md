
# botbuilder-simple-authentication

| Supported Providers |
|:-------------------:|
| Active Directory V2 |
| Facebook            |
| Google              |
| GitHub              |

## Configuration Properties

##### BotAuthenticationConfiguration

| Property                        | Constraint    | Type                  |
| ------------------------------- | ------------- | --------------------- |
| isUserAuthenticated             | Required      | Function              |
| onLoginSuccess                  | Required      | Function              |
| onLoginFailure                  | Required      | Function              |
| createCustomAuthenticationCard  | Optional      | Function              |
| customMagicCodeRedirectEndpoint | Optional      | string                |
| noUserFoundMessage              | Optional      | string                |
| facebook                        | Optional      | ProviderConfiguration |
| activeDirectory                 | Optional      | ProviderConfiguration |
| google                          | Optional      | ProviderConfiguration |
| github                          | Optional      | ProviderConfiguration |

##### ProviderConfiguration

| Property                        | Constraint    | Type                  |
| ------------------------------- | ------------- | --------------------- |
| clientId                        | Required      | string                |
| clientSecret                    | Required      | string                |
| scopes                          | Optional      | string[]              |
| buttonText                      | Optional      | string                |

## Provider Default Options 

| Providers                | Scopes                                     | Button Text            |
| ------------------------ | ------------------------------------------ | ---------------------- |
| Active Directory V2      | User.Read                                  | Log in with Microsoft  |
| Facebook                 | public_profile                             | Log in with Facebook   |
| Google                   | https://www.googleapis.com/auth/plus.login | Log in with Google+    |
| GitHub                   | user                                       | Log in with GitHub     |

## Custom Scopes

## Custom Authentication Card

## Custom Magic Code HTML