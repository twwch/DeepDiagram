import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import * as echarts from 'echarts';
import type { AgentRef } from './types';

export const ChartsAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, isLoading } = useChatStore();
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!chartInstanceRef.current) return;
            const filename = `deepdiagram-charts-${new Date().getTime()}`;

            const downloadFile = (url: string, ext: string) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${ext}`;
                a.click();
            };

            if (type === 'png') {
                const url = chartInstanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
                downloadFile(url, 'png');
            } else {
                alert('SVG export for charts is not currently supported in this mode.');
            }
        }
    }));

    useEffect(() => {
        if (!currentCode || !chartRef.current || isLoading) return;

        const chart = echarts.init(chartRef.current);
        chartInstanceRef.current = chart;

        try {
            let options: any;
            try {
                options = JSON.parse(currentCode);
            } catch {
                options = new Function(`return (${currentCode})`)();
            }

            const hasAxis = options.xAxis || options.yAxis || (options.grid && !options.series?.some((s: any) => s.type === 'pie'));

            if (hasAxis) {
                if (!options.dataZoom) {
                    options.dataZoom = [
                        { type: 'inside', xAxisIndex: [0], filterMode: 'filter' },
                        { type: 'slider', xAxisIndex: [0], filterMode: 'filter' }
                    ];
                }
                if (!options.tooltip) options.tooltip = { trigger: 'axis', confine: true };
            }

            if (options.series) {
                options.series = options.series.map((s: any) => {
                    if (['graph', 'tree', 'map', 'sankey'].includes(s.type)) {
                        return { ...s, roam: true };
                    }
                    return s;
                });
            }

            chart.setOption(options);

            const resizeObserver = new ResizeObserver(() => chart.resize());
            resizeObserver.observe(chartRef.current);

            return () => {
                resizeObserver.disconnect();
                chart.dispose();
            };
        } catch (e) {
            console.error("ECharts parse error", e);
        }
    }, [currentCode, isLoading]);

    return <div ref={chartRef} className="w-full h-full" />;
});
