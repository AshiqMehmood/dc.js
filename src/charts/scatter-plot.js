import * as d3 from 'd3';

import {CoordinateGridMixin} from '../base/coordinate-grid-mixin';
import {optionalTransition, transition} from '../core/core';
import {filters} from '../core/filters';
import {constants} from '../core/constants';
import {events} from '../core/events';

/**
 * A scatter plot chart
 *
 * Examples:
 * - {@link http://dc-js.github.io/dc.js/examples/scatter.html Scatter Chart}
 * - {@link http://dc-js.github.io/dc.js/examples/multi-scatter.html Multi-Scatter Chart}
 * @class scatterPlot
 * @memberof dc
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a scatter plot under #chart-container1 element using the default global chart group
 * var chart1 = dc.scatterPlot('#chart-container1');
 * // create a scatter plot under #chart-container2 element using chart group A
 * var chart2 = dc.scatterPlot('#chart-container2', 'chartGroupA');
 * // create a sub-chart under a composite parent chart
 * var chart3 = dc.scatterPlot(compositeChart);
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/d3/d3-selection/blob/master/README.md#select d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {dc.scatterPlot}
 */
export class ScatterPlot extends CoordinateGridMixin {
    constructor (parent, chartGroup) {
        super();

        this._symbol = d3.symbol();

        this._existenceAccessor = d => d.value;

        const originalKeyAccessor = this.keyAccessor();
        this.keyAccessor(d => originalKeyAccessor(d)[0]);
        this.valueAccessor(d => originalKeyAccessor(d)[1]);
        this.colorAccessor(() => this._groupName);

        this.title(d => {
            // this basically just counteracts the setting of its own key/value accessors
            // see https://github.com/dc-js/dc.js/issues/702
            return this.keyAccessor()(d) + ',' + this.valueAccessor()(d) + ': ' +
                this.existenceAccessor()(d);
        });

        this._highlightedSize = 7;
        this._symbolSize = 5;
        this._excludedSize = 3;
        this._excludedColor = null;
        this._excludedOpacity = 1.0;
        this._emptySize = 0;
        this._emptyOpacity = 0;
        this._nonemptyOpacity = 1;
        this._emptyColor = null;
        this._filtered = [];

        // Use a 2 dimensional brush
        this.brush(d3.brush());

        this._symbol.size((d, i) => this._elementSize(d, i));

        // ES6: do we need this
        this.hiddenSize = this.emptySize;

        this.anchor(parent, chartGroup);
    }

    _elementSize (d, i) {
        if (!this._existenceAccessor(d)) {
            return Math.pow(this._emptySize, 2);
        } else if (this._filtered[i]) {
            return Math.pow(this._symbolSize, 2);
        } else {
            return Math.pow(this._excludedSize, 2);
        }
    }

    _locator (d) {
        return 'translate(' + this.x()(this.keyAccessor()(d)) + ',' +
            this.y()(this.valueAccessor()(d)) + ')';
    }

    filter (filter) {
        if (!arguments.length) {
            return super.filter();
        }

        return super.filter(filters.RangedTwoDimensionalFilter(filter));
    }

    plotData () {
        let symbols = this.chartBodyG().selectAll('path.symbol')
            .data(this.data());

        transition(symbols.exit(), this.transitionDuration(), this.transitionDelay())
            .attr('opacity', 0).remove();

        symbols = symbols
            .enter()
            .append('path')
            .attr('class', 'symbol')
            .attr('opacity', 0)
            .attr('fill', this.getColor)
            .attr('transform', d => this._locator(d))
            .merge(symbols);

        symbols.call(symbol => this._renderTitles(symbol, this.data()));

        symbols.each((d, i) => {
            this._filtered[i] = !this.filter() || this.filter().isFiltered([this.keyAccessor()(d), this.valueAccessor()(d)]);
        });

        transition(symbols, this.transitionDuration(), this.transitionDelay())
            .attr('opacity', (d, i) => {
                if (!this._existenceAccessor(d)) {
                    return this._emptyOpacity;
                } else if (this._filtered[i]) {
                    return this._nonemptyOpacity;
                } else {
                    return this.excludedOpacity();
                }
            })
            .attr('fill', (d, i) => {
                if (this._emptyColor && !this._existenceAccessor(d)) {
                    return this._emptyColor;
                } else if (this.excludedColor() && !this._filtered[i]) {
                    return this.excludedColor();
                } else {
                    return this.getColor(d);
                }
            })
            .attr('transform', d => this._locator(d))
            .attr('d', this._symbol);
    }

    _renderTitles (symbol, d) {
        if (this.renderTitle()) {
            symbol.selectAll('title').remove();
            symbol.append('title').text(d => this.title()(d));
        }
    }

    /**
     * Get or set the existence accessor.  If a point exists, it is drawn with
     * {@link dc.scatterPlot#symbolSize symbolSize} radius and
     * opacity 1; if it does not exist, it is drawn with
     * {@link dc.scatterPlot#emptySize emptySize} radius and opacity 0. By default,
     * the existence accessor checks if the reduced value is truthy.
     * @method existenceAccessor
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link dc.scatterPlot#symbolSize symbolSize}
     * @see {@link dc.scatterPlot#emptySize emptySize}
     * @example
     * // default accessor
     * chart.existenceAccessor(function (d) { return d.value; });
     * @param {Function} [accessor]
     * @returns {Function|dc.scatterPlot}
     */
    existenceAccessor (accessor) {
        if (!arguments.length) {
            return this._existenceAccessor;
        }
        this._existenceAccessor = accessor;
        return this;
    }

    /**
     * Get or set the symbol type used for each point. By default the symbol is a circle (d3.symbolCircle).
     * Type can be a constant or an accessor.
     * @method symbol
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_type symbol.type}
     * @example
     * // Circle type
     * chart.symbol(d3.symbolCircle);
     * // Square type
     * chart.symbol(d3.symbolSquare);
     * @param {Function} [type=d3.symbolCircle]
     * @returns {Function|dc.scatterPlot}
     */
    symbol (type) {
        if (!arguments.length) {
            return this._symbol.type();
        }
        this._symbol.type(type);
        return this;
    }

    /**
     * Get or set the symbol generator. By default `dc.scatterPlot` will use
     * {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol d3.symbol()}
     * to generate symbols. `dc.scatterPlot` will set the
     * {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_size symbol size accessor}
     * on the symbol generator.
     * @method customSymbol
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol d3.symbol}
     * @see {@link https://stackoverflow.com/questions/25332120/create-additional-d3-js-symbols Create additional D3.js symbols}
     * @param {String|Function} [customSymbol=d3.symbol()]
     * @returns {String|Function|dc.scatterPlot}
     */
    customSymbol (customSymbol) {
        if (!arguments.length) {
            return this._symbol;
        }
        this._symbol = customSymbol;
        this._symbol.size((d, i) => this._elementSize(d, i));
        return this;
    }

    /**
     * Set or get radius for symbols.
     * @method symbolSize
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_size d3.symbol.size}
     * @param {Number} [symbolSize=3]
     * @returns {Number|dc.scatterPlot}
     */
    symbolSize (symbolSize) {
        if (!arguments.length) {
            return this._symbolSize;
        }
        this._symbolSize = symbolSize;
        return this;
    }

    /**
     * Set or get radius for highlighted symbols.
     * @method highlightedSize
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_size d3.symbol.size}
     * @param {Number} [highlightedSize=5]
     * @returns {Number|dc.scatterPlot}
     */
    highlightedSize (highlightedSize) {
        if (!arguments.length) {
            return this._highlightedSize;
        }
        this._highlightedSize = highlightedSize;
        return this;
    }

    /**
     * Set or get size for symbols excluded from this chart's filter. If null, no
     * special size is applied for symbols based on their filter status.
     * @method excludedSize
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_size d3.symbol.size}
     * @param {Number} [excludedSize=null]
     * @returns {Number|dc.scatterPlot}
     */
    excludedSize (excludedSize) {
        if (!arguments.length) {
            return this._excludedSize;
        }
        this._excludedSize = excludedSize;
        return this;
    }

    /**
     * Set or get color for symbols excluded from this chart's filter. If null, no
     * special color is applied for symbols based on their filter status.
     * @method excludedColor
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [excludedColor=null]
     * @returns {Number|dc.scatterPlot}
     */
    excludedColor (excludedColor) {
        if (!arguments.length) {
            return this._excludedColor;
        }
        this._excludedColor = excludedColor;
        return this;
    }

    /**
     * Set or get opacity for symbols excluded from this chart's filter.
     * @method excludedOpacity
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [excludedOpacity=1.0]
     * @returns {Number|dc.scatterPlot}
     */
    excludedOpacity (excludedOpacity) {
        if (!arguments.length) {
            return this._excludedOpacity;
        }
        this._excludedOpacity = excludedOpacity;
        return this;
    }

    /**
     * Set or get radius for symbols when the group is empty.
     * @method emptySize
     * @memberof dc.scatterPlot
     * @instance
     * @see {@link https://github.com/d3/d3-shape/blob/master/README.md#symbol_size d3.symbol.size}
     * @param {Number} [emptySize=0]
     * @returns {Number|dc.scatterPlot}
     */
    emptySize (emptySize) {
        if (!arguments.length) {
            return this._emptySize;
        }
        this._emptySize = emptySize;
        return this;
    }

    /**
     * Set or get color for symbols when the group is empty. If null, just use the
     * {@link dc.colorMixin#colors colorMixin.colors} color scale zero value.
     * @name emptyColor
     * @memberof dc.scatterPlot
     * @instance
     * @param {String} [emptyColor=null]
     * @return {String}
     * @return {dc.scatterPlot}/
     */
    emptyColor (emptyColor) {
        if (!arguments.length) {
            return this._emptyColor;
        }
        this._emptyColor = emptyColor;
        return this;
    }

    /**
     * Set or get opacity for symbols when the group is empty.
     * @name emptyOpacity
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [emptyOpacity=0]
     * @return {Number}
     * @return {dc.scatterPlot}
     */
    emptyOpacity (emptyOpacity) {
        if (!arguments.length) {
            return this._emptyOpacity;
        }
        this._emptyOpacity = emptyOpacity;
        return this;
    }

    /**
     * Set or get opacity for symbols when the group is not empty.
     * @name nonemptyOpacity
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [nonemptyOpacity=1]
     * @return {Number}
     * @return {dc.scatterPlot}
     */
    nonemptyOpacity (nonemptyOpacity) {
        if (!arguments.length) {
            return this._emptyOpacity;
        }
        this._nonemptyOpacity = nonemptyOpacity;
        return this;
    }

    legendables () {
        return [{chart: this, name: this._groupName, color: this.getColor()}];
    }

    legendHighlight (d) {
        this._resizeSymbolsWhere(symbol => symbol.attr('fill') === d.color, this._highlightedSize);
        this.chartBodyG().selectAll('.chart-body path.symbol').filter(function () {
            return d3.select(this).attr('fill') !== d.color;
        }).classed('fadeout', true);
    }

    legendReset (d) {
        this._resizeSymbolsWhere(symbol => symbol.attr('fill') === d.color, this._symbolSize);
        this.chartBodyG().selectAll('.chart-body path.symbol').filter(function () {
            return d3.select(this).attr('fill') !== d.color;
        }).classed('fadeout', false);
    }

    _resizeSymbolsWhere (condition, size) {
        const symbols = this.chartBodyG().selectAll('.chart-body path.symbol').filter(function () {
            return condition(d3.select(this));
        });
        const oldSize = this._symbol.size();
        this._symbol.size(Math.pow(size, 2));
        transition(symbols, this.transitionDuration(), this.transitionDelay()).attr('d', this._symbol);
        this._symbol.size(oldSize);
    }
    createBrushHandlePaths () {
        // no handle paths for poly-brushes
    }

    extendBrush (brushSelection) {
        if (this.round()) {
            brushSelection[0] = brushSelection[0].map(this.round());
            brushSelection[1] = brushSelection[1].map(this.round());
        }
        return brushSelection;
    }

    brushIsEmpty (brushSelection) {
        return !brushSelection || brushSelection[0][0] >= brushSelection[1][0] || brushSelection[0][1] >= brushSelection[1][1];
    }

    _brushing () {
        // Avoids infinite recursion (mutual recursion between range and focus operations)
        // Source Event will be null when brush.move is called programmatically (see below as well).
        if (!d3.event.sourceEvent) {
            return;
        }

        // Ignore event if recursive event - i.e. not directly generated by user action (like mouse/touch etc.)
        // In this case we are more worried about this handler causing brush move programmatically which will
        // cause this handler to be invoked again with a new d3.event (and current event set as sourceEvent)
        // This check avoids recursive calls
        if (d3.event.sourceEvent.type && ['start', 'brush', 'end'].indexOf(d3.event.sourceEvent.type) !== -1) {
            return;
        }

        let brushSelection = d3.event.selection;

        // Testing with pixels is more reliable
        let brushIsEmpty = this.brushIsEmpty(brushSelection);

        if (brushSelection) {
            brushSelection = brushSelection.map(point => point.map((coord, i) => {
                const scale = i === 0 ? this.x() : this.y();
                return scale.invert(coord);
            }));

            brushSelection = this.extendBrush(brushSelection);

            // The rounding process might have made brushSelection empty, so we need to recheck
            brushIsEmpty = brushIsEmpty && this.brushIsEmpty(brushSelection);
        }

        this.redrawBrush(brushSelection, false);

        const ranged2DFilter = brushIsEmpty ? null : filters.RangedTwoDimensionalFilter(brushSelection);

        events.trigger(() => {
            this.replaceFilter(ranged2DFilter);
            this.redrawGroup();
        }, constants.EVENT_DELAY);
    }

    redrawBrush (brushSelection, doTransition) {
        // override default x axis brush from parent chart
        this._brush = this.brush();
        this._gBrush = this.gBrush();

        if (this.brushOn() && this._gBrush) {
            if (this.resizing()) {
                this.setBrushExtents(doTransition);
            }

            if (!brushSelection) {
                this._gBrush
                    .call(this._brush.move, brushSelection);

            } else {
                brushSelection = brushSelection.map(point => point.map((coord, i) => {
                    const scale = i === 0 ? this.x() : this.y();
                    return scale(coord);
                }));

                const gBrush =
                    optionalTransition(doTransition, this.transitionDuration(), this.transitionDelay())(this._gBrush);

                gBrush
                    .call(this._brush.move, brushSelection);

            }
        }

        this.fadeDeselectedArea(brushSelection);
    }

    setBrushY (gBrush) {
        gBrush.call(this.brush().y(this.y()));
    }
}

export const scatterPlot = (parent, chartGroup) => new ScatterPlot(parent, chartGroup);
