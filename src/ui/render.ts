
/** Render a pre block with an error in it; returns the element to allow for dynamic updating. */
export function renderErrorPre(container: HTMLElement, error: string): HTMLElement {
    let pre = container.createEl("pre", { cls: ["dataview", "dataview-error"] });
    pre.appendText(error);
    return pre;
}

/** Render a static codeblock. */
export function renderCodeBlock(container: HTMLElement, source: string, language?: string): HTMLElement {
    let code = container.createEl("code", { cls: ["dataview"] });
    if (language) code.classList.add("language-" + language);
    code.appendText(source);
    return code;
}


