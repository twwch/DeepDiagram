import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { useChatStore } from '../../store/chatStore';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import type { AgentRef } from './types';

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
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-slate-200 z-10">
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

export const MermaidAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, isStreamingCode } = useChatStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const transformRef = useRef<any>(null);

    // Robust manual fit calculation
    const handleZoomToFit = useCallback(() => {
        if (!transformRef.current || !wrapperRef.current || !dimensions) return;

        const { width: contentWidth, height: contentHeight } = dimensions;
        const { clientWidth: containerWidth, clientHeight: containerHeight } = wrapperRef.current;

        if (contentWidth === 0 || contentHeight === 0 || containerWidth === 0 || containerHeight === 0) return;

        // Calculate padding
        const padding = 40;
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        const scaleX = availableWidth / contentWidth;
        const scaleY = availableHeight / contentHeight;

        // Fit whole diagram
        let scale = Math.min(scaleX, scaleY);
        // Constrain scale
        scale = Math.min(Math.max(scale, 0.05), 4);

        // Calculate centered position
        const scaledWidth = contentWidth * scale;
        const scaledHeight = contentHeight * scale;

        const x = (containerWidth - scaledWidth) / 2;
        const y = (containerHeight - scaledHeight) / 2;

        // Apply transform directly
        transformRef.current.setTransform(x, y, scale, 200);
    }, [dimensions]);

    // Expose export handles
    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!containerRef.current) return;
            const svgElement = containerRef.current.querySelector('svg');
            if (!svgElement) return;

            const filename = `mermaid-diagram.${type}`;
            const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

            let width = dimensions?.width || 0;
            let height = dimensions?.height || 0;

            if (!width || !height) {
                const viewBox = svgElement.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/\s+|,/).map(parseFloat);
                    if (parts.length === 4) {
                        width = parts[2];
                        height = parts[3];
                    }
                } else {
                    const bbox = svgElement.getBBox();
                    width = bbox.width;
                    height = bbox.height;
                }
            }

            clonedSvg.setAttribute('width', `${width}`);
            clonedSvg.setAttribute('height', `${height}`);
            clonedSvg.style.maxWidth = 'none';
            clonedSvg.style.maxHeight = 'none';
            clonedSvg.style.width = 'auto';
            clonedSvg.style.height = 'auto';
            clonedSvg.style.margin = '0';

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
        const renderDiagram = async () => {
            if (!currentCode || !containerRef.current || isStreamingCode) return;

            try {
                // 1. Validate syntax first to prevent silent "Syntax error" SVG generation
                // parse returns boolean or throws.
                // Note: Mermaid types might imply it returns void, but we just need to catch if it throws.
                await mermaid.parse(currentCode);

                // 2. If valid, correct render
                const id = `mermaid-${Date.now()}`;
                const { svg } = await mermaid.render(id, currentCode);

                let cleanedSvg = svg.replace(/style="[^"]*max-width[^"]*"/g, '');

                const viewBoxMatch = cleanedSvg.match(/viewBox="([^"]+)"/);
                if (viewBoxMatch) {
                    const parts = viewBoxMatch[1].split(/\s+|,/).map(parseFloat);
                    if (parts.length === 4) {
                        setDimensions({ width: parts[2], height: parts[3] });
                    }
                }

                setSvgContent(cleanedSvg);
                setError(null);
                setTimeout(() => setIsLoaded(true), 50);

                // Report success to clear any potential previous error on the active step
                useChatStore.getState().reportSuccess();

            } catch (err) {
                // If it's a syntax error (common during streaming), we just ignore it for now
                // or let the final result be caught.
                // We do NOT want to show the native Mermaid error SVG.
                console.warn("Mermaid parsing/render error (suppressed):", err);

                // Only flag as error if we are NOT streaming (i.e. if this is the final result)
                // But passing 'isLoading' props here might be needed?
                // For now, consistent with user request: Suppress native error rendering.

                const msg = err instanceof Error ? err.message : "Failed to render Mermaid diagram";
                useChatStore.getState().reportError(msg);
                setSvgContent(''); // Clear canvas
            }
        };

        renderDiagram();
    }, [currentCode, isStreamingCode]);

    // Use ResizeObserver to trigger fit when container size changes/initializes
    useEffect(() => {
        if (!wrapperRef.current || !isLoaded || !dimensions) return;

        const observer = new ResizeObserver(() => {
            handleZoomToFit();
        });

        observer.observe(wrapperRef.current);

        // Also trigger once immediately
        handleZoomToFit();

        return () => observer.disconnect();
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
                <div className="flex items-center justify-center h-full">
                    <div className="text-red-500 font-mono text-sm p-4 bg-red-50 rounded border border-red-200">
                        {error}
                    </div>
                </div>
            ) : (
                <TransformWrapper
                    ref={transformRef}
                    initialScale={1}
                    minScale={0.05}
                    maxScale={8}
                    centerOnInit={false}
                    limitToBounds={false}
                >
                    <ZoomControls onFit={handleZoomToFit} />
                    <TransformComponent
                        wrapperClass="w-full h-full"
                        contentClass=""
                    >
                        <div
                            ref={containerRef}
                            style={{
                                width: dimensions ? dimensions.width : 'auto',
                                height: dimensions ? dimensions.height : 'auto',
                                opacity: isLoaded ? 1 : 0,
                                transition: 'opacity 0.2s ease-in',
                                transformOrigin: '0 0'
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
