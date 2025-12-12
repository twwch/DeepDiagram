import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import mermaid from 'mermaid';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import * as echarts from 'echarts';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { SquarePen, Download, RotateCcw, Check } from 'lucide-react';

export const CanvasPanel = () => {
    const { activeAgent, currentCode, setCurrentCode } = useChatStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const mermaidRef = useRef<HTMLDivElement>(null);
    const markmapSvgRef = useRef<SVGSVGElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const markmapInstanceRef = useRef<Markmap | null>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    const handleStartEditing = () => {
        if (!isEditing) {
            let initialValue = currentCode || '';
            // Pretty print JSON for charts safely
            if ((activeAgent === 'charts') && initialValue) {
                try {
                    // Only try to format if it's valid JSON. If it contains functions, leave it alone to avoid stripping them.
                    const parsed = JSON.parse(initialValue);
                    initialValue = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    // Not valid JSON (likely contains functions or is JS object), keep raw text
                }
            }
            setEditValue(initialValue);
        }
        setIsEditing(!isEditing);
    };

    // Handle Edit Submit
    const handleEditSubmit = () => {
        setCurrentCode(editValue);
        setIsEditing(false);
    };

    // Render Diagrams
    useEffect(() => {
        const renderDiagram = async () => {
            // Cleanup previous instances forcibly
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
            if (markmapInstanceRef.current) {
                // Markmap cleanup
                markmapInstanceRef.current = null;
                if (markmapSvgRef.current) markmapSvgRef.current.innerHTML = '';
            }

            if (!currentCode || isEditing) return;

            try {
                if (activeAgent === 'flow') {
                    if (mermaidRef.current) {
                        mermaid.initialize({ startOnLoad: true, theme: 'default' });
                        try {
                            const { svg } = await mermaid.render('mermaid-graph', currentCode);
                            mermaidRef.current.innerHTML = svg;
                        } catch (err) {
                            console.error("Mermaid render error", err);
                        }
                    }
                }
                else if (activeAgent === 'mindmap') {
                    if (markmapSvgRef.current) {
                        const transformer = new Transformer();
                        const { root } = transformer.transform(currentCode);
                        // Ensure minimal options for zoom/pan
                        markmapInstanceRef.current = Markmap.create(markmapSvgRef.current, {
                            zoom: true,
                            pan: true,
                        }, root);
                        markmapInstanceRef.current.fit();
                    }
                }
                else if (activeAgent === 'charts') {
                    if (chartRef.current) {
                        const chart = echarts.init(chartRef.current);
                        try {
                            // Use lenient parsing to allow functions and JS objects
                            // Evaluates "return { ... }"
                            // We wrap in parentheses to handle bare objects "{...}" vs block checks
                            let options: any;
                            try {
                                // Try pure JSON first for safety
                                options = JSON.parse(currentCode);
                            } catch {
                                // Fallback to JS eval if JSON fails (e.g. contains functions)
                                // Only run if it looks somewhat safe (basic heuristic)
                                options = new Function(`return (${currentCode})`)();
                            }

                            // 1. Enabling Zoom/Pan for Cartesian Charts (Bar, Line, Scatter, etc.)
                            // Default to enabling if we can't detect axis (safety) or if axis exists
                            const hasAxis = options.xAxis || options.yAxis || (options.grid && !options.series?.some((s: any) => s.type === 'pie'));

                            if (hasAxis) {
                                // Add dataZoom if not present
                                if (!options.dataZoom) {
                                    options.dataZoom = [
                                        {
                                            type: 'inside', // Enable scroll zoom and drag pan
                                            xAxisIndex: [0], // Default to first axis
                                            filterMode: 'filter'
                                        },
                                        {
                                            type: 'slider', // Visible slider at bottom
                                            xAxisIndex: [0],
                                            filterMode: 'filter'
                                        }
                                    ];
                                }
                                // Ensure tooltip is triggerable for better UX
                                if (!options.tooltip) options.tooltip = { trigger: 'axis', confine: true };
                            }

                            // 2. Enabling Zoom/Pan/Drag for Graph/Tree/Map/Geom
                            if (options.series) {
                                options.series = options.series.map((s: any) => {
                                    // If graph, tree, sankey, map -> enable roam
                                    if (['graph', 'tree', 'map', 'sankey'].includes(s.type)) {
                                        return { ...s, roam: true };
                                    }
                                    return s;
                                });
                            }

                            chart.setOption(options);
                            chartInstanceRef.current = chart;
                            // Resize observer
                            const resizeObserver = new ResizeObserver(() => chart.resize());
                            resizeObserver.observe(chartRef.current);
                            return () => resizeObserver.disconnect();
                        } catch (e) {
                            console.error("ECharts parse error", e);
                        }
                    }
                }
            } catch (error) {
                console.error("Render error:", error);
            }
        };

        renderDiagram();
    }, [currentCode, activeAgent, isEditing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
            }
        }
    }, []);

    const useZoomWrapper = activeAgent === 'flow';

    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    const handleDownload = async (type: 'json' | 'png' | 'svg') => {
        const timestamp = new Date().getTime();
        const filename = `deepdiagram-${activeAgent}-${timestamp}`;

        if (type === 'json') {
            const blob = new Blob([currentCode], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        else if (type === 'png') {
            if (activeAgent === 'charts') {
                if (chartInstanceRef.current) {
                    const url = chartInstanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${filename}.png`;
                    a.click();
                }
            } else {
                // For SVG-based diagrams (Flow/Mindmap), render SVG to Canvas then PNG
                const svgElement = containerRef.current?.querySelector('svg');
                if (svgElement) {
                    const svgData = new XMLSerializer().serializeToString(svgElement);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();

                    // Decode SVG to base64 for image source
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);

                    img.onload = () => {
                        const bbox = svgElement.getBoundingClientRect();
                        canvas.width = bbox.width * 2; // High Def
                        canvas.height = bbox.height * 2;
                        if (ctx) {
                            ctx.scale(2, 2);
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            const pngUrl = canvas.toDataURL('image/png');
                            const a = document.createElement('a');
                            a.href = pngUrl;
                            a.download = `${filename}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    };
                    img.src = url;
                }
            }
        }
        else if (type === 'svg') {
            // Only relevant for Flow and Mindmap usually, unless we tackle ECharts SVG renderer
            // Check for SVG element
            const svgElement = containerRef.current?.querySelector('svg');
            if (svgElement) {
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.svg`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert("SVG download not available for this diagram type.");
            }
        }
        setShowDownloadMenu(false);
    };

    return (
        <div className="h-full w-full bg-slate-50 relative flex flex-col overflow-hidden" ref={containerRef}>
            {/* Main Content Area */}
            <div className="flex-1 w-full h-full overflow-hidden p-8">
                <div className="w-full h-full bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200 relative">
                    {/* Toolbar (Visible only when NOT editing) */}
                    {!isEditing && (
                        <div className="absolute top-4 right-4 z-10 flex flex-row gap-4 items-center p-2">
                            {/* Edit Button */}
                            <button
                                onClick={handleStartEditing}
                                className="text-slate-700 hover:text-blue-600 transition-colors duration-200"
                                title="Edit Code"
                            >
                                <SquarePen className="w-5 h-5" />
                            </button>

                            {/* Download Button (File Icon) */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                    className={`text-slate-700 hover:text-blue-600 transition-colors duration-200 ${showDownloadMenu ? 'text-blue-600' : ''}`}
                                    title="Download"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                {showDownloadMenu && (
                                    <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-lg p-1 flex flex-col w-32 z-50">
                                        <button onClick={() => handleDownload('json')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save JSON</button>
                                        <button onClick={() => handleDownload('png')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save PNG</button>
                                        <button onClick={() => handleDownload('svg')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save SVG</button>
                                    </div>
                                )}
                            </div>

                            {/* Reset View Button (History Icon) */}
                            {useZoomWrapper && (
                                <button
                                    onClick={() => transformRef.current?.resetTransform()}
                                    className="text-slate-700 hover:text-blue-600 transition-colors duration-200"
                                    title="Reset View"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                    {
                        isEditing ? (
                            <div className="w-full h-full flex flex-col bg-slate-50">
                                {/* Simple Header */}
                                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
                                    <span className="text-sm font-semibold text-gray-700">Edit Source Code</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleEditSubmit}
                                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            Update Diagram
                                        </button>
                                    </div>
                                </div>

                                {/* Editor Area Wrapper */}
                                <div className="flex-1 w-full p-6 overflow-hidden">
                                    <textarea
                                        className="w-full h-full p-4 font-mono text-sm leading-6 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white border border-gray-200 rounded-lg text-slate-800 shadow-sm transition-all"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        spellCheck={false}
                                        placeholder="Edit the diagram code here..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Flowchart (Mermaid) with external Zoom/Pan */}
                                {(activeAgent === 'flow') && (
                                    <TransformWrapper ref={transformRef}>
                                        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                                            <div ref={mermaidRef} className="mermaid-container" />
                                        </TransformComponent>
                                    </TransformWrapper>
                                )}

                                {/* Mindmap (Native Zoom/Pan) */}
                                {(activeAgent === 'mindmap') && (
                                    <div className="w-full h-full">
                                        <svg ref={markmapSvgRef} className="w-full h-full" />
                                    </div>
                                )}

                                {/* Charts (Native Zoom/Pan) */}
                                {(activeAgent === 'charts') && (
                                    <div ref={chartRef} className="w-full h-full" />
                                )}

                                {/* Placeholder/Empty State */}
                                {!currentCode && (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                        <p>No diagram generated yet.</p>
                                    </div>
                                )}
                            </>
                        )
                    }
                </div >
            </div >
        </div >
    );
};
