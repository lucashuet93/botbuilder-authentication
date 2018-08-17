"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//basic scopes and text options to be used by default
exports.defaultProviderOptions = {
    facebook: {
        scopes: ['public_profile'],
        buttonText: 'Log in with Facebook'
    },
    azureADv1: {
        scopes: ['User.Read'],
        buttonText: 'Log in with Microsoft',
        tenant: 'common',
        resource: 'https://graph.windows.net'
    },
    azureADv2: {
        scopes: ['profile'],
        buttonText: 'Log in with Microsoft',
        tenant: 'common',
        resource: ''
    },
    google: {
        scopes: ['https://www.googleapis.com/auth/plus.login'],
        buttonText: 'Log in with Google+'
    },
    twitter: {
        scopes: ['Read only'],
        buttonText: 'Log in with Twitter'
    },
    github: {
        scopes: ['user'],
        buttonText: 'Log in with GitHub'
    }
};
