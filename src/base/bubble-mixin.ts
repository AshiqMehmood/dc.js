import {descending, max, min} from 'd3-array';
import {scaleLinear} from 'd3-scale';

import {ColorMixin} from './color-mixin';
import {transition} from '../core/core';
import {events} from '../core/events';
import {Constructor, MinimalRadiusScale, RValueAccessor, SVGGElementSelection} from '../core/types';
import {BaseMixin} from './base-mixin';
import {IBubbleMixinConf} from './i-bubble-mixin-conf';

/**
 * This Mixin provides reusable functionalities for any chart that needs to visualize data using bubbles.
 * @mixin BubbleMixin
 * @mixes ColorMixin
 * @param {Object} Base
 * @returns {BubbleMixin}
 */
// tslint:disable-next-line:variable-name
export function BubbleMixin<TBase extends Constructor<BaseMixin>> (Base: TBase) {
    // @ts-ignore
    return class extends Base {
        protected _conf: IBubbleMixinConf;
        private _maxBubbleRelativeSize: number;
        private _minRadiusWithLabel: number;
        private _sortBubbleSize: boolean;
        private _elasticRadius: boolean;
        private _excludeElasticZero: boolean;
        protected BUBBLE_NODE_CLASS: string;
        protected BUBBLE_CLASS: string;
        protected MIN_RADIUS: number;
        private _r: MinimalRadiusScale;
        private _rValueAccessor: RValueAccessor;

        constructor (...args: any[]) {
            super();

            this._maxBubbleRelativeSize = 0.3;
            this._minRadiusWithLabel = 10;
            this._sortBubbleSize = false;
            this._elasticRadius = false;
            this._excludeElasticZero = true;

            // These cane be used by derived classes as well, so member status
            this.BUBBLE_NODE_CLASS = 'node';
            this.BUBBLE_CLASS = 'bubble';
            this.MIN_RADIUS = 10;

            this.renderLabel(true);

            this.data(group => {
                const data = group.all();
                if (this._sortBubbleSize) {
                    // sort descending so smaller bubbles are on top
                    const radiusAccessor = this.radiusValueAccessor();
                    data.sort((a, b) => descending(radiusAccessor(a), radiusAccessor(b)));
                }
                return data;
            });

            this._r = scaleLinear().domain([0, 100]);

            this._rValueAccessor = d => d.r;
        }

        /**
         * Get or set the bubble radius scale. By default the bubble chart uses
         * {@link https://github.com/d3/d3-scale/blob/master/README.md#scaleLinear d3.scaleLinear().domain([0, 100])}
         * as its radius scale.
         * @memberof BubbleMixin
         * @instance
         * @see {@link https://github.com/d3/d3-scale/blob/master/README.md d3.scale}
         * @param {d3.scale} [bubbleRadiusScale=d3.scaleLinear().domain([0, 100])]
         * @returns {d3.scale|BubbleMixin}
         */
        public r (): MinimalRadiusScale;
        public r (bubbleRadiusScale: MinimalRadiusScale): this;
        public r (bubbleRadiusScale?) {
            if (!arguments.length) {
                return this._r;
            }
            this._r = bubbleRadiusScale;
            return this;
        }

        /**
         * Turn on or off the elastic bubble radius feature, or return the value of the flag. If this
         * feature is turned on, then bubble radii will be automatically rescaled to fit the chart better.
         * @memberof BubbleMixin
         * @instance
         * @param {Boolean} [elasticRadius=false]
         * @returns {Boolean|BubbleChart}
         */
        public elasticRadius (): boolean;
        public elasticRadius (elasticRadius: boolean);
        public elasticRadius (elasticRadius?) {
            if (!arguments.length) {
                return this._elasticRadius;
            }
            this._elasticRadius = elasticRadius;
            return this;
        }

        public calculateRadiusDomain (): void {
            if (this._elasticRadius) {
                this.r().domain([this.rMin(), this.rMax()]);
            }
        }

        /**
         * Get or set the radius value accessor function. If set, the radius value accessor function will
         * be used to retrieve a data value for each bubble. The data retrieved then will be mapped using
         * the r scale to the actual bubble radius. This allows you to encode a data dimension using bubble
         * size.
         * @memberof BubbleMixin
         * @instance
         * @param {Function} [radiusValueAccessor]
         * @returns {Function|BubbleMixin}
         */
        public radiusValueAccessor (): RValueAccessor;
        public radiusValueAccessor (radiusValueAccessor: RValueAccessor);
        public radiusValueAccessor (radiusValueAccessor?) {
            if (!arguments.length) {
                return this._rValueAccessor;
            }
            this._rValueAccessor = radiusValueAccessor;
            return this;
        }

        public rMin (): number {
            let values: number[] = this.data().map(this.radiusValueAccessor());
            if (this._excludeElasticZero) {
                values = values.filter(value => value > 0);
            }
            return min(values);
        }

        public rMax ():number {
            return max(this.data(), e => this.radiusValueAccessor()(e));
        }

        public bubbleR (d): number {
            const value = this.radiusValueAccessor()(d);
            let r = this.r()(value);
            if (isNaN(r) || value <= 0) {
                r = 0;
            }
            return r;
        }

        public _labelFunction (d): string|number {
            return this.label()(d);
        }

        public _shouldLabel (d): boolean {
            return (this.bubbleR(d) > this._minRadiusWithLabel);
        }

        public _labelOpacity (d): number {
            return this._shouldLabel(d) ? 1 : 0;
        }

        public _labelPointerEvent (d): string {
            return this._shouldLabel(d) ? 'all' : 'none';
        }

        public _doRenderLabel (bubbleGEnter): void {
            if (this.renderLabel()) {
                let label = bubbleGEnter.select('text');

                if (label.empty()) {
                    label = bubbleGEnter.append('text')
                        .attr('text-anchor', 'middle')
                        .attr('dy', '.3em')
                        .on('click', d => this.onClick(d));
                }

                label
                    .attr('opacity', 0)
                    .attr('pointer-events', d => this._labelPointerEvent(d))
                    .text(d => this._labelFunction(d));
                transition(label, this.transitionDuration(), this.transitionDelay())
                    .attr('opacity', d => this._labelOpacity(d));
            }
        }

        public doUpdateLabels (bubbleGEnter): void {
            if (this.renderLabel()) {
                const labels = bubbleGEnter.select('text')
                    .attr('pointer-events', d => this._labelPointerEvent(d))
                    .text(d => this._labelFunction(d));
                transition(labels, this.transitionDuration(), this.transitionDelay())
                    .attr('opacity', d => this._labelOpacity(d));
            }
        }

        public _titleFunction (d): string|number {
            return this.title()(d);
        }

        public _doRenderTitles (g): void {
            if (this.renderTitle()) {
                const title = g.select('title');

                if (title.empty()) {
                    g.append('title').text(d => this._titleFunction(d));
                }
            }
        }

        public doUpdateTitles (g): void {
            if (this.renderTitle()) {
                g.select('title').text(d => this._titleFunction(d));
            }
        }

        /**
         * Turn on or off the bubble sorting feature, or return the value of the flag. If enabled,
         * bubbles will be sorted by their radius, with smaller bubbles in front.
         * @memberof BubbleChart
         * @instance
         * @param {Boolean} [sortBubbleSize=false]
         * @returns {Boolean|BubbleChart}
         */
        public sortBubbleSize (): boolean;
        public sortBubbleSize (sortBubbleSize: boolean);
        public sortBubbleSize (sortBubbleSize?) {
            if (!arguments.length) {
                return this._sortBubbleSize;
            }
            this._sortBubbleSize = sortBubbleSize;
            return this;
        }

        /**
         * Get or set the minimum radius. This will be used to initialize the radius scale's range.
         * @memberof BubbleMixin
         * @instance
         * @param {Number} [radius=10]
         * @returns {Number|BubbleMixin}
         */
        public minRadius (): number;
        public minRadius (radius: number);
        public minRadius (radius?) {
            if (!arguments.length) {
                return this.MIN_RADIUS;
            }
            this.MIN_RADIUS = radius;
            return this;
        }

        /**
         * Get or set the minimum radius for label rendering. If a bubble's radius is less than this value
         * then no label will be rendered.
         * @memberof BubbleMixin
         * @instance
         * @param {Number} [radius=10]
         * @returns {Number|BubbleMixin}
         */
        public minRadiusWithLabel (): number;
        public minRadiusWithLabel (radius: number);
        public minRadiusWithLabel (radius?) {
            if (!arguments.length) {
                return this._minRadiusWithLabel;
            }
            this._minRadiusWithLabel = radius;
            return this;
        }

        /**
         * Get or set the maximum relative size of a bubble to the length of x axis. This value is useful
         * when the difference in radius between bubbles is too great.
         * @memberof BubbleMixin
         * @instance
         * @param {Number} [relativeSize=0.3]
         * @returns {Number|BubbleMixin}
         */
        public maxBubbleRelativeSize (): number;
        public maxBubbleRelativeSize (relativeSize: number);
        public maxBubbleRelativeSize (relativeSize?) {
            if (!arguments.length) {
                return this._maxBubbleRelativeSize;
            }
            this._maxBubbleRelativeSize = relativeSize;
            return this;
        }

        /**
         * Should the chart exclude zero when calculating elastic bubble radius?
         * @memberof BubbleMixin
         * @instance
         * @param  {Boolean} [excludeZero=true]
         * @returns {Boolean|BubbleMixin}
         */
        public excludeElasticZero (): boolean;
        public excludeElasticZero (excludeZero: boolean);
        public excludeElasticZero (excludeZero?) {
            if (!arguments.length) {
                return this._excludeElasticZero;
            }
            this._excludeElasticZero = excludeZero;
            return this;
        }

        public fadeDeselectedArea (selection: SVGGElementSelection): void {
            if (this.hasFilter()) {
                const chart = this;
                this.selectAll(`g.${chart.BUBBLE_NODE_CLASS}`).each(function (d) {
                    if (chart.isSelectedNode(d)) {
                        chart.highlightSelected(this);
                    } else {
                        chart.fadeDeselected(this);
                    }
                });
            } else {
                const chart = this;
                this.selectAll(`g.${chart.BUBBLE_NODE_CLASS}`).each(function () {
                    chart.resetHighlight(this);
                });
            }
        }

        public isSelectedNode (d: any) {
            return this.hasFilter(d.key);
        }

        public onClick (d: any) {
            const filter = d.key;
            events.trigger(() => {
                this.filter(filter);
                this.redrawGroup();
            });
        }
    };
}
