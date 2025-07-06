import { renderErrorPre } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { DataviewApi } from "api/plugin-api";

export class DataviewSvgRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv = this;";

    constructor(public api: DataviewApi, public script: string, public container: HTMLElement, public origin: string) {
        super(container, api.index, api.app, api.settings);
    }

    async render() {
        this.container.innerHTML = "";

        // Assume that the code is javascript, and try to eval it.
        try {
            //await asyncEvalInContext(DataviewSvgRenderer.PREAMBLE + this.script,
            //    new DataviewInlineApi(this.api, this, this.container, this.origin));
            //let div = this.container.createEl("div");


        } catch (e) {
            this.containerEl.innerHTML = "";
            renderErrorPre(this.container, "Evaluation Error: " + e.stack);
        }
    }
}

