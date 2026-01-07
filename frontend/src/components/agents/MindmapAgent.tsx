import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
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

export const MindmapAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    const currentCode = content;
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
                mindmapInstanceRef.current.scaleFit();
                mindmapInstanceRef.current.toCenter();
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
            const transformer = new Transformer();
            const { root } = transformer.transform(currentCode);
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
                    me.scaleFit();
                    me.toCenter();
                }, 0);

                mindmapInstanceRef.current = me;
            } else {
                mindmapInstanceRef.current.init(data);
                if (isStreamingCode) {
                    mindmapInstanceRef.current.scaleFit();
                    mindmapInstanceRef.current.toCenter();
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
                mindmapInstanceRef.current?.scaleFit();
                mindmapInstanceRef.current?.toCenter();
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
