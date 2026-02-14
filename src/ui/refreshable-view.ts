import { App, MarkdownRenderChild } from "obsidian";
import { DataviewSettings } from "settings";

/** Generic code for embedded Dataviews. */
export abstract class DataviewRefreshableRenderer extends MarkdownRenderChild {
    public constructor(
        public container: HTMLElement,
        public app: App,
        public settings: DataviewSettings
    ) {
        super(container);
    }

    abstract render(): Promise<void>;

    onload() {
        this.render();
        // Refresh after index changes stop.
        this.registerEvent(this.app.workspace.on("dataview:refresh-views", this.maybeRefresh));
        // ...or when the DOM is shown (sidebar expands, tab selected, nodes scrolled into view).
        this.register(this.container.onNodeInserted(this.maybeRefresh));
    }

    maybeRefresh = () => {
        // If the index revision has changed recently, then queue a reload.
        // But only if we're mounted in the DOM and auto-refreshing is active.
        if (this.container.isShown() && this.settings.refreshEnabled) {
            this.render();
        }
    };
}
