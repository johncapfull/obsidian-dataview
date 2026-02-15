/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { renderValue, renderErrorPre } from "ui/render";
import type { DataviewApi } from "api/plugin-api";
import { DataviewSettings } from "settings";
import { Link, Literal, Values, Widgets } from "data-model/value";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import * as culori from "culori";

export class DataviewInlineApi {
    /** The component that handles the lifetime of this view. Use it if you are adding custom event handlers/components. */
    public component: Component;
    /** The path to the current file this script is running in. */
    public currentFilePath: string;

    /** The container which holds the output of this view. You can directly append fields to this, if you wish, though the rendering API is likely to be easier for straight-forward purposes. */
    public container: HTMLElement;
    public outContainer?: HTMLElement;

    /** Directly access the Obsidian app object, such as for reaching out to other plugins. */
    public app: App;

    /** The general plugin API which much of this inline API delegates to. */
    public api: DataviewApi;

    /** Settings which determine defaults, incl. many rendering options. */
    public settings: DataviewSettings;

    /** Value utilities which allow for type-checking and comparisons. */
    public value = Values;

    /** Widget utility functions for creating built-in widgets. */
    public widget = Widgets;

    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    public luxon = Luxon;

    /** Culori for color manipulations */
    public culori = culori;

    /** Общий объект чтобы через него шарить функции и значения */
    public shared: Object;

    constructor(api: DataviewApi, component: Component, container: HTMLElement, currentFilePath: string, outContainer?: HTMLElement) {
        this.app = api.app;
        this.settings = api.settings;

        this.component = component;
        this.container = container;
        this.outContainer = outContainer;
        this.currentFilePath = currentFilePath;

        this.api = api;

        this.shared = api.shared;
    }

    ///////////////////////////////
    // Dataview Query Evaluation //
    ///////////////////////////////

    /** Execute a DataviewJS query and embed it into the current view. */
    public async executeJs(code: string) {
        this.api.executeJs(code, this.container, this.component, this.currentFilePath);
    }

    /////////////
    // Utility //
    /////////////

    /** Create a dataview file link to the given path. */
    public fileLink(path: string, embed: boolean = false, display?: string): Link {
        return Link.file(path, embed, display);
    }

    /** Create a dataview section link to the given path. */
    public sectionLink(path: string, section: string, embed: boolean = false, display?: string): Link {
        return Link.header(path, section, embed, display);
    }

    /** Create a dataview block link to the given path. */
    public blockLink(path: string, blockId: string, embed: boolean = false, display?: string): Link {
        return Link.block(path, blockId, embed, display);
    }

    /** Attempt to extract a date from a string, link or date. */
    public date(pathlike: string | Link | DateTime): DateTime | null {
        return this.api.date(pathlike);
    }

    /** Attempt to extract a duration from a string or duration. */
    public duration(dur: string | Duration): Duration | null {
        return this.api.duration(dur);
    }

    /** Deep clone the given literal, returning a new literal which is independent of the original. */
    public clone(value: Literal): Literal {
        return Values.deepCopy(value);
    }

    /**
     * Compare two arbitrary JavaScript values using Dataview's default comparison rules. Returns a negative value if
     * a < b, 0 if a = b, and a positive value if a > b.
     */
    public compare(a: any, b: any): number {
        return Values.compareValue(a, b);
    }

    /** Return true if the two given JavaScript values are equal using Dataview's default comparison rules. */
    public equal(a: any, b: any): boolean {
        return this.compare(a, b) == 0;
    }

    /////////////////////////
    // Console Functions   //
    /////////////////////////

    public trace(text: String) {
        let out = this.outContainer;
        if (out) {
            let previous = out.textContent ?? ""
            out.textContent = previous + text + "\n";
        }
    }

    /////////////////////////
    // Rendering Functions //
    /////////////////////////

    /** Render an HTML element, containing arbitrary text. */
    public el<K extends keyof HTMLElementTagNameMap>(
        el: K,
        text: any,
        { container = this.container, ...options }: DomElementInfo & { container?: HTMLElement } = {}
    ): HTMLElementTagNameMap[K] {
        let wrapped = Values.wrapValue(text);

        if (wrapped === null || wrapped === undefined) {
            return container.createEl(el, Object.assign({ text }, options));
        }

        let _el = container.createEl(el, options);
        renderValue(this.app, wrapped.value, _el, this.currentFilePath, this.component, this.settings, true);
        return _el;
    }

    /** Render an HTML header; the level can be anything from 1 - 6. */
    public header(level: number, text: any, options?: DomElementInfo): HTMLHeadingElement {
        let header = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" }[level];
        if (!header) throw Error(`Unrecognized level '${level}' (expected 1, 2, 3, 4, 5, or 6)`);

        return this.el(header as keyof HTMLElementTagNameMap, text, options) as HTMLHeadingElement;
    }

    /** Render an HTML paragraph, containing arbitrary text. */
    public paragraph(text: any, options?: DomElementInfo): HTMLParagraphElement {
        return this.el("p", text, options);
    }

    /** Render an inline span, containing arbitrary text. */
    public span(text: any, options?: DomElementInfo): HTMLSpanElement {
        return this.el("span", text, options);
    }

    /**
     * Render HTML from the output of a template "view" saved as a file in the vault.
     * Takes a filename and arbitrary input data.
     */
    public async view(viewName: string, input: any) {
        // Look for `${viewName}.js` first, then for `${viewName}/view.js`.
        const simpleViewPath = `${viewName}.js`;
        const complexViewPath = `${viewName}/view.js`;
        let checkForCss = false;
        let cssElement = undefined;
        let viewFile = this.app.metadataCache.getFirstLinkpathDest(simpleViewPath, this.currentFilePath);
        if (!viewFile) {
            viewFile = this.app.metadataCache.getFirstLinkpathDest(complexViewPath, this.currentFilePath);
            checkForCss = true;
        }

        if (!viewFile) {
            renderErrorPre(
                this.container,
                `Dataview: custom view not found for '${simpleViewPath}' or '${complexViewPath}'.`
            );
            return;
        }

        if (checkForCss) {
            // Check for optional CSS.
            let cssFile = this.app.metadataCache.getFirstLinkpathDest(`${viewName}/view.css`, this.currentFilePath);
            if (cssFile) {
                let cssContents = await this.app.vault.read(cssFile);
                cssContents += `\n/*# sourceURL=${location.origin}/${cssFile.path} */`;
                cssElement = this.container.createEl("style", { text: cssContents, attr: { scope: " " } });
            }
        }

        let contents = await this.app.vault.read(viewFile);
        if (contents.contains("await")) contents = "(async () => { " + contents + " })()";
        contents += `\n//# sourceURL=${viewFile.path}`;
        let func = new Function("dv", "input", contents);

        try {
            // This may directly render, in which case it will likely return undefined or null.
            let result = await Promise.resolve(func(this, input));
            if (result)
                await renderValue(
                    this.app,
                    result as any,
                    this.container,
                    this.currentFilePath,
                    this.component,
                    this.settings,
                    true
                );
        } catch (ex) {
            if (cssElement) this.container.removeChild(cssElement);
            renderErrorPre(this.container, `Dataview: Failed to execute view '${viewFile.path}'.\n\n${ex}`);
        }
    }

    // Some math and another helper functions от меня конкретно ////////////////////////

    public lerp_from_to(x: number, xfrom: number, xto: number, from: number, to: number) {
        if (!((xto > xfrom && x >= xfrom && x <= xto) ||
            (xfrom > xto && x >= xto && x <= xfrom))) {
            this.trace("ASSERT: lerp");
            return;
        }
        return ((from * (xto - x) + to * (x - xfrom)) / (xto - xfrom));
    }

    public clamp(x: number, from: number, to: number) {
        return Math.min(Math.max(x, from), to);
    }

    public saturate(x: number) {
        return this.clamp(x, 0.0, 1.0);
    }

    public share(name: string, v: any) {
        // @ts-ignore
        this.shared[name] = v;
    }
}

/** Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables. */
export function evalInContext(script: string, context: any): any {
    return function () {
        return eval(script);
    }.call(context);
}

/** Evaluate a script possibly asynchronously, if the script contains `async/await` blocks. */
export async function asyncEvalInContext(script: string, context: any): Promise<any> {
    if (script.includes("await")) {
        return evalInContext("(async () => { " + script + " })()", context) as Promise<any>;
    } else {
        return Promise.resolve(evalInContext(script, context));
    }
}
