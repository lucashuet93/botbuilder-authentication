"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Defines available authentication providers.
 * @enum {string}
 */
var ServerType;
(function (ServerType) {
    ServerType["Express"] = "express";
    ServerType["Restify"] = "restify";
})(ServerType = exports.ServerType || (exports.ServerType = {}));
