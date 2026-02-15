/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api` or as global `DataviewAPI`). */

import { App, Component, MarkdownPostProcessorContext } from "obsidian";
import { Link, Literal, Values, Widgets } from "data-model/value";
import { renderCodeBlock, renderErrorPre, renderValue } from "ui/render";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import { compare, CompareOperator, satisfies } from "compare-versions";
import { DataviewSettings } from "settings";
import { DataviewJSRenderer } from "ui/views/js-view";

export type BoundFunctionImpl = (...args: Literal[]) => Literal;


/** Global API for accessing the Dataview API, executing dataview queries, and  */
export class DataviewApi {
    /** Dataview functions which can be called from DataviewJS. */
    public utils: Record<string, BoundFunctionImpl>;
    /** Value utility functions for comparisons and type-checking. */
    public value = Values;
    /** Widget utility functions for creating built-in widgets. */
    public widget = Widgets;
    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    public luxon = Luxon;

    /** Глобальный словарь который сохраняет стейт на протяжении жизни плагина, для коммуникации функций */
    public shared = {};

    public constructor(
        public app: App,
        public settings: DataviewSettings,
        private verNum: string
    ) {
    }

    /** Utilities to check the current Dataview version and compare it to SemVer version ranges. */
    public version: {
        current: string;
        compare: (op: CompareOperator, ver: string) => boolean;
        satisfies: (range: string) => boolean;
    } = (() => {
        const self = this;
        return {
            get current() {
                return self.verNum;
            },
            compare: (op: CompareOperator, ver: string) => compare(this.verNum, ver, op),
            satisfies: (range: string) => satisfies(this.verNum, range),
        };
    })();

    /////////////
    // Utility //
    /////////////


    /** Create a dataview file link to the given path. */
    public fileLink(path: string, embed: boolean = false, display?: string) {
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
        return this.utils.date(pathlike) as DateTime | null;
    }

    /** Attempt to extract a duration from a string or duration. */
    public duration(str: string | Duration): Duration | null {
        return this.utils.dur(str) as Duration | null;
    }

    /** Deep clone the given literal, returning a new literal which is independent of the original. */
    public clone(value: Literal): Literal {
        return Values.deepCopy(value);
    }


    ///////////////
    // Rendering //
    ///////////////

    /**
     * Execute the given DataviewJS query, rendering results into the given container using the components lifecycle.
     * See {@link execute} for general rendering semantics.
     */
    public async executeJs(
        code: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        filePath: string
    ) {
        if (isDataviewDisabled(filePath)) {
            renderCodeBlock(container, code, "javascript");
            return;
        }
        const renderer = new DataviewJSRenderer(this, code, container, filePath);
        renderer.load();
        component.addChild(renderer);
    }

    public async executeSvg(
        code: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        filePath: string
    ) {
        /*
        let codeEl = container.createEl("code", { cls: ["dataview"] });
        codeEl.classList.add("language-svg");
        codeEl.appendText("preved");
        */

        try {
            let parser = new DOMParser();
            let document = parser.parseFromString(code, "image/svg+xml");

            const parserError = document.querySelector("parsererror");
            if (parserError) {
                let description = parserError.getElementsByTagName("div")[0].textContent;
                throw Error(`${description}`);
            }

            const collection = Array.from(document.documentElement.children);

            let svg = container.createSvg("svg");
            for (const element of collection) {
                svg.appendChild(element); // element.cloneNode(true)
            }
        } catch (e) {
            // this.containerEl.innerHTML = "";
            renderErrorPre(container, "Parsing Error: " + e.message);
        }

        //component.addChild(renderer);
    }

    /** Render an arbitrary value into a container. */
    public async renderValue(
        value: any,
        container: HTMLElement,
        component: Component,
        filePath: string,
        inline: boolean = false
    ) {
        return renderValue(this.app, value as Literal, container, filePath, component, this.settings, inline);
    }
}

/** The result of executing a calendar query. */
export type CalendarResult = {
    type: "calendar";
    values: {
        date: DateTime;
        link: Link;
        value?: Literal[];
    }[];
};

/** Determines if source-path has a `?no-dataview` annotation that disables dataview. */
export function isDataviewDisabled(sourcePath: string): boolean {
    if (!sourcePath) return false;

    let questionLocation = sourcePath.lastIndexOf("?");
    if (questionLocation == -1) return false;

    return sourcePath.substring(questionLocation).contains("no-dataview");
}
