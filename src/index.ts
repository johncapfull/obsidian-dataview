// Basic API type.
export type { DataviewApi } from "api/plugin-api";

// Core Dataview types.
export type { DateTime, Duration } from "luxon";
export type {
    Link,
    DataObject,
    LiteralType,
    Literal,
    LiteralRepr,
    WrappedLiteral,
    LiteralWrapper,
    Widget,
} from "data-model/value";

export type { Result, Success, Failure } from "api/result";

////////////////////
// Implementation //
////////////////////

import type { DataviewApi } from "api/plugin-api";

import "obsidian";
import type { App } from "obsidian";

// Utility functions.
/**
 * Get the current Dataview API from the app if provided; if not, it is inferred from the global API object installed
 * on the window.
 */
export const getAPI = (app?: App): DataviewApi | undefined => {
    if (app) return app.plugins.plugins.dataview?.api;
    else return window.DataviewAPI;
};

/** Determine if Dataview is enabled in the given application. */
export const isPluginEnabled = (app: App) => app.plugins.enabledPlugins.has("dataview");
