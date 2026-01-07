import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import * as AntVInfographic from '@antv/infographic';
import type { AgentRef, AgentProps } from './types';
import { AlertCircle } from 'lucide-react';

const Infographic: any = AntVInfographic.Infographic;

// Resource Loader for AntV Infographic
// Handles icon loading from Iconify and illustration loading from unDraw
const svgTextCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

// @ts-ignore
if (AntVInfographic.registerResourceLoader) {
    // @ts-ignore
    AntVInfographic.registerResourceLoader(async (config: any) => {
        const { data, scene } = config;

        try {
            const key = `${scene}::${data}`;
            let svgText: string | null = null;

            // 1. Check cache
            if (svgTextCache.has(key)) {
                svgText = svgTextCache.get(key) || null;
            }
            // 2. Check if request is already in progress
            else if (pendingRequests.has(key)) {
                svgText = await pendingRequests.get(key) || null;
            }
            // 3. Make new request
            else {
                const fetchPromise = (async () => {
                    try {
                        let url;

                        if (scene === 'icon') {
                            url = `https://api.iconify.design/${data}.svg`;
                        } else if (scene === 'illus') {
                            url = `https://raw.githubusercontent.com/balazser/undraw-svg-collection/refs/heads/main/svgs/${data}.svg`;
                        } else return null;

                        const response = await fetch(url, { referrerPolicy: 'no-referrer' });

                        if (!response.ok) {
                            console.error(`HTTP ${response.status}: Failed to load ${url}`);
                            return null;
                        }

                        const text = await response.text();

                        if (!text || !text.trim().startsWith('<svg')) {
                            console.error(`Invalid SVG content from ${url}`);
                            return null;
                        }

                        svgTextCache.set(key, text);
                        return text;
                    } catch (fetchError) {
                        console.error(`Failed to fetch resource ${key}:`, fetchError);
                        return null;
                    }
                })();

                pendingRequests.set(key, fetchPromise);

                try {
                    svgText = await fetchPromise;
                } catch (error) {
                    pendingRequests.delete(key);
                    console.error(`Error loading resource ${key}:`, error);
                    return null;
                } finally {
                    pendingRequests.delete(key);
                }
            }

            if (!svgText) return null;

            // @ts-ignore
            return AntVInfographic.loadSVGResource(svgText);
        } catch (error) {
            console.error('Unexpected error in resource loader:', error);
            return null;
        }
    });
}

export const InfographicAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    const currentCode = content;
    const containerRef = useRef<HTMLDivElement>(null);
    const infographicRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [blocks, setBlocks] = useState<string[]>([]);

    // Split content into multiple infographic blocks
    useEffect(() => {
        if (!currentCode) {
            setBlocks([]);
            return;
        }

        let dslContent = currentCode.trim();
        // Robust Markdown code block stripping
        const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
        const matches = [...dslContent.matchAll(codeBlockRegex)];

        let extracted = "";
        if (matches.length > 0) {
            extracted = matches.map(m => m[1].trim()).join('\n\n');
        } else {
            extracted = dslContent;
        }

        // Split by 'infographic' keyword at the start of a line
        const splitBlocks = extracted.split(/(?=^infographic\s)/m)
            .map(b => b.trim())
            .filter(b => b.startsWith('infographic'));

        // Update active index to follow the latest block during streaming
        if (isStreamingCode && splitBlocks.length > blocks.length) {
            setActiveBlockIndex(splitBlocks.length - 1);
        }

        setBlocks(splitBlocks);

        // Reset index if out of bounds (safety) - clamp to last valid index instead of resetting to 0
        if (!isStreamingCode && splitBlocks.length > 0) {
            if (activeBlockIndex >= splitBlocks.length) {
                setActiveBlockIndex(splitBlocks.length - 1);
            }
        }
    }, [currentCode, isStreamingCode, blocks.length, activeBlockIndex]);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!infographicRef.current) return;
            const filename = `deepdiagram-infographic-${new Date().getTime()}`;

            try {
                if (type === 'svg') {
                    // Get SVG content from the container
                    const svgElement = containerRef.current?.querySelector('svg');
                    if (svgElement) {
                        const svgData = new XMLSerializer().serializeToString(svgElement);
                        const blob = new Blob([svgData], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${filename}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                } else {
                    // PNG export via canvas
                    const svgElement = containerRef.current?.querySelector('svg');
                    if (svgElement) {
                        const svgData = new XMLSerializer().serializeToString(svgElement);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();

                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(svgBlob);

                        img.onload = () => {
                            canvas.width = img.width * 2;
                            canvas.height = img.height * 2;
                            ctx?.scale(2, 2);
                            ctx?.drawImage(img, 0, 0);

                            const pngUrl = canvas.toDataURL('image/png');
                            const a = document.createElement('a');
                            a.href = pngUrl;
                            a.download = `${filename}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                        };
                        img.src = url;
                    }
                }
            } catch (e) {
                console.error('Export failed:', e);
            }
        }
    }));

    useEffect(() => {
        const activeBlock = blocks[activeBlockIndex];
        if (!activeBlock || !containerRef.current) {
            if (infographicRef.current) {
                infographicRef.current.destroy();
                infographicRef.current = null;
            }
            return;
        }
        // infographic.render is fault-tolerant, so we can render during streaming

        // 如果实例不存在，或者容器内容被意外清空，则重新创建
        if (!infographicRef.current) {
            const instance = new Infographic({
                container: containerRef.current,
                width: '100%',
                height: '100%',
            });
            infographicRef.current = instance;
        }

        const infographic = infographicRef.current;

        try {
            setError(null);

            // Wait for icons etc.
            infographic.render(activeBlock);

            // Only report success when not streaming
            if (!isStreamingCode) {
                useChatStore.getState().reportSuccess();
            }
        } catch (e) {
            console.error("Infographic error", e);
            const msg = e instanceof Error ? e.message : "Failed to render infographic";
            if (!isStreamingCode) {
                setError(msg);
                useChatStore.getState().reportError(msg);
            }
        }
    }, [blocks, activeBlockIndex, isStreamingCode]);

    return (
        <div className="w-full h-full relative bg-white flex flex-col items-center justify-center">
            {error ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                    <div className="p-4 bg-red-50 rounded-full mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-base font-semibold text-slate-800 mb-2">Infographic Render Failed</p>
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
                <div className="w-full h-full flex flex-col">
                    <div ref={containerRef} className="flex-1 w-full h-0" />

                    {blocks.length > 1 && (
                        <div className="h-12 border-t border-slate-100 flex items-center justify-center gap-4 bg-slate-50/50">
                            <div className="flex items-center gap-1.5 p-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                                {blocks.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveBlockIndex(idx)}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium transition-all ${activeBlockIndex === idx
                                            ? 'bg-slate-900 text-white shadow-md'
                                            : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                                Page {activeBlockIndex + 1} of {blocks.length}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
