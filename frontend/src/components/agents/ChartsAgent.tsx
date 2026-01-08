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
        if (!currentCode || !chartRef.current) return;
        if (isStreamingCode) return;

        // Initialize or get existing instance
        let chart = chartInstanceRef.current;
        if (!chart) {
            chart = echarts.init(chartRef.current);
            chartInstanceRef.current = chart;
        }

        try {
            setError(null);
            let options: any;

            // Helper to try parsing JSON-like string
            const tryParse = (str: string) => {
                try {
                    return JSON.parse(str);
                } catch {
                    try {
                        return new Function(`return (${str})`)();
                    } catch {
                        return null;
                    }
                }
            };

            let cleanCode = currentCode.trim();
            options = tryParse(cleanCode);

            if (!options) {
                const match = cleanCode.match(/```(?:json|chart)?\s*([\s\S]*?)\s*```/i);
                if (match) {
                    options = tryParse(match[1].trim());
                }
            }

            if (!options) {
                const start = cleanCode.indexOf('{');
                const end = cleanCode.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    options = tryParse(cleanCode.substring(start, end + 1));
                }
            }

            if (!options) throw new Error("Could not parse chart configuration");

            // Auto-enrichment for consistency
            const hasXAxis = Array.isArray(options.xAxis) ? options.xAxis.length > 0 : !!options.xAxis;
            const hasYAxis = Array.isArray(options.yAxis) ? options.yAxis.length > 0 : !!options.yAxis;

            if (hasXAxis && hasYAxis) {
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
                    const type = s.type;
                    if (['graph', 'tree', 'map', 'sankey'].includes(type)) {
                        return { roam: true, ...s };
                    }
                    return s;
                });
            }

            // use notMerge: true to prevent leakage of old axis/grid state
            chart.setOption(options, { notMerge: true });

            useChatStore.getState().reportSuccess();

            const resizeObserver = new ResizeObserver(() => chart?.resize());
            resizeObserver.observe(chartRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        } catch (e) {
            console.error("ECharts error", e);
            const msg = e instanceof Error ? e.message : "Failed to render chart";
            setError(msg);
            useChatStore.getState().reportError(msg);
        }
    }, [currentCode, isStreamingCode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
        };
    }, []);

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
