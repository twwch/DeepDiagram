import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import * as echarts from 'echarts';
import type { AgentRef, AgentProps } from './types';
import { AlertCircle } from 'lucide-react';

export const ChartsAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    const currentCode = content;
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!chartInstanceRef.current) return;
            const filename = `deepdiagram - charts - ${new Date().getTime()} `;

            const downloadFile = (url: string, ext: string) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${ext} `;
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
        if (!currentCode || !chartRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
            return;
        }
        if (isStreamingCode) return;  // 流式期间不渲染

        // 销毁已存在的实例
        if (chartRef.current) {
            const existingInstance = echarts.getInstanceByDom(chartRef.current);
            if (existingInstance) {
                existingInstance.dispose();
            }
        }

        const chart = echarts.init(chartRef.current);
        chartInstanceRef.current = chart;

        try {
            setError(null);

            let options: any;

            // Helper to try parsing JSON-like string
            const tryParse = (str: string) => {
                try {
                    return JSON.parse(str);
                } catch {
                    try {
                        // Fallback to Function constructor
                        return new Function(`return (${str})`)();
                    } catch {
                        return null;
                    }
                }
            };

            // Strategy 1: clean code direct parse
            let cleanCode = currentCode.trim();
            options = tryParse(cleanCode);

            // Strategy 2: Strip markdown code blocks
            if (!options) {
                const match = cleanCode.match(/```(?:json|chart)?\s*([\s\S]*?)\s*```/i);
                if (match) {
                    options = tryParse(match[1].trim());
                }
            }

            // Strategy 3: Brute force find first { and last }
            if (!options) {
                const start = cleanCode.indexOf('{');
                const end = cleanCode.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    const candidate = cleanCode.substring(start, end + 1);
                    options = tryParse(candidate);
                }
            }

            if (!options) throw new Error("Could not parse chart configuration");

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

            // Report success to clear any potential previous error
            useChatStore.getState().reportSuccess();

            const resizeObserver = new ResizeObserver(() => chart.resize());
            resizeObserver.observe(chartRef.current);

            return () => {
                resizeObserver.disconnect();
                chart.dispose();
            };
        } catch (e) {
            console.error("ECharts error", e);
            const msg = e instanceof Error ? e.message : "Failed to render chart";
            setError(msg);
            useChatStore.getState().reportError(msg);
        }
    }, [currentCode, isStreamingCode]);

    return (
        <div className="w-full h-full relative bg-white flex items-center justify-center">
            {error ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                    <div className="p-4 bg-red-50 rounded-full mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-base font-semibold text-slate-800 mb-2">Chart Render Failed</p>
                    <p className="text-sm text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('deepdiagram-retry', {
                            detail: {
                                index: useChatStore.getState().messages.length - 1,
                                error: error
                            }
                        }))}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        Try Regenerating
                    </button>
                </div>
            ) : (
                <div ref={chartRef} className="w-full h-full" />
            )}
        </div>
    );
});
