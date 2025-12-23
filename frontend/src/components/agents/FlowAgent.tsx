import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
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
    type Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import type { AgentRef } from './types';

const EditableNode = ({ data, id, isConnectable }: any) => {
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

    const onKeyDown = (e: any) => {
        if (e.key === 'Enter') {
            onBlur();
        }
    };

    return (
        <div
            className="px-4 py-2 shadow-sm rounded-md bg-white border border-slate-300 min-w-[100px] text-center hover:border-blue-400 transition-colors"
            onDoubleClick={() => setEditing(true)}
        >
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#94a3b8' }} />
            {editing ? (
                <input
                    autoFocus
                    className="w-full text-center outline-none bg-transparent text-sm font-medium text-slate-700"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                />
            ) : (
                <div className="text-sm font-medium text-slate-700 select-none cursor-text">{data.label}</div>
            )}
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#94a3b8' }} />
        </div>
    );
};

const nodeTypes = {
    editable: EditableNode,
    default: EditableNode,
};

export const FlowAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, setCurrentCode, isStreamingCode } = useChatStore();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const isInternalUpdate = useRef(false);
    const { getNodes, fitView } = useReactFlow();

    const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            const nodes = getNodes();
            const nodesRect = getRectOfNodes(nodes);
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
                backgroundColor: '#fff',
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

                    // Manually clone markers (arrowheads) into the viewport SVG
                    const originalDefs = document.querySelector('.react-flow svg defs');
                    const clonedSvg = clonedDoc.querySelector('svg');
                    if (originalDefs && clonedSvg) {
                        const newDefs = originalDefs.cloneNode(true);
                        clonedSvg.prepend(newDefs);
                    }

                    // Surgical cleanup: ONLY target problematic elements to avoid breaking lines
                    const bgs = clonedDoc.querySelectorAll('.react-flow__edge-textbg');
                    bgs.forEach((el: any) => {
                        el.removeAttribute('filter');
                        el.removeAttribute('mask');
                        el.style.filter = 'none';
                        el.style.fill = '#ffffff';
                        el.style.fillOpacity = '1';
                    });

                    const texts = clonedDoc.querySelectorAll('.react-flow__edge-text');
                    texts.forEach((el: any) => {
                        el.removeAttribute('filter');
                        el.style.filter = 'none';
                    });

                    // Ensure edge paths are visible
                    const paths = clonedDoc.querySelectorAll('.react-flow__edge-path');
                    paths.forEach((el: any) => {
                        el.style.strokeOpacity = '1';
                        el.style.stroke = '#94a3b8';
                        el.style.strokeWidth = '2';
                    });

                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        .react-flow__handle, .react-flow__background, .react-flow__controls, .react-flow__attribution {
                            display: none !important;
                        }
                        .react-flow__node {
                            background: white !important;
                            border: 1px solid #cbd5e1 !important;
                            box-shadow: none !important;
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

            if (type === 'png') {
                const dataUrl = await toPng(flowElement, exportOptions);
                downloadFile(dataUrl, 'png');
            } else {
                const dataUrl = await toSvg(flowElement, exportOptions);
                downloadFile(dataUrl, 'svg');
            }
        },
        resetView: () => {
            fitView({ padding: 0.2 });
        }
    }));

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

    // Sync React Flow state back to currentCode
    useEffect(() => {
        if (!isStreamingCode && nodes.length > 0) {
            const data = { nodes, edges };
            const json = JSON.stringify(data, null, 2);
            if (json !== currentCode) {
                isInternalUpdate.current = true;
                setCurrentCode(json);
            }
        }
    }, [nodes, edges, isStreamingCode]);

    // Update React Flow from currentCode
    useEffect(() => {
        if (currentCode) {
            if (isInternalUpdate.current) {
                isInternalUpdate.current = false;
                return;
            }
            if (isStreamingCode) return; // Wait for tool completion

            try {
                let jsonStr = currentCode;
                const match = currentCode.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) {
                    jsonStr = match[1];
                }
                const data = JSON.parse(jsonStr);
                if (data.nodes && Array.isArray(data.nodes)) {
                    const processedNodes = data.nodes.map((n: any) => ({
                        ...n,
                        type: 'editable',
                        data: {
                            ...n.data,
                            onChange: handleNodeLabelChange
                        }
                    }));
                    setNodes(processedNodes);
                    setEdges(data.edges || []);
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }, [currentCode, isStreamingCode]);

    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
});
