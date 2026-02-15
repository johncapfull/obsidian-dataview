/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import type { DataviewApi } from "api/plugin-api";
import { DataviewSettings } from "settings";
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

    /////////////////////////
    // Console Functions   //
    /////////////////////////

    public formatValue(value: any): String {
        if (value === null || value === undefined) {
           return String(value);
        } else if (Array.isArray(value)) {
            // does array has object?
            if (value.some(v => typeof v === "object" && v !== null)) {
                return JSON.stringify(value, null, 2);
            }
            return `[${value.map(v => String(v)).join(", ")}]`;            
        } else if (typeof value === "object") {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    }

    // Аналог po в lldb
    public trace(value: any) {
        this.dbg(this.formatValue(value));
    }

    // Просто текст
    public dbg(text: String) {
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
        
        // return container.createEl(el, Object.assign({ text }, options));
        //elem.appendText(text);

        let elem = container.createEl(el, options);
        elem.innerHTML = text;
        return elem;
    }

    public div(
        text: any, 
        { container = this.container, ...options }: DomElementInfo & { container?: HTMLElement } = {}
    ): HTMLDivElement {
        let elem = container.createDiv(options);
        elem.innerHTML = text;
        return elem;
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
