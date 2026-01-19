import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { cleanContent } from '../../lib/utils';
import { Transformer } from 'markmap-lib';
import type { AgentRef, AgentProps } from './types';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style.css';
import { AlertCircle } from 'lucide-react';

// Helper to strip HTML and decode entities
const stripHtmlAndDecode = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.documentElement.textContent || "";
};

// Helper to convert Markmap tree to MindElixir tree
const convertToMindElixir = (node: any): any => {
    return {
        topic: stripHtmlAndDecode(node.content),
        id: Math.random().toString(36).substr(2, 9),
        children: node.children?.map((c: any) => convertToMindElixir(c)) || [],
    };
};

// Helper to convert MindElixir tree to Markdown
const convertToMarkdown = (node: any, level: number = 1): string => {
    let md = "";
    if (level === 1) {
        md += `# ${node.topic}\n`;
    } else if (level === 2) {
        md += `## ${node.topic}\n`;
    } else {
        md += `${"  ".repeat(level - 2)}- ${node.topic}\n`;
    }

    if (node.children) {
        node.children.forEach((child: any) => {
            md += convertToMarkdown(child, level + 1);
        });
    }
    return md;
};

// Helper to fit mindmap with padding by calculating actual bounding box
const fitWithPadding = (me: any) => {
    if (!me || !me.container) return;

    const container = me.container as HTMLElement;
    const mapContainer = container.querySelector('.map-container') as HTMLElement;
    if (!mapContainer) {
        me.scaleFit();
        me.toCenter();
        return;
    }

    // First use the built-in scaleFit to get base positioning
    me.scaleFit();
    me.toCenter();

    // Then apply additional adjustment after a short delay
    requestAnimationFrame(() => {
        // Get all topic elements to calculate true bounding box
        const topics = mapContainer.querySelectorAll('.topic');
        if (!topics.length) return;

        const containerRect = container.getBoundingClientRect();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        topics.forEach((topic) => {
            const rect = topic.getBoundingClientRect();
            // Position relative to container
            const left = rect.left - containerRect.left;
            const top = rect.top - containerRect.top;
            const right = left + rect.width;
            const bottom = top + rect.height;

            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, top);
            maxY = Math.max(maxY, bottom);
        });

        if (minX === Infinity) return;

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Check if content is clipped on any side
        const leftClip = minX < 0 ? -minX : 0;
        const rightClip = maxX > containerWidth ? maxX - containerWidth : 0;
        const topClip = minY < 0 ? -minY : 0;
        const bottomClip = maxY > containerHeight ? maxY - containerHeight : 0;

        const isClipped = leftClip > 0 || rightClip > 0 || topClip > 0 || bottomClip > 0;

        if (isClipped) {
            // Need to scale down more and recenter
            const currentScale = me.scaleVal || 1;

            // Calculate required scale to fit with 15% padding on each side
            const paddingRatio = 0.70;
            const requiredScaleX = (containerWidth * paddingRatio) / contentWidth;
            const requiredScaleY = (containerHeight * paddingRatio) / contentHeight;
            const newScale = Math.min(requiredScaleX, requiredScaleY, currentScale) * currentScale;

            me.scale(newScale);

            // After scaling, recenter based on new content position
            requestAnimationFrame(() => {
                const newContainerRect = container.getBoundingClientRect();
                let newMinX = Infinity, newMaxX = -Infinity, newMinY = Infinity, newMaxY = -Infinity;

                topics.forEach((topic) => {
                    const rect = topic.getBoundingClientRect();
                    const left = rect.left - newContainerRect.left;
                    const top = rect.top - newContainerRect.top;
                    newMinX = Math.min(newMinX, left);
                    newMaxX = Math.max(newMaxX, left + rect.width);
                    newMinY = Math.min(newMinY, top);
                    newMaxY = Math.max(newMaxY, top + rect.height);
                });

                // Calculate how much to move to center
                const contentCenterX = (newMinX + newMaxX) / 2;
                const contentCenterY = (newMinY + newMaxY) / 2;
                const containerCenterX = containerWidth / 2;
                const containerCenterY = containerHeight / 2;

                const dx = containerCenterX - contentCenterX;
                const dy = containerCenterY - contentCenterY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    me.move(dx, dy);
                }
            });
        }
    });
};

export const MindmapAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    let currentCode = cleanContent(content);
    // Robustness: Strip markdown code fences if present
    currentCode = currentCode.replace(/^```(?:\w+)?\s*\n/, '').replace(/```\s*$/, '').trim();
    // Fix double-escaped newlines from LLM output (literal \n instead of actual newlines)
    if (currentCode.includes('\\n') && !currentCode.includes('\n')) {
        currentCode = currentCode.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }

    const mindmapRef = useRef<HTMLDivElement>(null);
    const mindmapInstanceRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const isInternalUpdate = useRef(false);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (!mindmapInstanceRef.current) return;
            const filename = `deepdiagram-mindmap-${new Date().getTime()}`;

            const downloadFile = (url: string, ext: string) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${ext}`;
                a.click();
            };

            if (type === 'png') {
                const blob = await mindmapInstanceRef.current.exportPng();
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    downloadFile(url, 'png');
                    URL.revokeObjectURL(url);
                }
            } else {
                const blob = mindmapInstanceRef.current.exportSvg();
                const url = URL.createObjectURL(blob);
                downloadFile(url, 'svg');
                URL.revokeObjectURL(url);
            }
        },
        resetView: () => {
            if (mindmapInstanceRef.current) {
                fitWithPadding(mindmapInstanceRef.current);
            }
        }
    }));

    const renderDiagram = async () => {
        if (!currentCode || !mindmapRef.current) return;

        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

        try {
            setError(null);

            // Handle nested JSON structure: {"design_concept": "...", "code": "..."}
            let codeToRender = currentCode;
            if (codeToRender.trim().startsWith('{') && codeToRender.includes('"code"')) {
                try {
                    const parsed = JSON.parse(codeToRender);
                    if (parsed.code) {
                        codeToRender = typeof parsed.code === 'string' ? parsed.code : JSON.stringify(parsed.code);
                    }
                } catch {
                    // Not valid JSON, continue with original code
                }
            }

            const transformer = new Transformer();
            const { root } = transformer.transform(codeToRender);
            const data = {
                nodeData: convertToMindElixir(root)
            };

            if (!mindmapInstanceRef.current) {
                const me = new MindElixir({
                    el: mindmapRef.current,
                    direction: MindElixir.SIDE,
                    draggable: true,
                    editable: true,
                });
                me.init(data);

                setTimeout(() => {
                    fitWithPadding(me);
                }, 0);

                mindmapInstanceRef.current = me;
            } else {
                mindmapInstanceRef.current.init(data);
                if (isStreamingCode) {
                    fitWithPadding(mindmapInstanceRef.current);
                }
            }
            useChatStore.getState().reportSuccess();
        } catch (err) {
            console.error("Mindmap render error", err);
            const msg = err instanceof Error ? err.message : "Failed to render mindmap";
            setError(msg);
            useChatStore.getState().reportError(msg);
        }
    };

    useEffect(() => {
        if (!currentCode) {
            // Clear mindmap if code is empty
            if (mindmapInstanceRef.current && mindmapRef.current) {
                mindmapInstanceRef.current.init({ nodeData: { topic: "...", id: "root", children: [] } });
                mindmapInstanceRef.current = null;
                mindmapRef.current.innerHTML = ''; // Full wipe
            }
            return;
        }
        renderDiagram();
    }, [currentCode, isStreamingCode]);

    useEffect(() => {
        if (!isStreamingCode && mindmapInstanceRef.current && currentCode) {
            setTimeout(() => {
                fitWithPadding(mindmapInstanceRef.current);
            }, 100);
        }
    }, [isStreamingCode, currentCode]);

    return (
        <div className="w-full h-full relative bg-white">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="p-3 bg-red-50 rounded-full mb-3">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Mindmap Render Failed</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs">{error}</p>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('deepdiagram-retry', {
                            detail: { index: useChatStore.getState().messages.length - 1 }
                        }))}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                        Try Regenerating
                    </button>
                </div>
            ) : (
                <div ref={mindmapRef} className="w-full h-full" />
            )}
        </div>
    );
});

MindmapAgent.displayName = 'MindmapAgent';
