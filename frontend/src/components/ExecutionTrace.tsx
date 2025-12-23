import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { BrainCircuit, Terminal, CheckCircle, ChevronDown, ChevronRight, Activity, Copy, Play, Check } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { Step } from '../types';

interface ExecutionTraceProps {
    steps: Step[];
    messageIndex: number;
}

const StepItem = ({ step, activeAgent, messageIndex, associatedResult }: {
    step: Step;
    activeAgent?: string;
    messageIndex: number;
    associatedResult?: { content: string; index: number };
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { setCurrentCode, setAgent, setActiveStepRef } = useChatStore();

    // Auto-expand when streaming starts, auto-collapse when finished if it's a tool_end/Result
    useEffect(() => {
        if (step.isStreaming) {
            setIsExpanded(true);
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

    // Hide "general" agent selection
    if (step.type === 'agent_select' && (step.name === 'general' || step.name === 'general_agent')) {
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
                ? "bg-purple-50 border-purple-100 text-purple-900"
                : "bg-slate-50 border-slate-100 text-slate-700 ml-4 border-l-2 border-l-slate-300"
        )}>
            <div
                className={cn("flex items-center gap-2 p-2", hasContent && "cursor-pointer hover:bg-black/5")}
                onClick={() => hasContent && setIsExpanded(!isExpanded)}
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
                                    'drawio': 'Draw.io'
                                };
                                return (step.name && labels[step.name]) || step.name || '';
                            })()}
                        </>
                    )}
                    {step.type === 'tool_start' && `Calling: ${step.name}`}
                    {step.type === 'tool_end' && `Result`}
                    {step.isError && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded border border-red-200">
                            Render Failed
                        </span>
                    )}
                    {step.isStreaming && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded border border-blue-200 flex items-center gap-1 inline-flex">
                            <Activity className="w-2.5 h-2.5 animate-pulse" />
                            Streaming...
                        </span>
                    )}
                </div>

                {hasContent && (
                    <div className="text-slate-400">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                )}

                {step.type === 'agent_select' && associatedResult && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeAgent) {
                                setAgent(activeAgent as any);
                            }
                            setActiveStepRef({ messageIndex, stepIndex: associatedResult.index });
                            setCurrentCode(associatedResult.content);
                        }}
                        className="p-1 px-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-all shadow-sm ml-2 cursor-pointer"
                        title="Render Result"
                    >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-bold">Render</span>
                    </button>
                )}
            </div>

            {hasContent && isExpanded && (
                <div className="px-2 pb-2 overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    <div className="bg-white/50 rounded border border-slate-200 overflow-hidden">
                        {/* Toolbar for tool_end */}
                        {step.type === 'tool_end' && (
                            <div className="flex items-center justify-end gap-1 p-1 bg-slate-100 border-b border-slate-200">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(step.content || '');
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
                        <div ref={scrollRef} className="p-2 overflow-y-auto max-h-40 custom-scrollbar">
                            <pre className="text-[10px] leading-tight text-slate-600 whitespace-pre break-words">
                                {formatContent(step.content)}
                            </pre>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export const ExecutionTrace = ({ steps, messageIndex }: ExecutionTraceProps) => {
    // Determine if we should show the block at all (if all steps are hidden 'general', don't show info)
    const hasVisibleSteps = steps.some(s => !(s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')));

    // Default open if active
    const [isOpen, setIsOpen] = useState(true);

    if (!hasVisibleSteps) return null;

    return (
        <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-500 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Process Trace</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">
                        {steps.length}
                    </span>
                </div>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isOpen && (
                <div className="p-2 space-y-2 bg-white">
                    {(() => {
                        let lastAgent: string | undefined;
                        return steps.map((step, idx) => {
                            if (step.type === 'agent_select') {
                                // If name is "general" etc, maybe ignore?
                                // But usually we want to track the explicit agent switching
                                lastAgent = step.name;
                                // Look ahead for associated tool_end (result)
                                let associatedResult = undefined;
                                for (let i = idx + 1; i < steps.length; i++) {
                                    if (steps[i].type === 'agent_select') break; // Search only until next agent
                                    if (steps[i].type === 'tool_end' && steps[i].content) {
                                        associatedResult = { content: steps[i].content!, index: i };
                                        break;
                                    }
                                }
                                return <StepItem key={idx} step={step} activeAgent={lastAgent} messageIndex={messageIndex} associatedResult={associatedResult} />;
                            }
                            return <StepItem key={idx} step={step} activeAgent={lastAgent} messageIndex={messageIndex} />;
                        });
                    })()}
                </div>
            )}
        </div>
    );
};
