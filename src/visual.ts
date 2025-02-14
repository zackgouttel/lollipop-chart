/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;
import ISelectionId=powerbi.extensibility.ISelectionId;

import { Transition, BaseType, transition, easeLinear } from "d3";
import {
  valueFormatter,
  textMeasurementService,
} from "powerbi-visuals-utils-formattingutils";
import measureSvgTextWidth = textMeasurementService.measureSvgTextWidth;

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager=powerbi.extensibility.ISelectionManager

import { Selection, select, selectAll, selection } from "d3-selection";
import { ScalePoint, scalePoint, ScaleLinear, scaleLinear } from "d3-scale";
import { VData, transformData } from "./transformdata";
import { setStyle } from "./setstyle";

import { VisualSettings } from "./settings";
export class Visual implements IVisual {
  private target: HTMLElement;
  private host: IVisualHost;
  private selectionManager: ISelectionManager;
  private svg: Selection<SVGElement, any, HTMLElement, any>;
  private settings: VisualSettings;
  private scaleX: ScalePoint<string>;
  private scaleY: ScaleLinear<number, number>;
  private transition: Transition<BaseType, unknown, null, undefined>;
  private dim: [number, number];
  private data: VData;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element
    this.host=options.host
    this.selectionManager=this.host.createSelectionManager()

    if (document) {
      this.svg = select(this.target).append("svg");
    }
  }

  public update(options: VisualUpdateOptions) {
    this.settings = Visual.parseSettings(
      options && options.dataViews && options.dataViews[0]
    );
    this.data = transformData(
      options,this.host,
      this.settings.lollipopSettings.defaultColor
    );
    this.dim = [options.viewport.width, options.viewport.height];
    this.svg.attr("width", this.dim[0]).attr("height", this.dim[1]);
    setStyle(this.settings);

    const targetLabelWidth = this.getTextWidth(
      this.formatMeasure(this.data.target, this.data.formatString)
    );

    this.scaleX = scalePoint()
      .domain(Array.from(this.data.items, (d) => d.category))
      .range([
        0,
        this.dim[0] -
          targetLabelWidth -
          this.settings.lollipopSettings.fontSize / 2,
      ])
      .padding(0.5);

    const strokeGap = this.settings.lollipopSettings.lineWidth;

    this.scaleY = scaleLinear()
      .domain([this.data.minValue, this.data.maxValue])
      .range([
        this.dim[1] - this.settings.lollipopSettings.radius - strokeGap,
        0 + this.settings.lollipopSettings.radius + strokeGap,
      ]);
    this.transition = transition().duration(500).ease(easeLinear);

    this.drawTarget();

    this.drawTargetLabel();

    const dps=this.drawDataPoints();

    const cons=this.drawConnectors();

    const catLabels= this.drawCategoryLabels();

    //highlight support
    let isHighlighted=false

    for (let d of this.data.items){
        if(d.highlighted){
            isHighlighted=true
            break
        }
    }
    if (isHighlighted){
        dps.style('stroke-opacity', d=>(d.highlighted)? 1 : 0.5)
        dps.style('fill-opacity', d=>(d.highlighted)? 1 : 0.5)
        catLabels.style('fill-opacity', d=>(d.highlighted)? 1 : 0.5)
        cons.style('stroke-opacity', d=>(d.highlighted)? 1 : 0.5)
    }else if (!this.selectionManager.hasSelection()){
        dps.style('stroke-opacity', 1 )
        dps.style('fill-opacity', 1 )
        catLabels.style('fill-opacity',1)
        cons.style('stroke-opacity',1)

    }
  }

  private formatMeasure(measure: number, fs: string): string {
    let formatter = valueFormatter.create({
      format: fs,
    });
    return formatter.format(measure);
  }

  private getTextWidth(txt: string): number {
    const textProperties = {
      text: txt,
      fontFamily: this.settings.lollipopSettings.fontFamily,
      fontSize: `${this.settings.lollipopSettings.fontSize}pt`,
    };
    return measureSvgTextWidth(textProperties);
  }
  private drawTarget() {
    const targetLine = this.svg
      .selectAll("line.target-line")
      .data([this.data.target]);

    targetLine
      .enter()
      .append("line")
      .classed("target-line", true)
      .attr("x1", 0)
      .attr("y1", this.scaleY(this.data.target))
      .attr("x2", this.scaleX.range()[1])
      .attr("y2", this.scaleY(this.data.target));

    targetLine
      .transition(this.transition)
      .attr("y1", this.scaleY(this.data.target))
      .attr("x2", this.scaleX.range()[1])
      .attr("y2", this.scaleY(this.data.target));
    targetLine.exit().remove();
  }

  private drawTargetLabel() {
    const targetLabel = this.svg
      .selectAll("text.target-label")
      .data([this.data.target]);

    targetLabel
      .enter()
      .append("text")
      .classed("target-label", true)
      .attr(
        "x",
        this.scaleX.range()[1] + this.settings.lollipopSettings.fontSize / 2
      )
      .attr("y", this.scaleY(this.data.target))
      .text(this.formatMeasure(this.data.target, this.data.formatString));

    targetLabel
      .transition(this.transition)
      .attr("y", this.scaleY(this.data.target))
      .attr(
        "x",
        this.scaleX.range()[1] + this.settings.lollipopSettings.fontSize / 2
      )
      .text(this.formatMeasure(this.data.target, this.data.formatString));
    targetLabel.exit().remove();
  }

  private drawDataPoints() {
    const that = this;

    const dataPoints = this.svg
      .selectAll("circle.data-point")
      .data(this.data.items);

    dataPoints
      .enter()
      .append("circle")
      .classed("data-point", true)
      .attr('ix',(d,i)=>i)
      .attr("cx", (d) => this.scaleX(d.category))
      .attr("cy", (d) => this.scaleY(d.value))
      .attr("r", this.settings.lollipopSettings.radius)
      .style("fill", (d) => d.color)
      .on('mouseover.tooltip', (event) => {
        const [x, y] = [
            this.scaleX(event.category),  // Use scaled coordinates from data
            this.scaleY(event.value)
        ];

        this.host.tooltipService.show({
          coordinates: [x, y],
          identities: this.selectionManager.getSelectionIds(),  // Proper identity
          isTouchEvent: false,
          dataItems: [
            {
              displayName: event.category,
              value: this.formatMeasure(event.value, this.data.formatString),
            }],
        })
      }).on('mouseout',(e)=>{
        this.host.tooltipService.hide({
            isTouchEvent:false,
            immediately:true
        })
      }).on('click',function(d){
        const clickedElement = select(this);
        const ix=clickedElement.attr('ix')
        that.selectionManager.select(d.selectionId).then((selected)=>{
            selectAll('.data-point')
                .style('fill-opacity',selected.length>0   ?0.5: 1  )
                .style('stroke-opacity',selected.length>0 ? 0.5:1)
            selectAll('.connector')
                .style('stroke-opacity',selected.length>0 ? 0.5:1)
            selectAll('.category-label')
                .style('fill-opacity',selected.length>0   ?0.5: 1  )
            clickedElement
            .style('fill-opacity', 1)
            .style('stroke-opacity', 1);
            select(`.connector[ix='${ix}']`).
                style('stroke-opacity', 1);
            select(`.category-label[ix='${ix}']`).
                style('fill-opacity', 1);

            

        })
      })
    dataPoints
      .transition(this.transition)
      .attr("cx", (d) => this.scaleX(d.category))
      .attr("cy", (d) => this.scaleY(d.value))
      .attr("r", this.settings.lollipopSettings.radius)
      .style("fill", (d) => d.color);
    dataPoints.exit().remove();

    return dataPoints
  }

  private drawConnectors() {
    const connectors = this.svg
      .selectAll("line.connector")
      .data(this.data.items);

    connectors
      .enter()
      .append("line")
      .classed("connector", true)
      .attr('ix',(d,i)=>i)
      .attr("x1", (d) => this.scaleX(d.category))
      .attr("x2", (d) => this.scaleX(d.category))
      .attr("y1", (d) => this.scaleY(this.data.target))
      .attr("y2", (d) => {
        if (
          Math.abs(this.scaleY(this.data.target) - this.scaleY(d.value)) <=
          this.settings.lollipopSettings.radius
        ) {
          return this.scaleY(this.data.target);
        } else if (this.scaleY(this.data.target) > this.scaleY(d.value)) {
          return this.scaleY(d.value) + this.settings.lollipopSettings.radius;
        } else {
          return this.scaleY(d.value) - this.settings.lollipopSettings.radius;
        }
      });

    connectors
      .transition(this.transition)
      .attr("x1", (d) => this.scaleX(d.category))
      .attr("x2", (d) => this.scaleX(d.category))
      .attr("y1", (d) => this.scaleY(this.data.target))
      .attr("y2", (d) => {
        if (
          Math.abs(this.scaleY(this.data.target) - this.scaleY(d.value)) <=
          this.settings.lollipopSettings.radius
        ) {
          return this.scaleY(this.data.target);
        } else if (this.scaleY(this.data.target) > this.scaleY(d.value)) {
          return this.scaleY(d.value) + this.settings.lollipopSettings.radius;
        } else {
          return this.scaleY(d.value) - this.settings.lollipopSettings.radius;
        }
      });

      return connectors
  }

  private drawCategoryLabels() {
    const categoryLabels = this.svg
      .selectAll("text.category-label")
      .data(this.data.items);

    categoryLabels
      .enter()
      .append("text")
      .classed("category-label", true)
      .attr('ix',(d,i)=>i)
      .attr("x", (d) => this.scaleX(d.category))
      .attr("y", (d) => {
        if (d.value >= this.data.target) {
          return (
            this.scaleY(this.data.target) +
            this.settings.lollipopSettings.fontSize
          );
        } else {
          return (
            this.scaleY(this.data.target) -
            this.settings.lollipopSettings.fontSize
          );
        }
      })
      .text((d) => d.category);

    categoryLabels
      .transition(this.transition)
      .attr("x", (d) => this.scaleX(d.category))
      .attr("y", (d) => {
        if (d.value >= this.data.target) {
          return (
            this.scaleY(this.data.target) +
            this.settings.lollipopSettings.fontSize
          );
        } else {
          return (
            this.scaleY(this.data.target) -
            this.settings.lollipopSettings.fontSize
          );
        }
      })
      .text((d) => d.category);
    categoryLabels.exit().remove();

    return categoryLabels
  }

  private static parseSettings(dataView: DataView): VisualSettings {
    return <VisualSettings>VisualSettings.parse(dataView);
  }

  /**
   * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
   * objects and properties you want to expose to the users in the property pane.
   *
   */
  public enumerateObjectInstances(
    options: EnumerateVisualObjectInstancesOptions
  ): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
    //return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    const objectName: string = options.objectName;
    const objectEnumeration: VisualObjectInstance[] = [];

    switch (objectName) {
      case "lollipopSettings":
        objectEnumeration.push({
          objectName,
          properties: {
            defaultColor: this.settings.lollipopSettings.defaultColor,
          },
          selector: null,
        });
        objectEnumeration.push({
          objectName,
          properties: {
            dataPointColor: this.settings.lollipopSettings.dataPointColor,
          },
          selector: dataViewWildcard.createDataViewWildcardSelector(
            dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals
          ),
          altConstantValueSelector: this.settings.lollipopSettings.defaultColor,
          propertyInstanceKind: {
            dataPointColor: VisualEnumerationInstanceKinds.ConstantOrRule,
          },
        });
        objectEnumeration.push({
          objectName,
          properties: {
            radius: this.settings.lollipopSettings.radius,
            lineWidth: this.settings.lollipopSettings.lineWidth,
            fontSize: this.settings.lollipopSettings.fontSize,
            fontFamily: this.settings.lollipopSettings.fontFamily,
          },
          selector: null,
        });
        break;
    }
    return objectEnumeration;
  }
}
