import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    useReactFlow,
    getRectOfNodes,
    getTransformForBounds,
    Handle,
    Position,
    MarkerType,
    type Connection
} from 'reactflow';
import { cn, cleanContent } from '../../lib/utils';
import { Play, Flag, Box, HelpCircle, AlertCircle } from 'lucide-react';
import 'reactflow/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import type { AgentRef, AgentProps } from './types';

// Global styles to strip default React Flow node styling
const nodeResetStyles = `
    .react-flow__node {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        transform-origin: center center !important;
    }
    .react-flow__edge-path {
        stroke-width: 2.5;
    }
`;

const BaseCardNode = ({ data, id, children, className, icon: Icon, colorClass, accentColor }: any) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label);

    useEffect(() => {
        setValue(data.label);
    }, [data.label]);

    const onBlur = () => {
        setEditing(false);
        if (data.onChange) {
            data.onChange(id, value);
        }
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onBlur();
        }
    };

    return (
        <div
            className={cn(
                "relative bg-white border border-slate-200 shadow-xl transition-all duration-300 pointer-events-auto group overflow-hidden",
                className
            )}
            onDoubleClick={() => setEditing(true)}
        >
            {/* Left Accent Bar */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", accentColor)} />

            <div className="relative z-10 flex items-start gap-3 p-4">
                {Icon && (
                    <div className={cn("mt-1 p-1.5 rounded-lg bg-slate-50", colorClass)}>
                        <Icon className="w-4 h-4" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    {editing ? (
                        <textarea
                            autoFocus
                            rows={2}
                            className="w-full text-sm font-bold text-slate-900 bg-transparent outline-none resize-none"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onBlur={onBlur}
                            onKeyDown={handleKeyDown}
                        />
                    ) : (
                        <div className="text-sm font-bold text-slate-800 whitespace-pre-wrap break-words leading-snug select-none">
                            {data.label}
                        </div>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};

const ProcessNode = (props: any) => (
    <BaseCardNode
        {...props}
        icon={Box}
        colorClass="text-blue-600"
        accentColor="bg-blue-600"
        className="rounded-2xl min-w-[200px] max-w-[280px]"
    >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-600 !border-2 !border-white" />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-600 !border-2 !border-white" />
    </BaseCardNode>
);

const LifecycleNode = ({ data, id, children, className, icon: Icon, colorClass, borderColor }: any) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label);

    const onBlur = () => {
        setEditing(false);
        if (data.onChange) data.onChange(id, value);
    };

    return (
        <div
            className={cn(
                "relative bg-white border-2 px-8 py-4 shadow-lg transition-all duration-300 pointer-events-auto",
                borderColor,
                className
            )}
            onDoubleClick={() => setEditing(true)}
        >
            <div className="flex items-center gap-3">
                {Icon && <Icon className={cn("w-5 h-5", colorClass)} />}
                {editing ? (
                    <input
                        autoFocus
                        className="text-sm font-black text-slate-900 bg-transparent outline-none uppercase tracking-widest"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={onBlur}
                    />
                ) : (
                    <div className="text-sm font-black text-slate-900 select-none uppercase tracking-widest">
                        {data.label}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
};

const StartNode = (props: any) => (
    <LifecycleNode {...props} icon={Play} colorClass="text-emerald-600" borderColor="border-emerald-600" className="rounded-full">
        <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-emerald-600 !border-2 !border-white" />
    </LifecycleNode>
);

const EndNode = (props: any) => (
    <LifecycleNode {...props} icon={Flag} colorClass="text-rose-600" borderColor="border-rose-600" className="rounded-full">
        <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-rose-600 !border-2 !border-white" />
    </LifecycleNode>
);

const DecisionNode = (props: any) => {
    const { data, id } = props;
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label);

    const onBlur = () => {
        setEditing(false);
        if (data.onChange) data.onChange(id, value);
    };

    return (
        <div className="relative w-44 h-44 flex items-center justify-center pointer-events-auto" onDoubleClick={() => setEditing(true)}>
            {/* SVG Diamond for precision */}
            <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0 drop-shadow-2xl">
                <polygon points="50,4 96,50 50,96 4,50" fill="white" stroke="#f59e0b" strokeWidth="2.5" />
            </svg>

            <div className="relative z-10 text-center px-8 w-full flex flex-col items-center">
                <HelpCircle className="w-6 h-6 mb-2 text-amber-500 opacity-60" />
                {editing ? (
                    <textarea
                        autoFocus
                        rows={2}
                        className="w-full text-center outline-none bg-transparent text-xs font-black text-slate-900 resize-none leading-tight"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={onBlur}
                    />
                ) : (
                    <div className="text-xs font-black text-slate-900 leading-snug whitespace-pre-wrap break-words select-none px-2 uppercase tracking-tight">
                        {data.label}
                    </div>
                )}
            </div>

            <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white !-top-1.5" />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white !-bottom-1.5" />
            <Handle type="source" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white !-left-1.5" />
            <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white !-right-1.5" />
        </div>
    );
};

const nodeTypes = {
    start: StartNode,
    end: EndNode,
    process: ProcessNode,
    decision: DecisionNode,
    default: ProcessNode,
};

export const FlowAgent = forwardRef<AgentRef, AgentProps>(({ content }, ref) => {
    const { isStreamingCode } = useChatStore();
    let currentCode = cleanContent(content);
    // Fix double-escaped newlines from LLM output
    if (currentCode.includes('\\n') && !currentCode.includes('\n')) {
        currentCode = currentCode.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [error, setError] = useState<string | null>(null);
    const isInternalUpdate = useRef(false);
    const { getNodes, fitView } = useReactFlow();

    const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

    const handleNodeLabelChange = (id: string, newLabel: string) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    return { ...n, data: { ...n.data, label: newLabel } };
                }
                return n;
            })
        );
    };

    useImperativeHandle(ref, () => ({
        handleDownload: async (exportType: 'png' | 'svg') => {
            const currentNodes = getNodes();
            const nodesRect = getRectOfNodes(currentNodes);
            const padding = 150;
            const width = nodesRect.width + padding * 2;
            const height = nodesRect.height + padding * 2;
            const transform = getTransformForBounds(nodesRect, width, height, 0.1, 4);

            const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement;
            if (!flowElement) return;

            const filename = `deepdiagram-flowchart-${new Date().getTime()}`;
            const downloadFile = (url: string, ext: string) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${ext}`;
                a.click();
            };

            const exportOptions = {
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                pixelRatio: 2,
                quality: 1,
                onClone: (clonedDoc: Document) => {
                    const viewport = clonedDoc.querySelector('.react-flow__viewport') as HTMLElement;
                    if (viewport) {
                        viewport.style.transform = `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`;
                        viewport.style.transformOrigin = '0 0';
                    }

                    const originalDefs = document.querySelector('.react-flow svg defs');
                    const clonedSvg = clonedDoc.querySelector('svg');
                    if (originalDefs && clonedSvg) {
                        clonedSvg.prepend(originalDefs.cloneNode(true));
                    }

                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        ${nodeResetStyles}
                        .react-flow__handle, .react-flow__controls, .react-flow__attribution {
                            display: none !important;
                        }
                        * {
                            font-family: 'Inter, system-ui, sans-serif' !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                },
                filter: (node: HTMLElement) => {
                    const excludeClasses = [
                        'react-flow__controls',
                        'react-flow__panel',
                        'react-flow__background',
                        'react-flow__attribution',
                        'react-flow__handle'
                    ];
                    return !excludeClasses.some(cls => node.classList?.contains(cls));
                }
            };

            if (exportType === 'png') {
                const dataUrl = await toPng(flowElement, exportOptions);
                downloadFile(dataUrl, 'png');
            } else {
                const dataUrl = await toSvg(flowElement, exportOptions);
                downloadFile(dataUrl, 'svg');
            }
        },
        resetView: () => {
            fitView({ padding: 0.2, duration: 800 });
        }
    }));

    // Sync logic removed as currentCode is now derived from history

    // Update React Flow from currentCode
    useEffect(() => {
        if (currentCode) {
            if (isInternalUpdate.current) {
                isInternalUpdate.current = false;
                return;
            }
            if (isStreamingCode) return;

            try {
                let jsonStr = currentCode;
                let data: any;

                // Helper to try parsing
                const tryParse = (str: string) => {
                    try {
                        return JSON.parse(str);
                    } catch {
                        return null;
                    }
                };

                // Strategy 1: Direct Parse
                data = tryParse(jsonStr);

                // Strategy 2: Strip markdown
                if (!data) {
                    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                    if (match) {
                        data = tryParse(match[1].trim());
                    }
                }

                // Strategy 3: Brute force find first { and last }
                if (!data) {
                    const start = jsonStr.indexOf('{');
                    const end = jsonStr.lastIndexOf('}');
                    if (start !== -1 && end !== -1 && end > start) {
                        const candidate = jsonStr.substring(start, end + 1);
                        data = tryParse(candidate);
                    }
                }

                if (!data) throw new Error("Could not parse flow configuration");

                // Handle nested structure: {"design_concept": "...", "code": "..."}
                if (data.code && !data.nodes) {
                    // code field might be a string or an object
                    if (typeof data.code === 'string') {
                        data = tryParse(data.code);
                    } else {
                        data = data.code;
                    }
                    if (!data) throw new Error("Could not parse flow configuration from code field");
                }

                if (data.nodes && Array.isArray(data.nodes)) {
                    setError(null);
                    // V4 STRUCTURAL FIX: Sanitize and Fix AI garbage
                    const processedNodes = data.nodes.map((n: any) => {
                        // 1. Force valid types
                        let type = n.type || 'process';
                        if (!nodeTypes[type as keyof typeof nodeTypes]) {
                            type = 'process';
                        }

                        // 2. STRIP AI-INJECTED STYLING & ROTATION
                        const { style, className, ...rest } = n;

                        return {
                            ...rest,
                            type,
                            data: {
                                ...n.data,
                                onChange: handleNodeLabelChange
                            },
                            // 3. Reset any transform from style object
                            style: {}
                        };
                    });

                    setNodes(processedNodes);
                    setEdges(data.edges || []);
                    useChatStore.getState().reportSuccess();
                }
            } catch (e) {
                console.error("Flow render error", e);
                const msg = e instanceof Error ? e.message : "Failed to render flowchart";
                setError(msg);
                useChatStore.getState().reportError(msg);
            }
        } else {
            // CRITICAL: Clear nodes and edges if currentCode is empty (e.g. at start of retry)
            setNodes([]);
            setEdges([]);
        }
    }, [currentCode, isStreamingCode]);

    return (
        <div className="w-full h-full bg-[#fcfcfc] relative">
            <style>{nodeResetStyles}</style>
            {error ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="p-3 bg-red-50 rounded-full mb-3">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Flowchart Render Failed</p>
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
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { strokeWidth: 2, stroke: '#94a3b8' },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            width: 20,
                            height: 20,
                            color: '#94a3b8',
                        },
                    }}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                >
                    <Background color="#cbd5e1" gap={28} size={1} />
                    <Controls />
                </ReactFlow>
            )}
        </div>
    );
});
