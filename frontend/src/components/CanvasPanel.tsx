import { useRef, useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/utils';
import { Download, RotateCcw, RefreshCw } from 'lucide-react';
import { MindmapAgent } from './agents/MindmapAgent';
import { FlowAgent } from './agents/FlowAgent';
import { ChartsAgent } from './agents/ChartsAgent';
import { DrawioAgent } from './agents/DrawioAgent';
import { MermaidAgent } from './agents/MermaidAgent';
import type { AgentRef } from './agents/types';

export const CanvasPanel = () => {
    const [renderKey, setRenderKey] = useState(0);

    // 直接从 store 获取核心状态，确保永远保持最新且一致
    const activeAgent = useChatStore(state => state.activeAgent);
    const activeMessageId = useChatStore(state => state.activeMessageId);
    const allMessages = useChatStore(state => state.allMessages);
    const isLoading = useChatStore(state => state.isLoading);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    const agentRef = useRef<AgentRef>(null);

    // 监听全局画布状态变化，实现瞬时同步
    useEffect(() => {
        const handleStateChange = (e: any) => {
            const state = e.detail;
            // 外部事件主要负责触发强制重绘 (renderKey)
            setRenderKey(state.renderKey || Date.now());
        };

        window.addEventListener('canvas-state-change', handleStateChange);
        return () => window.removeEventListener('canvas-state-change', handleStateChange);
    }, []);

    const handleDownload = async (type: 'png' | 'svg') => {
        if (agentRef.current) {
            await agentRef.current.handleDownload(type);
        }
        setShowDownloadMenu(false);
    };

    const handleResetView = () => {
        if (agentRef.current?.resetView) {
            agentRef.current.resetView();
        }
    };

    const handleRegenerate = () => {
        const { messages, syncToLatest } = useChatStore.getState();
        const allMsgs = useChatStore.getState().allMessages;
        if (allMsgs.length === 0) return;

        // 获取绝对最后一条 assistant 消息
        const assistantMsgs = allMsgs.filter(m => m.role === 'assistant');
        const absoluteLatestMsg = assistantMsgs[assistantMsgs.length - 1];

        // 如果当前活跃消息不是绝对最后一条，则先“回到最新”
        if (absoluteLatestMsg && activeMessageId !== absoluteLatestMsg.id) {
            syncToLatest();
            return;
        }

        // 已经是最新，触发重新生成
        const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant');
        if (lastAssistantIdx !== -1) {
            const actualIdx = messages.length - 1 - lastAssistantIdx;
            window.dispatchEvent(new CustomEvent('deepdiagram-retry', { detail: { index: actualIdx } }));
        }
    };

    const useZoomWrapper = activeAgent === 'flowchart' || activeAgent === 'mindmap';

    return (
        <div className="h-full w-full bg-slate-50 relative flex flex-col overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 w-full h-full overflow-hidden">
                <div className="w-full h-full relative">
                    {/* Toolbar */}
                    <div className="absolute top-4 right-4 z-10 flex flex-row gap-4 items-center p-2">
                        {/* Download Button */}
                        <div className="relative">
                            <button
                                onClick={() => !isLoading && setShowDownloadMenu(!showDownloadMenu)}
                                disabled={isLoading}
                                className={cn(
                                    "transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                                    showDownloadMenu ? "text-blue-600" : "text-slate-700 hover:text-blue-600"
                                )}
                                title="Download"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            {showDownloadMenu && (
                                <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-lg p-1 flex flex-col w-32 z-50" onMouseLeave={() => setShowDownloadMenu(false)}>
                                    <button onClick={() => handleDownload('png')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save PNG</button>
                                    <button onClick={() => handleDownload('svg')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save SVG</button>
                                </div>
                            )}
                        </div>

                        {/* Reset View Button */}
                        {useZoomWrapper && (
                            <button
                                onClick={handleResetView}
                                disabled={isLoading}
                                className="text-slate-700 hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Reset View"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        )}

                        {/* Regenerate Button */}
                        <button
                            onClick={handleRegenerate}
                            disabled={isLoading}
                            className="text-slate-700 hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Regenerate Diagram"
                        >
                            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                        </button>
                    </div>

                    <div className="w-full h-full">
                        {(() => {
                            // 当 activeMessageId 为 null 时（流式期间），回退到最新的 assistant 消息
                            const activeMsg = activeMessageId
                                ? allMessages.find(m => String(m.id) === String(activeMessageId))
                                : allMessages.filter(m => m.role === 'assistant').slice(-1)[0] || null;

                            const getCode = () => {
                                if (!activeMsg) return '';

                                // Mindmap 特殊逻辑：只有 tool_start 后才开始渲染
                                if (activeAgent === 'mindmap') {
                                    const hasToolStart = activeMsg.steps?.some(s => s.type === 'tool_start');
                                    if (!hasToolStart) return '';  // 工具还没开始，不渲染

                                    const streamingStep = [...(activeMsg.steps || [])].reverse().find(s =>
                                        (s.type === 'tool_end' || (s.type === 'tool_start' && s.name === 'Result')) && s.content
                                    );
                                    return streamingStep?.content || '';
                                }

                                // 其他 Agent：仅从已完成的 tool_end 步骤提取
                                const toolEndStep = [...(activeMsg.steps || [])].reverse().find(s =>
                                    s.type === 'tool_end' && s.content && s.status === 'done'
                                );
                                return toolEndStep?.content || '';
                            };
                            const content = getCode();

                            if (activeAgent === 'flowchart') return <FlowAgent key={`flow-${renderKey}`} ref={agentRef} content={content} />;
                            if (activeAgent === 'mindmap') return <MindmapAgent key={`mindmap-${renderKey}`} ref={agentRef} content={content} />;
                            if (activeAgent === 'charts') return <ChartsAgent key={`charts-${renderKey}`} ref={agentRef} content={content} />;
                            if (activeAgent === 'drawio') return <DrawioAgent key={`drawio-${renderKey}`} ref={agentRef} content={content} />;
                            if (activeAgent === 'mermaid') return <MermaidAgent key={`mermaid-${renderKey}`} ref={agentRef} content={content} />;
                            return null;
                        })()}

                        {!activeMessageId && !isLoading && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <p>No diagram generated yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
