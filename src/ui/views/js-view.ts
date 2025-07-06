import { asyncEvalInContext, DataviewInlineApi } from "api/inline-api";
import { renderErrorPre, renderValue } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { DataviewApi } from "api/plugin-api";

import { EditorState, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript"

import { tags } from "@lezer/highlight"

// Plugin to highlight all lines
const highlightAllLinesPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view: EditorView): DecorationSet {
        const builder: Range<Decoration>[] = [];
        const { doc } = view.state;
        for (let i = 1; i <= doc.lines; i++) {
            const line = doc.line(i);
            builder.push(Decoration.line({ class: "cm-s-obsidian HyperMD-codeblock" }).range(line.from));
        }
        return Decoration.set(builder, true);
    }
}, {
  decorations: v => v.decorations
});

// ues classHighlighter?
// @ts-ignore
const cmHighlightStyle = HighlightStyle.define([
  { tag: tags.link, class: "cm-link" },
  { tag: tags.heading, class: "cm-heading" },
  { tag: tags.emphasis, class: "cm-emphasis" },
  { tag: tags.strong, class: "cm-strong" },
  { tag: tags.keyword, class: "cm-keyword" },
  { tag: tags.atom, class: "cm-atom" },
  { tag: tags.bool, class: "cm-bool" },
  { tag: tags.url, class: "cm-url" },
  { tag: tags.labelName, class: "cm-label" },
  { tag: tags.inserted, class: "cm-inserted" },
  { tag: tags.deleted, class: "cm-deleted" },
  { tag: tags.literal, class: "cm-literal" },
  { tag: tags.string, class: "cm-string" },
  { tag: tags.number, class: "cm-number" },
  { tag: tags.variableName, class: "cm-variable" },
  { tag: tags.typeName, class: "cm-typeName" },
  { tag: tags.namespace, class: "cm-namespace" },
  { tag: tags.className, class: "cm-className" },
  { tag: tags.macroName, class: "cm-macroName" },
  { tag: tags.propertyName, class: "cm-property" },
  { tag: tags.operator, class: "cm-operator" },
  { tag: tags.comment, class: "cm-comment" },
  { tag: tags.meta, class: "cm-meta" },
//  { tag: tags.punctuation, class: "cm-punctuation" },
  { tag: tags.invalid, class: "cm-invalid" }
]);

export class DataviewJSRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv = this;";

    constructor(public api: DataviewApi, public script: string, public container: HTMLElement, public origin: string) {
        super(container, api.index, api.app, api.settings);
    }

    async render() {
        this.container.innerHTML = "";
        if (!this.settings.enableDataviewJs) {
            this.containerEl.innerHTML = "";
            renderErrorPre(
                this.container,
                "Dataview JS queries are disabled. You can enable them in the Dataview settings."
            );
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            let div = this.container.createEl("div");

            let code = this.container.createEl("div");
            //code.innerHTML = previous;
            // @ts-ignore
            let editor = new EditorView({
                parent: code,
                doc: this.script, // "I am focusable but not editable"
                extensions: [
//                  basicSetup,
                  javascript({typescript: true}),
                  syntaxHighlighting(cmHighlightStyle),     // defaultHighlightStyle classHighlighter
                  highlightAllLinesPlugin,
                  EditorState.readOnly.of(true),
                  EditorView.editable.of(false),
                  EditorView.contentAttributes.of({tabindex: "0"})
                ]
              });
            //editor.dom.addClasses(["cm-s-obsidian", "HyperMD-codeblock"]);

            div.appendChild(code);

            let resultContainer = this.container.createEl("div");
            div.appendChild(resultContainer);

            await asyncEvalInContext(
                DataviewJSRenderer.PREAMBLE + this.script,
                new DataviewInlineApi(this.api, this, resultContainer, this.origin)
            );
        } catch (e) {
            this.containerEl.innerHTML = "";
            renderErrorPre(this.container, "Evaluation Error: " + e.stack);
        }
    }
}



/** Inline JS renderer accessible using '=$' by default. */
export class DataviewInlineJSRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv=this;";

    // The box that the error is rendered in, if relevant.
    errorbox?: HTMLElement;

    constructor(
        public api: DataviewApi,
        public script: string,
        public container: HTMLElement,
        public target: HTMLElement,
        public origin: string
    ) {
        super(container, api.index, api.app, api.settings);
    }

    async render() {
        this.errorbox?.remove();
        if (!this.settings.enableDataviewJs || !this.settings.enableInlineDataviewJs) {
            let temp = document.createElement("span");
            temp.innerText = "(disabled; enable in settings)";
            this.target.replaceWith(temp);
            this.target = temp;
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            let temp = document.createElement("span");
            let result = await asyncEvalInContext(
                DataviewInlineJSRenderer.PREAMBLE + this.script,
                new DataviewInlineApi(this.api, this, temp, this.origin)
            );
            this.target.replaceWith(temp);
            this.target = temp;
            if (result === undefined) return;

            renderValue(this.api.app, result, temp, this.origin, this, this.settings, false);
        } catch (e) {
            this.errorbox = this.container.createEl("div");
            renderErrorPre(this.errorbox, "Dataview (for inline JS query '" + this.script + "'): " + e);
        }
    }
}
