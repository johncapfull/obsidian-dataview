import { App, MarkdownRenderChild } from 'obsidian'
import { normalizePath, parseYaml, Platform } from 'obsidian'
import { TFolder, TFile } from 'obsidian'

export class ImageGalleryChild extends MarkdownRenderChild {
  private _gallery: HTMLElement | null = null
  private _settings: {[key: string]: any} = {}
  private _imagesList: {[key: string]: any} = {}

  constructor(
    public src: string,
    public container: HTMLElement,
    public app: App
  ) {
    super(container)
  }

  async onload() {
    // parse and normalize settings
    this._settings = getSettings(this.src, this.container)
    this._imagesList = getImagesList(this.app, this.container, this._settings)

    // inject the pertinent kind of gallery
    this._gallery = buildHorizontal(this.container, this._imagesList, this._settings)
  }

  async onunload() {
    if (this._gallery) {
      this._gallery.remove()
      this._gallery = null
    }
  }
}

function buildHorizontal(container: HTMLElement, imagesList: {[key: string]: any}, settings: {[key: string]: any}) {
  // inject the gallery wrapper
  const gallery = container.createEl('div')
  gallery.addClass('grid-wrapper')
  gallery.style.display = 'flex'
  gallery.style.flexWrap = 'wrap'
  gallery.style.marginRight = `-${settings.gutter}px`

  // inject and style images
  imagesList.forEach((file: {[key: string]: string}) => {
    const figure = gallery.createEl('figure')
    figure.addClass('grid-item')
    figure.style.margin = `0px ${settings.gutter}px ${settings.gutter}px 0px`
    figure.style.width = 'auto'
    figure.style.height = `${settings.height}px`
    figure.style.borderRadius = `${settings.radius}px`
    figure.style.flex = '1 0 auto'
    figure.style.overflow = 'hidden'
    figure.style.cursor = 'pointer'
    figure.setAttribute('data-name', file.name)
    figure.setAttribute('data-folder', file.name)
    figure.setAttribute('data-src', file.uri)

    const img = figure.createEl('img')
    img.style.objectFit = 'cover'
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.borderRadius = '0px'
    img.src = file.uri
  })

  return gallery
}


function getImagesList(app: App, container: HTMLElement, settings: {[key: string]: any}) {

  // retrieve a list of the files
  const folder = app.vault.getAbstractFileByPath(settings.path)

  let files
  if (folder instanceof TFolder) { 
    files = folder.children 
  } else {
    const error = 'The folder doesn\'t exist, or it\'s empty!'
    renderError(container, error)
    throw new Error(error)
  }

  // filter the list of files to make sure we're dealing with images only
  const validExtensions = ["jpeg", "jpg", "gif", "png", "webp", "tiff", "tif"]
  const images = files
    .filter(file => { file instanceof TFile && validExtensions.includes(file.extension) })

  // sort the list by name, mtime, or ctime
  const orderedImages = images.sort((a: any, b: any) => {
    const refA = settings.sortby === 'name' ? a['name'].toUpperCase() : a.stat[settings.sortby]
    const refB = settings.sortby === 'name' ? b['name'].toUpperCase() : b.stat[settings.sortby]
    return (refA < refB) ? -1 : (refA > refB) ? 1 : 0
  })

  // re-sort again by ascending or descending order
  let sortedImages = settings.sort === 'asc' ? orderedImages : orderedImages.reverse()

  // return an array of objects
  return sortedImages.map(file => {
    return {
      name: file.name,
      folder: file.parent!.path,
      uri: app.vault.adapter.getResourcePath(file.path)
    }
  })
}


function getSettings(src: string, container: HTMLElement) {
  // parse the settings from the code block
  const settingsSrc: any = parseYaml(src)

  // check for required settings
  if (settingsSrc === undefined) {
    const error = 'Cannot parse YAML!'
    renderError(container, error)
    throw new Error(error)
  }

  if (!settingsSrc.path) {
    const error = 'Please specify a path!'
    renderError(container, error)
    throw new Error(error)
  }

  // store settings, normalize and set sensible defaults
  const settings: {[key: string]: any} = {}

  settings.path = normalizePath(settingsSrc.path)
  settings.radius = settingsSrc.radius ?? 0
  settings.gutter = settingsSrc.gutter ?? 8
  settings.sortby = settingsSrc.sortby ?? 'ctime'
  settings.sort = settingsSrc.sort ?? 'desc'

  // settings for vertical mansory only
  settings.mobile = settingsSrc.mobile ?? 1
  if (Platform.isDesktop) settings.columns = settingsSrc.columns ?? 3
  else settings.columns = settings.mobile

  // settings for horizontal mansory only
  settings.height = settingsSrc.height ?? 260

  return settings
}


function renderError(container: HTMLElement, error: string) {
  // render a custom error and style it
  const wrapper = container.createEl('div')
  wrapper.createEl('p', {text: `(Error) Image Gallery: ${error}`});

  wrapper.style.borderRadius = '4px'
  wrapper.style.padding = '2px 16px'
  wrapper.style.backgroundColor = '#e50914'
  wrapper.style.color = '#fff'
  wrapper.style.fontWeight = 'bolder'
}

