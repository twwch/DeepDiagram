import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Transformer } from 'markmap-lib';
import type { AgentRef } from './types';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style.css';

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

export const MindmapAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, setCurrentCode, isLoading } = useChatStore();
    const mindmapRef = useRef<HTMLDivElement>(null);
    const mindmapInstanceRef = useRef<any>(null);
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

    useEffect(() => {
        if (!currentCode || !mindmapRef.current || isLoading) return;

        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

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

            me.bus.addListener('operation', () => {
                const newData = me.getData();
                const md = convertToMarkdown(newData.nodeData);
                isInternalUpdate.current = true;
                setCurrentCode(md);
            });

            mindmapInstanceRef.current = me;
        } else {
            mindmapInstanceRef.current.init(data);
        }
    }, [currentCode, setCurrentCode, isLoading]);

    useEffect(() => {
        if (!isLoading && mindmapInstanceRef.current && currentCode) {
            setTimeout(() => {
                mindmapInstanceRef.current?.scaleFit();
                mindmapInstanceRef.current?.toCenter();
            }, 100);
        }
    }, [isLoading, currentCode]);

    return <div ref={mindmapRef} className="w-full h-full" />;
});
