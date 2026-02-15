/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api` or as global `DataviewAPI`). */

import { App, Component, MarkdownPostProcessorContext } from "obsidian";
import { renderCodeBlock, renderErrorPre } from "ui/render";
import * as Luxon from "luxon";
import { compare, CompareOperator, satisfies } from "compare-versions";
import { DataviewSettings } from "settings";
import { DataviewJSRenderer } from "ui/views/js-view";



/** Global API for accessing the Dataview API, executing dataview queries, and  */
export class DataviewApi {
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

    ///////////////
    // Rendering //
    ///////////////

    /**
     * Execute the given DataviewJS query, rendering results into the given container using the components lifecycle.
     * See {@link execute} for general rendering semantics.
     */
    public async executeJs(
        code: string,
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext,
        filePath: string
    ) {
        if (isDataviewDisabled(filePath)) {
            renderCodeBlock(el, code, "javascript");
            return;
        }

        const info = ctx.getSectionInfo(el);
        const line = info?.lineStart ?? 0;

        const renderer = new DataviewJSRenderer(this, code, el, filePath, line);
        renderer.load();
        ctx.addChild(renderer);
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
}

/** Determines if source-path has a `?no-dataview` annotation that disables dataview. */
export function isDataviewDisabled(sourcePath: string): boolean {
    if (!sourcePath) return false;

    let questionLocation = sourcePath.lastIndexOf("?");
    if (questionLocation == -1) return false;

    return sourcePath.substring(questionLocation).contains("no-dataview");
}
