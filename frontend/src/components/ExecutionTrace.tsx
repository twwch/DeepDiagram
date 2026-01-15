import React, { useState, useEffect, useRef } from 'react';
import { cn, copyToClipboard, parseMixedContent, type ContentBlock } from '../lib/utils';
import { BrainCircuit, Terminal, CheckCircle, ChevronDown, ChevronRight, Activity, Copy, Play, Check, RotateCcw } from 'lucide-react';
import { ThinkingPanel } from './common/ThinkingPanel';
import { useChatStore } from '../store/chatStore';
import type { Step } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ExecutionTraceProps {
    steps: Step[];
    thoughts?: { content: string; isThinking?: boolean }[];
    messageIndex: number;
    onRetry?: (index: number) => void;
    onSync?: () => void;
}

const StepItem = ({ step, activeAgent, messageIndex, associatedResult, onRetry, onSync }: {
    step: Step;
    activeAgent?: string;
    messageIndex: number;
    associatedResult?: { content: string; index: number };
    onRetry?: (index: number) => void;
    onSync?: () => void;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { setAgent } = useChatStore();

    // Auto-expand when streaming starts, auto-collapse when finished if it's a tool_end/Result
    useEffect(() => {
        if (step.isStreaming) {
            setIsExpanded(true);
        } else if (step.type === 'tool_start' && !step.isStreaming) {
            setIsExpanded(false);
        } else if (step.status === 'done' && step.type === 'tool_end' && step.name === 'Result') {
            // Give the user a moment to see the final result before collapsing
            const timer = setTimeout(() => setIsExpanded(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [step.isStreaming, step.status, step.type, step.name]);

    // Auto-scroll to bottom during streaming
    useEffect(() => {
        if (step.isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [step.content, step.isStreaming]);

    // Hide "general" agent selection and agent_end markers
    if (step.type === 'agent_end' || (step.type === 'agent_select' && (step.name === 'general' || step.name === 'general_agent'))) {
        return null;
    }

    const hasContent = !!step.content;

    const formatContent = (content?: string) => {
        if (!content) return '';
        try {
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return content;
        }
    };

    return (
        <div className={cn(
            "flex flex-col text-xs rounded-lg font-mono border transition-all",
            step.type === 'agent_select'
                ? "bg-purple-50 border-purple-100 text-purple-900 shadow-sm"
                : (step.type === 'tool_end'
                    ? "bg-green-50 border-green-100 text-green-900 ml-4 border-l-2 border-l-green-300 shadow-sm"
                    : "bg-slate-50 border-slate-100 text-slate-700 ml-4 border-l-2 border-l-slate-300")
        )}>
            <div
                className={cn("flex items-center gap-2 p-2", hasContent && "cursor-pointer hover:bg-black/5")}
                onClick={(e) => {
                    e.stopPropagation();
                    if (hasContent) setIsExpanded(!isExpanded);
                }}
            >
                {step.type === 'agent_select' && <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />}
                {step.type === 'tool_start' && <Terminal className="w-3.5 h-3.5 text-blue-600" />}
                {step.type === 'tool_end' && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}

                <div className="flex-1 font-semibold">
                    {step.type === 'agent_select' && (
                        <>
                            Active Agent: {(() => {
                                const labels: Record<string, string> = {
                                    'flowchart': 'Flowchart',
                                    'mindmap': 'Mindmap',
                                    'mermaid': 'Mermaid',
                                    'charts': 'Charts',
                                    'drawio': 'Draw.io',
                                    'infographic': 'Infographic'
                                };
                                return (step.name && labels[step.name]) || step.name || '';
                            })()}
                        </>
                    )}
                    {step.type === 'tool_start' && `Calling: ${(() => {
                        const toolNames: Record<string, string> = {
                            'charts': 'Charts',
                            'create_chart': 'Charts',
                            'infographic': 'Infographic',
                            'generate_infographic': 'Infographic',
                            'mindmap': 'Mindmap',
                            'mindmap_agent': 'Mindmap',
                            'mermaid': 'Mermaid',
                            'mermaids_agent': 'Mermaid',
                            'drawio': 'Draw.io',
                            'drawIO_agent': 'Draw.io',
                            'flowchart': 'Flowchart',
                            'flowchart_agent': 'Flowchart'
                        };
                        return toolNames[step.name || ''] || step.name;
                    })()}`}
                    {step.type === 'tool_end' && `Result`}
                    {step.isError && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded border border-red-200">
                            Render Failed
                        </span>
                    )}
                    {step.isStreaming && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded border border-blue-200 flex items-center gap-1 inline-flex">
                            <Activity className="w-2.5 h-2.5 animate-pulse" />
                            Generating...
                        </span>
                    )}
                </div>

                {hasContent && (
                    <div className="text-slate-400">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                )}

                <div className="flex items-center gap-1.5 ml-2">
                    {step.type === 'agent_select' && associatedResult && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (activeAgent) setAgent(activeAgent as any);
                                if (onSync) onSync();
                            }}
                            className="p-1 px-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-all shadow-sm cursor-pointer"
                        >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="text-[10px] font-bold">Render</span>
                        </button>
                    )}

                    {step.type === 'agent_select' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onRetry) onRetry(messageIndex);
                            }}
                            className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
                            title="Retry this turn"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {hasContent && isExpanded && (
                <div className="px-2 pb-2 overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    {/* Render Content Blocks */}
                    {(() => {
                        const blocks = parseMixedContent(step.content || '');
                        // We also need the raw clean code for the copy button if it's a tool_end
                        const fullCode = blocks.filter((b: ContentBlock) => b.type === 'text').map((b: ContentBlock) => b.content).join('');

                        return (
                            <div className="flex flex-col gap-2">
                                {blocks.map((block: ContentBlock, idx: number) => {
                                    if (block.type === 'thought') {
                                        return (
                                            <div key={idx} className="rounded border border-purple-100 overflow-hidden">
                                                <ThinkingPanel thought={block.content} isThinking={block.isThinking} />
                                            </div>
                                        );
                                    }

                                    // Text Block (Code/Result)
                                    if (!block.content.trim()) return null;

                                    return (
                                        <div key={idx} className="bg-white/50 rounded border border-slate-200 overflow-hidden">
                                            {/* Toolbar for tool_end (Result cards) */}
                                            {step.type === 'tool_end' && idx === blocks.findIndex((b: ContentBlock) => b.type === 'text') && (
                                                <div className="flex items-center justify-end gap-1 p-1 bg-slate-100 border-b border-slate-200">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void copyToClipboard(fullCode);
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }}
                                                        className="p-1 hover:bg-white rounded text-slate-500 hover:text-blue-600 transition-colors"
                                                        title="Copy Code"
                                                    >
                                                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            )}
                                            <div ref={scrollRef} className="p-2 overflow-y-auto max-h-[300px] custom-scrollbar">
                                                {(() => {
                                                    const content = formatContent(block.content);
                                                    const isJson = content !== block.content;

                                                    if (isJson) {
                                                        return (
                                                            <pre className="text-[10px] leading-tight text-slate-700 whitespace-pre break-words font-medium">
                                                                {content}
                                                            </pre>
                                                        );
                                                    }

                                                    return (
                                                        <div className="prose prose-slate prose-sm max-w-none prose-p:my-0 prose-pre:bg-slate-900 prose-pre:text-white prose-table:border-collapse prose-table:border prose-table:border-slate-300 prose-td:border prose-td:border-slate-300 prose-td:p-1 prose-th:border prose-th:border-slate-300 prose-th:p-1 prose-th:bg-slate-100 text-[10px]">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {block.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export const ExecutionTrace = ({ steps, thoughts = [], messageIndex, onRetry, onSync }: ExecutionTraceProps) => {
    // Determine if we should show the block at all
    const visibleSteps = steps.filter(s => {
        if (s.type === 'doc_analysis') return false;
        if (s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')) return false;
        if (s.type === 'agent_end') return false;
        return true;
    });
    const hasVisibleSteps = visibleSteps.length > 0;

    const hasVisibleThoughts = thoughts.some(t => t.content && t.content.trim().length > 0);

    // Default open if active
    const [isOpen, setIsOpen] = useState(true);

    if (!hasVisibleSteps && !hasVisibleThoughts) return null;

    return (
        <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-500 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Process Trace</span>
                </div>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isOpen && (
                <div className="p-2 space-y-2 bg-white">
                    {/* 1. Pre-Router Thoughts (Thought 0) */}
                    {thoughts.length > 0 && (
                        <div className="rounded border border-purple-100 overflow-hidden">
                            <ThinkingPanel thought={thoughts[0].content} isThinking={thoughts[0].isThinking} />
                        </div>
                    )}

                    {(() => {
                        let lastAgent: string | undefined;
                        let lastToolEndIndex = -1;
                        const renderedSteps = [];

                        // Find the last tool_end index
                        for (let idx = steps.length - 1; idx >= 0; idx--) {
                            if (steps[idx].type === 'tool_end') {
                                lastToolEndIndex = idx;
                                break;
                            }
                        }

                        for (let idx = 0; idx < steps.length; idx++) {
                            const step = steps[idx];
                            if (step.type === 'doc_analysis') continue;

                            // Render the step
                            let associatedResult = undefined;
                            if (step.type === 'agent_select') {
                                lastAgent = step.name;
                                for (let i = idx + 1; i < steps.length; i++) {
                                    if (steps[i].type === 'agent_select') break;
                                    if (steps[i].type === 'tool_end' && steps[i].content) {
                                        associatedResult = { content: steps[i].content!, index: i };
                                        break;
                                    }
                                }
                                renderedSteps.push(
                                    <StepItem
                                        key={`step-${idx}`}
                                        step={step}
                                        activeAgent={lastAgent}
                                        messageIndex={messageIndex}
                                        associatedResult={associatedResult}
                                        onRetry={onRetry}
                                        onSync={onSync}
                                    />
                                );
                            } else {
                                renderedSteps.push(
                                    <React.Fragment key={`step-${idx}`}>
                                        <StepItem
                                            step={step}
                                            activeAgent={lastAgent}
                                            messageIndex={messageIndex}
                                            onRetry={onRetry}
                                            onSync={onSync}
                                        />
                                        {/* 2. Post-Tool Execution Thoughts (Thought 1) - Render after last tool_end */}
                                        {idx === lastToolEndIndex && thoughts.length > 1 && (
                                            <div key="thought-1" className="rounded border border-purple-100 overflow-hidden">
                                                <ThinkingPanel thought={thoughts[1].content} isThinking={thoughts[1].isThinking} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            }
                        }
                        return renderedSteps;
                    })()}

                    {/* 3. Catch-all for extra thoughts (Thought 2+) - Rendered OUTSIDE agent block (no indentation) */}
                    {thoughts.slice(2).map((t, i) => (
                        <div key={`thought-extra-${i}`} className="rounded border border-purple-100 overflow-hidden">
                            <ThinkingPanel thought={t.content} isThinking={t.isThinking} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
