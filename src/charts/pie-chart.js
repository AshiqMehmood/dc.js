import * as d3 from 'd3';
import {CapMixin} from '../base/cap-mixin';
import {ColorMixin} from '../base/color-mixin';
import {BaseMixin} from '../base/base-mixin';
import {transition} from '../core/core';

const DEFAULT_MIN_ANGLE_FOR_LABEL = 0.5;

function _tweenPie (b, chart) {
    b.innerRadius = chart._innerRadius;
    let current = this._current;
    if (chart._isOffCanvas(current)) {
        current = {startAngle: 0, endAngle: 0};
    } else {
        // only interpolate startAngle & endAngle, not the whole data object
        current = {startAngle: current.startAngle, endAngle: current.endAngle};
    }
    const i = d3.interpolate(current, b);
    this._current = i(0);
    return t => chart._safeArc(i(t), 0, chart._buildArcs());
}

/**
 * The pie chart implementation is usually used to visualize a small categorical distribution.  The pie
 * chart uses keyAccessor to determine the slices, and valueAccessor to calculate the size of each
 * slice relative to the sum of all values. Slices are ordered by {@link dc.baseMixin#ordering ordering}
 * which defaults to sorting by key.
 *
 * Examples:
 * - {@link http://dc-js.github.com/dc.js/ Nasdaq 100 Index}
 * @class pieChart
 * @memberof dc
 * @mixes dc.capMixin
 * @mixes dc.colorMixin
 * @mixes dc.baseMixin
 * @example
 * // create a pie chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.pieChart('#chart-container1');
 * // create a pie chart under #chart-container2 element using chart group A
 * var chart2 = dc.pieChart('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/d3/d3-selection/blob/master/README.md#select d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {dc.pieChart}
 */
class PieChart extends CapMixin(ColorMixin(BaseMixin)) {
    constructor (parent, chartGroup) {
        super();

        this._sliceCssClass = 'pie-slice';
        this._labelCssClass = 'pie-label';
        this._sliceGroupCssClass = 'pie-slice-group';
        this._labelGroupCssClass = 'pie-label-group';
        this._emptyCssClass = 'empty-chart';
        this._emptyTitle = 'empty';

        this._radius = undefined;
        this._givenRadius = undefined; // specified radius, if any
        this._innerRadius = 0;
        this._externalRadiusPadding = 0;


        this._g = undefined;
        this._cx = undefined;
        this._cy = undefined;
        this._minAngleForLabel = DEFAULT_MIN_ANGLE_FOR_LABEL;
        this._externalLabelRadius = undefined;
        this._drawPaths = false;

        this.colorAccessor(d => this.cappedKeyAccessor(d));

        this.title(d => this.cappedKeyAccessor(d) + ': ' + this.cappedValueAccessor(d));

        this.label(d => this.cappedKeyAccessor(d));
        this.renderLabel(true);

        this.transitionDuration(350);
        this.transitionDelay(0);

        this.anchor(parent, chartGroup);
    }

    /**
     * Get or set the maximum number of slices the pie chart will generate. The top slices are determined by
     * value from high to low. Other slices exeeding the cap will be rolled up into one single *Others* slice.
     * @method slicesCap
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cap]
     * @returns {Number|dc.pieChart}
     */
    slicesCap (cap) {
        return this.cap(cap)
    }

    _doRender () {
        this.resetSvg();

        this._g = this.svg()
            .append('g')
            .attr('transform', 'translate(' + this.cx() + ',' + this.cy() + ')');

        this._g.append('g').attr('class', this._sliceGroupCssClass);
        this._g.append('g').attr('class', this._labelGroupCssClass);

        this._drawChart();

        return this;
    }

    _drawChart () {
        // set radius from chart size if none given, or if given radius is too large
        const maxRadius = d3.min([this.width(), this.height()]) / 2;
        this._radius = this._givenRadius && this._givenRadius < maxRadius ? this._givenRadius : maxRadius;

        const arc = this._buildArcs();

        const pie = this._pieLayout();
        let pieData;
        // if we have data...
        if (d3.sum(this.data(), d => this.cappedValueAccessor(d))) {
            pieData = pie(this.data());
            this._g.classed(this._emptyCssClass, false);
        } else {
            // otherwise we'd be getting NaNs, so override
            // note: abuse others for its ignoring the value accessor
            pieData = pie([{key: this._emptyTitle, value: 1, others: [this._emptyTitle]}]);
            this._g.classed(this._emptyCssClass, true);
        }

        if (this._g) {
            const slices = this._g.select('g.' + this._sliceGroupCssClass)
                .selectAll('g.' + this._sliceCssClass)
                .data(pieData);

            const labels = this._g.select('g.' + this._labelGroupCssClass)
                .selectAll('text.' + this._labelCssClass)
                .data(pieData);

            this._removeElements(slices, labels);

            this._createElements(slices, labels, arc, pieData);

            this._updateElements(pieData, arc);

            this._highlightFilter();

            transition(this._g, this.transitionDuration(), this.transitionDelay())
                .attr('transform', 'translate(' + this.cx() + ',' + this.cy() + ')');
        }
    }

    _createElements (slices, labels, arc, pieData) {
        const slicesEnter = this._createSliceNodes(slices);

        this._createSlicePath(slicesEnter, arc);

        this._createTitles(slicesEnter);

        this._createLabels(labels, pieData, arc);
    }

    _createSliceNodes (slices) {
        return slices
            .enter()
            .append('g')
            .attr('class', (d, i) => this._sliceCssClass + ' _' + i);
    }

    _createSlicePath (slicesEnter, arc) {
        const slicePath = slicesEnter.append('path')
            .attr('fill', (d, i) => this._fill(d, i))
            .on('click', (d, i) => this._onClick(d, i))
            .attr('d', (d, i) => this._safeArc(d, i, arc));

        const tranNodes = transition(slicePath, this.transitionDuration(), this.transitionDelay());
        if (tranNodes.attrTween) {
            const chart = this;
            tranNodes.attrTween('d', function (d) {
                return _tweenPie.call(this, d, chart);
            });
        }
    }

    _createTitles (slicesEnter) {
        if (this.renderTitle()) {
            slicesEnter.append('title').text(d => this.title()(d.data));
        }
    }

    _applyLabelText (labels) {
        labels
            .text(d => {
                const data = d.data;
                if ((this._sliceHasNoData(data) || this._sliceTooSmall(d)) && !this._isSelectedSlice(d)) {
                    return '';
                }
                return this.label()(d.data);
            });
    }

    _positionLabels (labels, arc) {
        this._applyLabelText(labels);
        transition(labels, this.transitionDuration(), this.transitionDelay())
            .attr('transform', d => this._labelPosition(d, arc))
            .attr('text-anchor', 'middle');
    }

    _highlightSlice (i, whether) {
        this.select('g.pie-slice._' + i)
            .classed('highlight', whether);
    }

    _createLabels (labels, pieData, arc) {
        if (this.renderLabel()) {
            const labelsEnter = labels
                .enter()
                .append('text')
                .attr('class', (d, i) => {
                    let classes = this._sliceCssClass + ' ' + this._labelCssClass + ' _' + i;
                    if (this._externalLabelRadius) {
                        classes += ' external';
                    }
                    return classes;
                })
                .on('click', (d, i) => this._onClick(d, i))
                .on('mouseover', (d, i) => {
                    this._highlightSlice(i, true);
                })
                .on('mouseout', (d, i) => {
                    this._highlightSlice(i, false);
                });
            this._positionLabels(labelsEnter, arc);
            if (this._externalLabelRadius && this._drawPaths) {
                this._updateLabelPaths(pieData, arc);
            }
        }
    }

    _updateLabelPaths (pieData, arc) {
        let polyline = this._g.selectAll('polyline.' + this._sliceCssClass)
            .data(pieData);

        polyline.exit().remove();

        polyline = polyline
            .enter()
            .append('polyline')
            .attr('class', (d, i) => 'pie-path _' + i + ' ' + this._sliceCssClass)
            .on('click', (d, i) => this._onClick(d, i))
            .on('mouseover', (d, i) => {
                this._highlightSlice(i, true);
            })
            .on('mouseout', (d, i) => {
                this._highlightSlice(i, false);
            })
            .merge(polyline);

        const arc2 = d3.arc()
            .outerRadius(this._radius - this._externalRadiusPadding + this._externalLabelRadius)
            .innerRadius(this._radius - this._externalRadiusPadding);
        const tranNodes = transition(polyline, this.transitionDuration(), this.transitionDelay());
        // this is one rare case where d3.selection differs from d3.transition
        if (tranNodes.attrTween) {
            tranNodes
                .attrTween('points', function (d) {
                    let current = this._current || d;
                    current = {startAngle: current.startAngle, endAngle: current.endAngle};
                    const interpolate = d3.interpolate(current, d);
                    this._current = interpolate(0);
                    return t => {
                        const d2 = interpolate(t);
                        return [arc.centroid(d2), arc2.centroid(d2)];
                    };
                });
        } else {
            tranNodes.attr('points', d => [arc.centroid(d), arc2.centroid(d)]);
        }
        tranNodes.style('visibility', d => d.endAngle - d.startAngle < 0.0001 ? 'hidden' : 'visible');

    }

    _updateElements (pieData, arc) {
        this._updateSlicePaths(pieData, arc);
        this._updateLabels(pieData, arc);
        this._updateTitles(pieData);
    }

    _updateSlicePaths (pieData, arc) {
        const slicePaths = this._g.selectAll('g.' + this._sliceCssClass)
            .data(pieData)
            .select('path')
            .attr('d', (d, i) => this._safeArc(d, i, arc));
        const tranNodes = transition(slicePaths, this.transitionDuration(), this.transitionDelay());
        if (tranNodes.attrTween) {
            const chart = this;
            tranNodes.attrTween('d', function (d) {
                return _tweenPie.call(this, d, chart);
            });
        }
        tranNodes.attr('fill', (d, i) => this._fill(d, i));
    }

    _updateLabels (pieData, arc) {
        if (this.renderLabel()) {
            const labels = this._g.selectAll('text.' + this._labelCssClass)
                .data(pieData);
            this._positionLabels(labels, arc);
            if (this._externalLabelRadius && this._drawPaths) {
                this._updateLabelPaths(pieData, arc);
            }
        }
    }

    _updateTitles (pieData) {
        if (this.renderTitle()) {
            this._g.selectAll('g.' + this._sliceCssClass)
                .data(pieData)
                .select('title')
                .text(d => this.title()(d.data));
        }
    }

    _removeElements (slices, labels) {
        slices.exit().remove();
        labels.exit().remove();
    }

    _highlightFilter () {
        const chart = this;
        if (this.hasFilter()) {
            this.selectAll('g.' + this._sliceCssClass).each(function (d) {
                if (chart._isSelectedSlice(d)) {
                    chart.highlightSelected(this);
                } else {
                    chart.fadeDeselected(this);
                }
            });
        } else {
            this.selectAll('g.' + this._sliceCssClass).each(function () {
                chart.resetHighlight(this);
            });
        }
    }

    /**
     * Get or set the external radius padding of the pie chart. This will force the radius of the
     * pie chart to become smaller or larger depending on the value.
     * @method externalRadiusPadding
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [externalRadiusPadding=0]
     * @returns {Number|dc.pieChart}
     */
    externalRadiusPadding (externalRadiusPadding) {
        if (!arguments.length) {
            return this._externalRadiusPadding;
        }
        this._externalRadiusPadding = externalRadiusPadding;
        return this;
    }

    /**
     * Get or set the inner radius of the pie chart. If the inner radius is greater than 0px then the
     * pie chart will be rendered as a doughnut chart.
     * @method innerRadius
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [innerRadius=0]
     * @returns {Number|dc.pieChart}
     */
    innerRadius (innerRadius) {
        if (!arguments.length) {
            return this._innerRadius;
        }
        this._innerRadius = innerRadius;
        return this;
    }

    /**
     * Get or set the outer radius. If the radius is not set, it will be half of the minimum of the
     * chart width and height.
     * @method radius
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [radius]
     * @returns {Number|dc.pieChart}
     */
    radius (radius) {
        if (!arguments.length) {
            return this._givenRadius;
        }
        this._givenRadius = radius;
        return this;
    }

    /**
     * Get or set center x coordinate position. Default is center of svg.
     * @method cx
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cx]
     * @returns {Number|dc.pieChart}
     */
    cx (cx) {
        if (!arguments.length) {
            return (this._cx || this.width() / 2);
        }
        this._cx = cx;
        return this;
    }

    /**
     * Get or set center y coordinate position. Default is center of svg.
     * @method cy
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cy]
     * @returns {Number|dc.pieChart}
     */
    cy (cy) {
        if (!arguments.length) {
            return (this._cy || this.height() / 2);
        }
        this._cy = cy;
        return this;
    }

    _buildArcs () {
        return d3.arc()
            .outerRadius(this._radius - this._externalRadiusPadding)
            .innerRadius(this._innerRadius);
    }

    _isSelectedSlice (d) {
        return this.hasFilter(this.cappedKeyAccessor(d.data));
    }

    _doRedraw () {
        this._drawChart();
        return this;
    }

    /**
     * Get or set the minimal slice angle for label rendering. Any slice with a smaller angle will not
     * display a slice label.
     * @method minAngleForLabel
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [minAngleForLabel=0.5]
     * @returns {Number|dc.pieChart}
     */
    minAngleForLabel (minAngleForLabel) {
        if (!arguments.length) {
            return this._minAngleForLabel;
        }
        this._minAngleForLabel = minAngleForLabel;
        return this;
    }

    _pieLayout () {
        return d3.pie().sort(null).value(d => this.cappedValueAccessor(d));
    }

    _sliceTooSmall (d) {
        const angle = (d.endAngle - d.startAngle);
        return isNaN(angle) || angle < this._minAngleForLabel;
    }

    _sliceHasNoData (d) {
        return this.cappedValueAccessor(d) === 0;
    }

    _isOffCanvas (current) {
        return !current || isNaN(current.startAngle) || isNaN(current.endAngle);
    }

    _fill (d, i) {
        return this.getColor(d.data, i);
    }

    _onClick (d, i) {
        if (this._g.attr('class') !== this._emptyCssClass) {
            this.onClick(d.data, i);
        }
    }

    _safeArc (d, i, arc) {
        let path = arc(d, i);
        if (path.indexOf('NaN') >= 0) {
            path = 'M0,0';
        }
        return path;
    }

    /**
     * Title to use for the only slice when there is no data.
     * @method emptyTitle
     * @memberof dc.pieChart
     * @instance
     * @param {String} [title]
     * @returns {String|dc.pieChart}
     */
    emptyTitle (title) {
        if (arguments.length === 0) {
            return this._emptyTitle;
        }
        this._emptyTitle = title;
        return this;
    }

    /**
     * Position slice labels offset from the outer edge of the chart.
     *
     * The argument specifies the extra radius to be added for slice labels.
     * @method externalLabels
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [externalLabelRadius]
     * @returns {Number|dc.pieChart}
     */
    externalLabels (externalLabelRadius) {
        if (arguments.length === 0) {
            return this._externalLabelRadius;
        } else if (externalLabelRadius) {
            this._externalLabelRadius = externalLabelRadius;
        } else {
            this._externalLabelRadius = undefined;
        }

        return this;
    }

    /**
     * Get or set whether to draw lines from pie slices to their labels.
     *
     * @method drawPaths
     * @memberof dc.pieChart
     * @instance
     * @param {Boolean} [drawPaths]
     * @returns {Boolean|dc.pieChart}
     */
    drawPaths (drawPaths) {
        if (arguments.length === 0) {
            return this._drawPaths;
        }
        this._drawPaths = drawPaths;
        return this;
    }

    _labelPosition (d, arc) {
        let centroid;
        if (this._externalLabelRadius) {
            centroid = d3.arc()
                .outerRadius(this._radius - this._externalRadiusPadding + this._externalLabelRadius)
                .innerRadius(this._radius - this._externalRadiusPadding + this._externalLabelRadius)
                .centroid(d);
        } else {
            centroid = arc.centroid(d);
        }
        if (isNaN(centroid[0]) || isNaN(centroid[1])) {
            return 'translate(0,0)';
        } else {
            return 'translate(' + centroid + ')';
        }
    }

    legendables () {
        return this.data().map((d, i) => {
            const legendable = {name: d.key, data: d.value, others: d.others, chart: this};
            legendable.color = this.getColor(d, i);
            return legendable;
        });
    }

    legendHighlight (d) {
        this._highlightSliceFromLegendable(d, true);
    }

    legendReset (d) {
        this._highlightSliceFromLegendable(d, false);
    }

    legendToggle (d) {
        this.onClick({key: d.name, others: d.others});
    }

    _highlightSliceFromLegendable (legendable, highlighted) {
        this.selectAll('g.pie-slice').each(function (d) {
            if (legendable.name === d.data.key) {
                d3.select(this).classed('highlight', highlighted);
            }
        });
    }
}

export const pieChart = (parent, chartGroup) => new PieChart(parent, chartGroup);
