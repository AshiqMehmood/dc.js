/* global appendChartID, loadColorFixture, loadColorFixture2, loadIrisFixture */
describe('dc.heatmap', () => {
    let id, data, dimension, group, chart, chartHeight, chartWidth;

    beforeEach(() => {
        data = crossfilter(loadColorFixture());
        dimension = data.dimension(d => [+d.colData, +d.rowData]);
        group = dimension.group().reduceSum(d => +d.colorData);

        chartHeight = 210;
        chartWidth = 210;

        id = 'heatmap-chart';
        appendChartID(id);
        chart = new dc.HeatMap(`#${id}`);

        chart
            .dimension(dimension)
            .group(group)
            .keyAccessor(d => d.key[0])
            .valueAccessor(d => d.key[1])
            .colorAccessor(d => d.value)
            .colors(['#000001', '#000002', '#000003', '#000004'])
            .title(d => `${d.key}: ${d.value}`)
            .height(chartHeight)
            .width(chartWidth)
            .transitionDuration(0)
            .margins({top: 5, right: 5, bottom: 5, left: 5})
            .calculateColorDomain();

    });

    describe('rendering the heatmap', () => {
        beforeEach(() => {
            chart.render();
        });

        it('should create svg', () => {
            expect(chart.svg()).not.toBeNull();
        });

        it('should transform the graph position using the graph margins', () => {
            expect(chart.select('g.heatmap').attr('transform')).toMatchTranslate(5, 5);
        });

        it('should position the heatboxes in a matrix', () => {
            const heatBoxes = chart.selectAll('rect.heat-box');

            expect(+heatBoxes.nodes()[0].getAttribute('x')).toEqual(0);
            expect(+heatBoxes.nodes()[0].getAttribute('y')).toEqual(100);

            expect(+heatBoxes.nodes()[1].getAttribute('x')).toEqual(0);
            expect(+heatBoxes.nodes()[1].getAttribute('y')).toEqual(0);

            expect(+heatBoxes.nodes()[2].getAttribute('x')).toEqual(100);
            expect(+heatBoxes.nodes()[2].getAttribute('y')).toEqual(100);

            expect(+heatBoxes.nodes()[3].getAttribute('x')).toEqual(100);
            expect(+heatBoxes.nodes()[3].getAttribute('y')).toEqual(0);
        });

        it('should color heatboxes using the provided color option', () => {
            const heatBoxes = chart.selectAll('rect.heat-box');

            expect(heatBoxes.nodes()[0].getAttribute('fill')).toMatch(/#000001/i);
            expect(heatBoxes.nodes()[1].getAttribute('fill')).toMatch(/#000002/i);
            expect(heatBoxes.nodes()[2].getAttribute('fill')).toMatch(/#000003/i);
            expect(heatBoxes.nodes()[3].getAttribute('fill')).toMatch(/#000004/i);
        });

        it('should size heatboxes based on the size of the matrix', () => {
            chart.selectAll('rect.heat-box').each(function () {
                expect(+this.getAttribute('height')).toEqual(100);
                expect(+this.getAttribute('width')).toEqual(100);
            });
        });

        it('should position the y-axis labels with their associated rows', () => {
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(+yaxisTexts.nodes()[0].getAttribute('y')).toEqual(150);
            expect(+yaxisTexts.nodes()[0].getAttribute('x')).toEqual(0);
            expect(+yaxisTexts.nodes()[1].getAttribute('y')).toEqual(50);
            expect(+yaxisTexts.nodes()[1].getAttribute('x')).toEqual(0);
        });

        it('should have labels on the y-axis corresponding to the row values', () => {
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(yaxisTexts.nodes()[0].textContent).toEqual('1');
            expect(yaxisTexts.nodes()[1].textContent).toEqual('2');
        });

        it('should position the x-axis labels with their associated columns', () => {
            const xaxisTexts = chart.selectAll('.cols.axis text');
            expect(+xaxisTexts.nodes()[0].getAttribute('y')).toEqual(200);
            expect(+xaxisTexts.nodes()[0].getAttribute('x')).toEqual(50);
            expect(+xaxisTexts.nodes()[1].getAttribute('y')).toEqual(200);
            expect(+xaxisTexts.nodes()[1].getAttribute('x')).toEqual(150);
        });

        it('should have labels on the x-axis corresponding to the row values', () => {
            const xaxisTexts = chart.selectAll('.cols.axis text');
            expect(xaxisTexts.nodes()[0].textContent).toEqual('1');
            expect(xaxisTexts.nodes()[1].textContent).toEqual('2');
        });

        it('should have tooltips (titles)', () => {
            const titles = chart.selectAll('title');
            expect(titles.nodes().length).toEqual(4);
            expect(titles.nodes()[0].textContent).toEqual('1,1: 2');
            expect(titles.nodes()[2].textContent).toEqual('2,1: 6');
        });

        describe('with custom labels', () => {
            beforeEach(() => {
                chart.colsLabel(x => `col ${x}`)
                    .rowsLabel(x => `row ${x}`)
                    .redraw();
            });
            it('should display the custom labels on the x axis', () => {
                const xaxisTexts = chart.selectAll('.cols.axis text');
                expect(xaxisTexts.nodes()[0].textContent).toEqual('col 1');
                expect(xaxisTexts.nodes()[1].textContent).toEqual('col 2');
            });
            it('should display the custom labels on the y axis', () => {
                const yaxisTexts = chart.selectAll('.rows.axis text');
                expect(yaxisTexts.nodes()[0].textContent).toEqual('row 1');
                expect(yaxisTexts.nodes()[1].textContent).toEqual('row 2');
            });
        });

        describe('box radius', () => {
            it('should default the x', () => {
                chart.select('rect.heat-box').each(function () {
                    expect(this.getAttribute('rx')).toBe('6.75');
                });
            });

            it('should default the y', () => {
                chart.select('rect.heat-box').each(function () {
                    expect(this.getAttribute('ry')).toBe('6.75');
                });
            });

            it('should set the radius to an overridden x', () => {
                chart.xBorderRadius(7);
                chart.render();

                chart.select('rect.heat-box').each(function () {
                    expect(this.getAttribute('rx')).toBe('7');
                });
            });

            it('should set the radius to an overridden y', () => {
                chart.yBorderRadius(7);
                chart.render();

                chart.select('rect.heat-box').each(function () {
                    expect(this.getAttribute('ry')).toBe('7');
                });
            });
        });

    });

    describe('override scale domains', () => {
        beforeEach(() => {
            chart.rows([1]);
            chart.cols([1]);
            chart.render();
        });

        it('should only have 1 row on the y axis', () => {
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(yaxisTexts.nodes().length).toEqual(1);
            expect(yaxisTexts.nodes()[0].textContent).toEqual('1');
        });

        it('should only have 1 col on the x axis', () => {
            const xaxisTexts = chart.selectAll('.cols.axis text');
            expect(xaxisTexts.nodes().length).toEqual(1);
            expect(xaxisTexts.nodes()[0].textContent).toEqual('1');
        });

        it('should reset the rows to using the chart data on the y axis', () => {
            chart.rows(null);
            chart.redraw();
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(yaxisTexts.nodes().length).toEqual(2);
            expect(yaxisTexts.nodes()[0].textContent).toEqual('1');
            expect(yaxisTexts.nodes()[1].textContent).toEqual('2');
        });

        it('should reset the cols to using the chart data on the y axis', () => {
            chart.cols(null);
            chart.redraw();
            const xaxisTexts = chart.selectAll('.cols.axis text');
            expect(xaxisTexts.nodes().length).toEqual(2);
            expect(xaxisTexts.nodes()[0].textContent).toEqual('1');
            expect(xaxisTexts.nodes()[1].textContent).toEqual('2');
        });
    });

    describe('use a custom ordering on x and y axes', () => {
        beforeEach(() => {
            chart.rowOrdering(d3.descending);
            chart.colOrdering(d3.descending);
            chart.render();
        });

        it('should have descending rows', () => {
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(yaxisTexts.nodes()[0].textContent).toEqual('2');
            expect(yaxisTexts.nodes()[1].textContent).toEqual('1');
        });

        it('should have descending cols', () => {
            const yaxisTexts = chart.selectAll('.rows.axis text');
            expect(yaxisTexts.nodes()[0].textContent).toEqual('2');
            expect(yaxisTexts.nodes()[1].textContent).toEqual('1');
        });
    });

    describe('change crossfilter', () => {
        let data2, dimension2, group2, originalDomain;

        const reduceDimensionValues = function (dmsn) {
            return dmsn.top(Infinity).reduce((p, d) => {
                p.cols.add(d.colData);
                p.rows.add(d.rowData);
                return p;
            }, {cols: d3.set(), rows: d3.set()});
        };

        beforeEach(() => {
            data2 = crossfilter(loadColorFixture2());
            dimension2 = data2.dimension(d => [+d.colData, +d.rowData]);
            group2 = dimension2.group().reduceSum(d => +d.colorData);
            originalDomain = reduceDimensionValues(dimension);

            chart.dimension(dimension2).group(group2);
            chart.render();
            chart.dimension(dimension).group(group);
            chart.redraw();
        });

        it('should have the correct number of columns', () => {
            chart.selectAll('.box-group').each(d => {
                expect(originalDomain.cols.has(d.key[0])).toBeTruthy();
            });

            chart.selectAll('.cols.axis text').each(d => {
                expect(originalDomain.cols.has(d)).toBeTruthy();
            });
        });

        it('should have the correct number of rows', () => {
            chart.selectAll('.box-group').each(d => {
                expect(originalDomain.rows.has(d.key[1])).toBeTruthy();
            });

            chart.selectAll('.rows.axis text').each(d => {
                expect(originalDomain.rows.has(d)).toBeTruthy();
            });
        });
    });

    describe('indirect filtering', () => {
        let dimension2;
        beforeEach(() => {
            dimension2 = data.dimension(d => +d.colorData);

            chart.dimension(dimension).group(group);
            chart.render();
            dimension2.filter('3');
            chart.redraw();
        });

        it('should update the title of the boxes', () => {
            const titles = chart.selectAll('.box-group title');
            const expected = ['1,1: 0', '1,2: 0', '2,1: 6', '2,2: 0'];
            titles.each(function (d) {
                expect(this.textContent).toBe(expected.shift());
            });
        });
    });

    describe('filtering', () => {
        let filterX, filterY;
        let otherDimension;

        beforeEach(() => {
            filterX = Math.ceil(Math.random() * 2);
            filterY = Math.ceil(Math.random() * 2);
            otherDimension = data.dimension(d => +d.colData);
            chart.render();
        });

        function clickCellOnChart (_chart, x, y) {
            const oneCell = _chart.selectAll('.box-group').filter(d => d.key[0] === x && d.key[1] === y);
            oneCell.select('rect').on('click')(oneCell.datum());
            return oneCell;
        }

        it('cells should have the appropriate class', () => {
            clickCellOnChart(chart, filterX, filterY);
            chart.selectAll('.box-group').each(function (d) {
                const cell = d3.select(this);
                if (d.key[0] === filterX && d.key[1] === filterY) {
                    expect(cell.classed('selected')).toBeTruthy();
                    expect(chart.hasFilter(d.key)).toBeTruthy();
                } else {
                    expect(cell.classed('deselected')).toBeTruthy();
                    expect(chart.hasFilter(d.key)).toBeFalsy();
                }
            });
        });

        it('should keep all data points for that cell', () => {
            const otherGroup = otherDimension.group().reduceSum(d => +d.colorData);
            const otherChart = dc.baseMixin().dimension(otherDimension).group(otherGroup);

            otherChart.render();
            const clickedCell = clickCellOnChart(chart, filterX, filterY);
            expect(otherChart.data()[filterX - 1].value).toEqual(clickedCell.datum().value);
        });

        it('should be able to clear filters by filtering with null', () => {
            clickCellOnChart(chart, filterX, filterY);
            expect(otherDimension.top(Infinity).length).toBe(2);
            chart.filter(null);
            expect(otherDimension.top(Infinity).length).toBe(8);
        });
    });

    describe('click events', () => {
        beforeEach(() => {
            chart.render();
        });
        it('should toggle a filter for the clicked box', () => {
            chart.selectAll('.box-group').each(function (d) {
                const cell = d3.select(this).select('rect');
                cell.on('click')(d);
                expect(chart.hasFilter(d.key)).toBeTruthy();
                cell.on('click')(d);
                expect(chart.hasFilter(d.key)).toBeFalsy();
            });
        });
        describe('on axis labels', () => {
            function assertOnlyThisAxisIsFiltered (_chart, axis, value) {
                _chart.selectAll('.box-group').each(d => {
                    if (d.key[axis] === value) {
                        expect(_chart.hasFilter(d.key)).toBeTruthy();
                    } else {
                        expect(_chart.hasFilter(d.key)).toBeFalsy();
                    }
                });
            }

            describe('with nothing previously filtered', () => {
                it('should filter all cells on that axis', () => {
                    chart.selectAll('.cols.axis text').each(function (d) {
                        const axisLabel = d3.select(this);
                        axisLabel.on('click')(d);
                        assertOnlyThisAxisIsFiltered(chart, 0, d);
                        axisLabel.on('click')(d);
                    });
                    chart.selectAll('.rows.axis text').each(function (d) {
                        const axisLabel = d3.select(this);
                        axisLabel.on('click')(d);
                        assertOnlyThisAxisIsFiltered(chart, 1, d);
                        axisLabel.on('click')(d);
                    });
                });
            });
            describe('with one cell on that axis already filtered', () => {
                it('should filter all cells on that axis (and the original cell should remain filtered)', () => {
                    const boxNodes = chart.selectAll('.box-group').nodes();
                    const box = d3.select(boxNodes[Math.floor(Math.random() * boxNodes.length)]);

                    box.select('rect').on('click')(box.datum());

                    expect(chart.hasFilter(box.datum().key)).toBeTruthy();

                    const xVal = box.datum().key[0];

                    const columns = chart.selectAll('.cols.axis text');
                    const column = columns.filter(columnData => columnData === xVal);

                    column.on('click')(column.datum());

                    assertOnlyThisAxisIsFiltered(chart, 0, xVal);

                    column.on('click')(column.datum());
                });
            });
            describe('with all cells on that axis already filtered', () => {
                it('should remove all filters on that axis', () => {
                    const xVal = 1;
                    chart.selectAll('.box-group').each(function (d) {
                        const box = d3.select(this);
                        if (d.key[0] === xVal) {
                            box.select('rect').on('click')(box.datum());
                        }
                    });

                    assertOnlyThisAxisIsFiltered(chart, 0, xVal);

                    const columns = chart.selectAll('.cols.axis text');
                    const column = columns.filter(columnData => columnData === xVal);

                    column.on('click')(column.datum());

                    chart.select('.box-group').each(d => {
                        expect(chart.hasFilter(d.key)).toBeFalsy();
                    });
                });
            });
        });
    });
    describe('iris filtering', () => {
        /* eslint camelcase: 0 */
        // 2-chart version of from http://bl.ocks.org/gordonwoodhull/14c623b95993808d69620563508edba6
        let irisData, bubbleChart, petalDim, petalGroup;
        const fields = {
            sl: 'sepal_length',
            sw: 'sepal_width',
            pl: 'petal_length',
            pw: 'petal_width'
        };
        const keyfuncs = {};

        function duo_key (ab1, ab2) {
            return function (d) {
                return [keyfuncs[ab1](d[fields[ab1]]), keyfuncs[ab2](d[fields[ab2]])];
            };
        }
        beforeEach(() => {
            irisData = loadIrisFixture();

            const species = ['setosa', 'versicolor', 'virginica'];

            irisData.forEach(d => {
                Object.keys(fields).forEach(ab => {
                    d[fields[ab]] = +d[fields[ab]];
                });
            });
            // autogenerate a key function for an extent
            function key_function (extent) {
                const div = extent[1] - extent[0] < 5 ? 2 : 1;
                return function (k) {
                    return Math.floor(k * div) / div;
                };
            }

            const extents = {};
            Object.keys(fields).forEach(ab => {
                extents[ab] = d3.extent(irisData, d => d[fields[ab]]);
                keyfuncs[ab] = key_function(extents[ab]);
            });
            data = crossfilter(irisData);
            function key_part (i) {
                return function (kv) {
                    return kv.key[i];
                };
            }
            function reduce_species (grp) {
                grp.reduce(
                    (p, v) => {
                        p[v.species]++;
                        p.total++;
                        return p;
                    }, (p, v) => {
                        p[v.species]--;
                        p.total--;
                        return p;
                    }, () => {
                        const init = {total: 0};
                        species.forEach(s => { init[s] = 0; });
                        return init;
                    }
                );
            }
            function max_species (d) {
                let max = 0, i = -1;
                species.forEach((s, j) => {
                    if (d.value[s] > max) {
                        max = d.value[s];
                        i = j;
                    }
                });
                return i >= 0 ? species[i] : null;
            }
            function initialize_bubble (bblChart) {
                bblChart
                    .width(400)
                    .height(400)
                    .transitionDuration(0)
                    .x(d3.scaleLinear()).xAxisPadding(0.5)
                    .y(d3.scaleLinear()).yAxisPadding(0.5)
                    .elasticX(true)
                    .elasticY(true)
                    .label(dc.utils.constant(''))
                    .keyAccessor(key_part(0))
                    .valueAccessor(key_part(1))
                    .r(d3.scaleLinear().domain([0,20]).range([4,25]))
                    .radiusValueAccessor(kv => kv.value.total)
                    .colors(d3.scaleOrdinal()
                            .domain(species.concat('none'))
                            .range(['#e41a1c','#377eb8','#4daf4a', '#f8f8f8']))
                    .colorAccessor(d => max_species(d) || 'none');
            }
            function initialize_heatmap (heatMap) {
                heatMap
                    .width(400)
                    .height(400)
                    .xBorderRadius(15).yBorderRadius(15)
                    .keyAccessor(key_part(0))
                    .valueAccessor(key_part(1))
                    .colors(d3.scaleOrdinal()
                            .domain(species.concat('none'))
                            .range(['#e41a1c','#377eb8','#4daf4a', '#f8f8f8']))
                    .colorAccessor(d => max_species(d) || 'none')
                    .renderTitle(true)
                    .title(d => JSON.stringify(d.value, null, 2));
            }

            const bubbleId = 'bubble-chart';
            appendChartID(bubbleId);

            bubbleChart = new dc.BubbleChart(`#${bubbleId}`);
            const sepalDim = data.dimension(duo_key('sl', 'sw')), sepalGroup = sepalDim.group();
            petalDim = data.dimension(duo_key('pl', 'pw')); petalGroup = petalDim.group();

            reduce_species(sepalGroup);
            reduce_species(petalGroup);
            initialize_bubble(bubbleChart.dimension(sepalDim).group(sepalGroup));
            initialize_heatmap(chart.dimension(petalDim).group(petalGroup));
            bubbleChart.render();
            chart.render();
        });
        // return brand-new objects and keys every time
        function clone_group (grp) {
            function clone_kvs (all) {
                return all.map(kv => ({
                    key: kv.key.slice(0),
                    value: Object.assign({}, kv.value)
                }));
            }
            return {
                all: function () {
                    return clone_kvs(grp.all());
                },
                top: function (N) {
                    return clone_kvs(grp.top(N));
                }
            };
        }

        function testRectFillsBubble12 (bblChart) {
            const rects = bblChart.selectAll('rect').nodes();
            expect(d3.select(rects[0]).attr('fill')).toMatch(/#f8f8f8/i);
            expect(d3.select(rects[3]).attr('fill')).toMatch(/#377eb8/i);
            expect(d3.select(rects[4]).attr('fill')).toMatch(/#377eb8/i);
            expect(d3.select(rects[7]).attr('fill')).toMatch(/#4daf4a/i);
            expect(d3.select(rects[8]).attr('fill')).toMatch(/#f8f8f8/i);
            expect(d3.select(rects[10]).attr('fill')).toMatch(/#f8f8f8/i);
            expect(d3.select(rects[11]).attr('fill')).toMatch(/#f8f8f8/i);
            expect(d3.select(rects[12]).attr('fill')).toMatch(/#f8f8f8/i);
        }
        function testRectTitlesBubble12 (bblChart) {
            const titles = bblChart.selectAll('g.box-group title').nodes();
            expect(JSON.parse(d3.select(titles[0]).text()).total).toBe(0);
            expect(JSON.parse(d3.select(titles[2]).text()).total).toBe(0);
            expect(JSON.parse(d3.select(titles[3]).text()).total).toBe(2);
            expect(JSON.parse(d3.select(titles[4]).text()).total).toBe(3);
            expect(JSON.parse(d3.select(titles[5]).text()).total).toBe(0);
            expect(JSON.parse(d3.select(titles[7]).text()).total).toBe(1);
            expect(JSON.parse(d3.select(titles[9]).text()).total).toBe(0);
            expect(JSON.parse(d3.select(titles[10]).text()).total).toBe(0);
            expect(JSON.parse(d3.select(titles[12]).text()).total).toBe(0);
        }

        describe('bubble filtering with straight crossfilter', () => {
            beforeEach(() => {
                bubbleChart.filter(duo_key('sl', 'sw')({sepal_length: 5.5, sepal_width: 3})).redrawGroup();
            });
            it('updates rect fills correctly', () => {
                testRectFillsBubble12(chart);
            });
            it('updates rect titles correctly', () => {
                testRectTitlesBubble12(chart);
            });
        });
        describe('column filtering with cloned results', () => {
            beforeEach(() => {
                chart.group(clone_group(petalGroup));
                chart.render();
                bubbleChart.filter(duo_key('sl', 'sw')({sepal_length: 5.5, sepal_width: 3})).redrawGroup();
            });
            it('updates rect fills correctly', () => {
                testRectFillsBubble12(chart);
            });
            it('updates rect titles correctly', () => {
                testRectTitlesBubble12(chart);
            });
        });
    });
});
