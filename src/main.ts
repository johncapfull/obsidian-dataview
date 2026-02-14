import {
    App,
    Component,
    Editor,
    EditorPosition, FileManager,
    MarkdownFileInfo,
    MarkdownPostProcessorContext,
    MarkdownView, normalizePath,
    Plugin,
    PluginSettingTab,
    Setting, TFile,
    WorkspaceLeaf
} from "obsidian";
import { DataviewApi } from "api/plugin-api";
import { DataviewSettings, DEFAULT_SETTINGS } from "settings";
import { DataviewInlineApi } from "api/inline-api";
import { Extension } from "@codemirror/state";
import { ImageGalleryChild } from "gallery/gallery";

// ------
// Кусок внутренностей для переименования ссылки
// https://github.com/aleksey-rowan/obsidian-context-aware-move-and-rename/blob/master/src/types.ts#L44

const enum linkTypeEnum {
    internal = "internal-link",
    external = "external-link",
}

type LinkTypes = {
    [key in linkTypeEnum]: () => void;
};

interface ClickableToken {
    type: linkTypeEnum;
    text: string;
    start: EditorPosition;
    end: EditorPosition;
}

abstract class EditorExtended extends Editor {
    abstract getClickableTokenAt(position: EditorPosition): ClickableToken | null;
}

abstract class FileManagerExtended extends FileManager {
    abstract promptForFileRename(file: TFile): void;
}

// ------

export default class DataviewPlugin extends Plugin {
    /** Plugin-wide default settings. */
    public settings: DataviewSettings;

    /** External-facing plugin API. */
    public api: DataviewApi;

    /** CodeMirror 6 extensions that dataview installs. Tracked via array to allow for dynamic updates. */
    private cmExtension: Extension[];

    async onload() {
        // Settings initialization; write defaults first time around.
        this.settings = Object.assign(DEFAULT_SETTINGS, (await this.loadData()) ?? {});
        this.addSettingTab(new GeneralSettingsTab(this.app, this));

        // From this point onwards the dataview API is fully functional (even if the index needs to do some background indexing).
        this.api = new DataviewApi(this.app, this.settings, this.manifest.version);

        // Register API to global window object.
        (window["DataviewAPI"] = this.api) && this.register(() => delete window["DataviewAPI"]);

        // DataviewJS codeblocks.
        this.registerPriorityCodeblockPostProcessor(
            this.settings.dataviewJsKeyword,
            -100,
            async (source: string, el, ctx) => this.dataviewjs(source, el, ctx, ctx.sourcePath)
        );

        // SVG codeblocks
        this.registerPriorityCodeblockPostProcessor("svg", -100,
            async (source: string, el, ctx) => this.dataviewsvg(source, el, ctx, ctx.sourcePath));

        // Image Gallery
        this.registerPriorityCodeblockPostProcessor("gallery", -100, async (src, el, ctx) => {
          const handler = new ImageGalleryChild(src, el, this.app);
          ctx.addChild(handler);
        });

        // editor extensions
        this.cmExtension = [];
        this.registerEditorExtension(this.cmExtension);

        // Dataview "force refresh" operation.
        this.addCommand({
            id: "dataview-force-refresh-views",
            name: "Force refresh all views and blocks",
            callback: () => {
                this.app.workspace.trigger("dataview:refresh-views");
            },
        });

        interface WorkspaceLeafRebuild extends WorkspaceLeaf {
            rebuildView(): void;
        }

        this.addCommand({
            id: "dataview-rebuild-current-view",
            name: "Rebuild current view",
            callback: () => {
                const activeView: MarkdownView | null = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    (activeView.leaf as WorkspaceLeafRebuild).rebuildView();
                }
            },
        });

        // Очень недостающая команда которая позволяет переименовать
        // файл под курсором по хоткею блядь
        // https://forum.obsidian.md/t/keyboard-shortcut-to-rename-links-in-a-note/25213/14
        this.addCommand({
            id: "dataview-rename-link",
            name: "Rename link under cursor",
            editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                this.renameLink(editor as EditorExtended, ctx);
            },
        });

        // Not required anymore, though holding onto it for backwards-compatibility.
        this.app.metadataCache.trigger("dataview:api-ready", this.api);
        console.log(`Dataview: version ${this.manifest.version} (requires obsidian ${this.manifest.minAppVersion})`);

        this.registerDataviewjsCodeHighlighting();
        this.register(() => this.unregisterDataviewjsCodeHighlighting());
    }

    public registerDataviewjsCodeHighlighting(): void {
        window.CodeMirror.defineMode(this.settings.dataviewJsKeyword, config =>
            window.CodeMirror.getMode(config, "javascript")
        );
    }

    public unregisterDataviewjsCodeHighlighting(): void {
        window.CodeMirror.defineMode(this.settings.dataviewJsKeyword, config =>
            window.CodeMirror.getMode(config, "null")
        );
    }

    public onunload() {
        console.log(`Dataview: version ${this.manifest.version} unloaded.`);
    }

    /** Register a markdown post processor with the given priority. */
    public registerPriorityMarkdownPostProcessor(
        priority: number,
        processor: (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>
    ) {
        let registered = this.registerMarkdownPostProcessor(processor);
        registered.sortOrder = priority;
    }

    /** Register a markdown codeblock post processor with the given priority. */
    public registerPriorityCodeblockPostProcessor(
        language: string,
        priority: number,
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>
    ) {
        let registered = this.registerMarkdownCodeBlockProcessor(language, processor);
        registered.sortOrder = priority;
    }


    /** Generate a DataviewJS view running the given source in the given element. */
    public async dataviewjs(
        source: string,
        el: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ) {
        el.style.overflowX = "auto";
        this.api.executeJs(source, el, component, sourcePath);
    }

    public async dataviewsvg(
        source: string,
        el: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ) {
        el.style.overflowX = "auto";
        this.api.executeSvg(source, el, component, sourcePath);
    }

    /** Update plugin settings. */
    async updateSettings(settings: Partial<DataviewSettings>) {
        Object.assign(this.settings, settings);
        await this.saveData(this.settings);
    }

    /** @deprecated Call the given callback when the dataview API has initialized. */
    public withApi(callback: (api: DataviewApi) => void) {
        callback(this.api);
    }

    /**
     * Create an API element localized to the given path, with lifecycle management managed by the given component.
     * The API will output results to the given HTML element.
     */
    public localApi(path: string, component: Component, el: HTMLElement): DataviewInlineApi {
        return new DataviewInlineApi(this.api, component, el, path);
    }

    // MARK: - Link rename

    private renameLink(editor: EditorExtended, info: MarkdownFileInfo) {
        const cursorPosition = editor.getCursor();
        const token = editor.getClickableTokenAt(cursorPosition);
        if (!token) {
            return;
        }

        const linkTypes: LinkTypes = {
            [linkTypeEnum.external]: () => {
                // call "edit link" command which just selects the text of the link
                editor.focus();
                editor.setSelection(token.start, token.end);
            },
            [linkTypeEnum.internal]: () => {
                // abort if we can't find the link object for some reason
                const linkPath = normalizePath(token.text).split("#")[0];
                const path = info.file?.path
                if (path == null) {
                    return ;
                }
                const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, path);
                if (!file) {
                    return;
                }
                const fm = this.app.fileManager as FileManagerExtended;
                fm.promptForFileRename(file);
            },
        };
        linkTypes[token.type]();
    }
}

/** All of the dataview settings in a single, nice tab. */
class GeneralSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: DataviewPlugin) {
        super(app, plugin);
    }

    public display(): void {
        this.containerEl.empty();

        new Setting(this.containerEl)
            .setName("Enable JavaScript queries")
            .setDesc("Enable or disable executing DataviewJS queries.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.enableDataviewJs)
                    .onChange(async value => await this.plugin.updateSettings({ enableDataviewJs: value }))
            );

        new Setting(this.containerEl).setName("Codeblocks").setHeading();

        new Setting(this.containerEl)
            .setName("DataviewJS keyword")
            .setDesc(
                "Keyword for DataviewJS blocks. Defaults to 'dataviewjs'. Reload required for changes to take effect."
            )
            .addText(text =>
                text
                    .setPlaceholder("dataviewjs")
                    .setValue(this.plugin.settings.dataviewJsKeyword)
                    .onChange(async value => {
                        if (value.length == 0) return;
                        this.plugin.unregisterDataviewjsCodeHighlighting();
                        await this.plugin.updateSettings({ dataviewJsKeyword: value });
                        this.plugin.registerDataviewjsCodeHighlighting();
                    })
            );

        new Setting(this.containerEl).setName("View").setHeading();


        new Setting(this.containerEl)
            .setName("Refresh interval")
            .setDesc("How long to wait (in milliseconds) for files to stop changing before updating views.")
            .addText(text =>
                text
                    .setPlaceholder("500")
                    .setValue("" + this.plugin.settings.refreshInterval)
                    .onChange(async value => {
                        let parsed = parseInt(value);
                        if (isNaN(parsed)) return;
                        parsed = parsed < 100 ? 100 : parsed;
                        await this.plugin.updateSettings({ refreshInterval: parsed });
                    })
            );
    }
}
