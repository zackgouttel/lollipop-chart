'use strict'

import {VisualSettings} from "./settings"

export function setStyle(settings:VisualSettings):void{
    const style=document.documentElement.style;

    style.setProperty('--default-color',settings.lollipopSettings.defaultColor)
    style.setProperty('--line-width',`${settings.lollipopSettings.lineWidth}`)
    style.setProperty('--font-family',settings.lollipopSettings.fontFamily)
    style.setProperty('--font-size',`${settings.lollipopSettings.fontSize}pt`)
}