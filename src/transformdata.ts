'use strict'

import powerbi from 'powerbi-visuals-api';
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId=powerbi.extensibility.ISelectionId;
 

export interface VData{
    items:VDataItem[],
    minValue:number,
    maxValue:number,
    target:number,
    formatString:string,
}

export interface VDataItem{
    category:string,
    value:number,
    color:string,
    selectionId:ISelectionId,
    highlighted:boolean

}

export function transformData(options:VisualUpdateOptions,host:IVisualHost,defaultColor:string): VData {
    let data:VData 
    try {
        const dv = options.dataViews[0].categorical;
        const minValue = Math.min(<number>dv.values[0].minLocal,<number>dv.values[1].minLocal);
        const maxValue= Math.max(<number>dv.values[0].maxLocal,<number>dv.values[1].maxLocal);
        const target = <number>dv.values[1].values[0];
        const items:VDataItem[] = []
        let color: string;
        for (let i=0;i<dv.categories[0].values.length;i++){
            try {
                color=dv.categories[0].objects[i].lollipopSettings.dataPointColor['solid'].color
            } catch (error) {
                color=defaultColor
            }
            const selectionId=host.createSelectionIdBuilder().withCategory(dv.categories[0],i).createSelectionId()
            const highlighted=!!(dv.values[0].highlights && dv.values[0].highlights[i])
            items.push({
                category:<string>dv.categories[0].values[i],
                value:<number>dv.values[0].values[i],
                color:color,
                selectionId:selectionId,
                highlighted:highlighted
            })
        }
        data = {
            items:items,
            minValue:minValue,
            maxValue:maxValue,
            target:target,
            formatString:dv.values[0].source.format || '',
        }
    } catch (error) {
        data = {
            items:[],
            minValue:0,
            maxValue:0,
            target:0,
            formatString: ''
        }
    }
    return data;
}