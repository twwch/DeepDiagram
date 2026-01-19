import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { useChatStore } from '../../store/chatStore';
import { cleanContent } from '../../lib/utils';
import { ZoomIn, ZoomOut, Maximize, AlertCircle } from 'lucide-react';
import type { AgentRef, AgentProps } from './types';

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
});

// Zoom Controls Component
const ZoomControls = ({ onFit }: { onFit: () => void }) => {
    const { zoomIn, zoomOut } = useControls();

    return (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-slate-200 z-50">
            <button
                onClick={() => zoomIn()}
                className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                title="Zoom In"
            >
                <ZoomIn size={20} />
            </button>
            <button
                onClick={() => zoomOut()}
                className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                title="Zoom Out"
            >
                <ZoomOut size={20} />
            </button>
            <button
                onClick={onFit}
                className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                title="Fit to Screen"
            >
                <Maximize size={20} />
            </button>
        </div>
    );
};

export const MermaidAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    let currentCode = cleanContent(content);
    // Fix double-escaped newlines from LLM output
    if (currentCode.includes('\\n') && !currentCode.includes('\n')) {
        currentCode = currentCode.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const transformRef = useRef<any>(null);

    const handleZoomToFit = useCallback(() => {
        if (!transformRef.current || !wrapperRef.current || !dimensions) return;

        const { width: contentWidth, height: contentHeight } = dimensions;
        const { clientWidth: containerWidth, clientHeight: containerHeight } = wrapperRef.current;

        if (contentWidth === 0 || contentHeight === 0 || containerWidth === 0 || containerHeight === 0) return;

        const padding = 60;
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        const scaleX = availableWidth / contentWidth;
        const scaleY = availableHeight / contentHeight;

        let scale = Math.min(scaleX, scaleY);
        scale = Math.min(Math.max(scale, 0.05), 4);

        const scaledWidth = contentWidth * scale;
        const scaledHeight = contentHeight * scale;

        const x = (containerWidth - scaledWidth) / 2;
        const y = (containerHeight - scaledHeight) / 2;

        transformRef.current.setTransform(x, y, scale, 200);
    }, [dimensions]);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!containerRef.current) return;
            const svgElement = containerRef.current.querySelector('svg');
            if (!svgElement) return;

            const filename = `mermaid-diagram.${type}`;
            const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

            let width = dimensions?.width || 0;
            let height = dimensions?.height || 0;

            clonedSvg.setAttribute('width', `${width}`);
            clonedSvg.setAttribute('height', `${height}`);
            clonedSvg.style.maxWidth = 'none';
            clonedSvg.style.maxHeight = 'none';
            clonedSvg.style.width = 'auto';
            clonedSvg.style.height = 'auto';

            const svgString = new XMLSerializer().serializeToString(clonedSvg);

            if (type === 'svg') {
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            } else {
                const img = new Image();
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = 3;
                    canvas.width = width * scale;
                    canvas.height = height * scale;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob((b) => {
                        if (b) {
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(b);
                            link.download = filename;
                            link.click();
                            URL.revokeObjectURL(link.href);
                        }
                        URL.revokeObjectURL(url);
                    });
                };
                img.src = url;
            }
        },
        resetView: handleZoomToFit
    }));

    useEffect(() => {
        setIsLoaded(false);
        if (!currentCode) {
            setSvgContent('');
            setDimensions(null);
            return;
        }
        const renderDiagram = async () => {
            if (!containerRef.current) {
                return;
            }
            // 移除 isStreamingCode 检查，总是渲染
            if (isStreamingCode) return;  // 流式期间不渲染
            try {
                setError(null);

                // Robustly strip markdown blocks if they exist
                let cleanCode = currentCode.trim();
                const match = cleanCode.match(/```(?:mermaid)?\s*([\s\S]*?)\s*```/i);
                if (match) {
                    cleanCode = match[1].trim();
                }

                // Handle nested JSON structure: {"design_concept": "...", "code": "..."}
                if (cleanCode.startsWith('{') && cleanCode.includes('"code"')) {
                    try {
                        const parsed = JSON.parse(cleanCode);
                        if (parsed.code) {
                            cleanCode = typeof parsed.code === 'string' ? parsed.code : JSON.stringify(parsed.code);
                        }
                    } catch {
                        // Not valid JSON, continue with original cleanCode
                    }
                }

                await mermaid.parse(cleanCode);

                const id = `mermaid-${Date.now()}`;
                const { svg } = await mermaid.render(id, cleanCode);

                // STRIP FIXED WIDTH/HEIGHT & Inject full scale
                let cleanedSvg = svg
                    .replace(/width="[^"]*"/, 'width="100%"')
                    .replace(/height="[^"]*"/, 'height="100%"')
                    .replace(/style="[^"]*max-width[^"]*"/g, 'style="max-width:none !important;"');

                setSvgContent(cleanedSvg);

                // CRITICAL: Measure actual content after DOM update
                setTimeout(() => {
                    const svgElement = containerRef.current?.querySelector('svg');
                    if (svgElement) {
                        const viewBox = svgElement.viewBox.baseVal;
                        // Use a safe buffer for height, some diagrams (timelines) have tricky text clipping
                        const h = viewBox.height || 600;
                        const w = viewBox.width || 800;

                        setDimensions({
                            width: Math.ceil(w) + 10,
                            height: Math.ceil(h) + 10
                        });
                        setIsLoaded(true);
                    }
                }, 50);

                useChatStore.getState().reportSuccess();
            } catch (err) {
                console.warn("Mermaid parsing/render error:", err);
                const msg = err instanceof Error ? err.message : "Failed to render Mermaid diagram";
                setError(msg);
                useChatStore.getState().reportError(msg);
                setSvgContent('');
            }
        };

        renderDiagram();
    }, [currentCode, isStreamingCode]);

    useEffect(() => {
        if (!wrapperRef.current || !isLoaded || !dimensions) return;

        let observer: ResizeObserver | null = null;
        try {
            observer = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    handleZoomToFit();
                });
            });
            observer.observe(wrapperRef.current);
            handleZoomToFit();
        } catch (e) {
            console.error("ResizeObserver error:", e);
        }

        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    }, [isLoaded, dimensions, handleZoomToFit]);

    if (!currentCode) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400">
                Waiting for Mermaid code...
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="w-full h-full bg-white relative overflow-hidden">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="p-3 bg-red-50 rounded-full mb-3">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Mermaid Render Failed</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs">{error}</p>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('deepdiagram-retry', {
                            detail: {
                                index: useChatStore.getState().messages.length - 1,
                                error: error
                            }
                        }))}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                        Try Regenerating
                    </button>
                </div>
            ) : (
                <TransformWrapper
                    ref={transformRef}
                    initialScale={1}
                    minScale={0.05}
                    maxScale={12}
                    centerOnInit={false}
                    limitToBounds={false}
                >
                    <ZoomControls onFit={handleZoomToFit} />
                    <TransformComponent
                        wrapperClass="!w-full !h-full"
                        contentClass="!flex !items-start !justify-start"
                    >
                        <div
                            ref={containerRef}
                            style={{
                                width: dimensions ? `${dimensions.width}px` : 'auto',
                                height: dimensions ? `${dimensions.height}px` : 'auto',
                                opacity: isLoaded ? 1 : 0,
                                transition: 'opacity 0.2s ease-in',
                                transformOrigin: '0 0',
                                overflow: 'visible' // Ensure internal SVG clipping doesn't happen
                            }}
                            dangerouslySetInnerHTML={{ __html: svgContent }}
                        />
                    </TransformComponent>
                </TransformWrapper>
            )}
        </div>
    );
});

MermaidAgent.displayName = 'MermaidAgent';
