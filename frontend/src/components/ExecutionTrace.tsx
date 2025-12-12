import { useState } from 'react';
import { cn } from '../lib/utils';
import { BrainCircuit, Terminal, CheckCircle, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import type { Step } from '../types';

interface ExecutionTraceProps {
    steps: Step[];
}

const StepItem = ({ step }: { step: Step }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Hide "general" agent selection
    if (step.type === 'agent_select' && (step.name === 'general' || step.name === 'general_agent')) {
        return null;
    }

    const hasContent = !!step.content;

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
                    {step.type === 'agent_select' && `Active Agent: ${step.name}`}
                    {step.type === 'tool_start' && `Calling: ${step.name}`}
                    {step.type === 'tool_end' && `Result`}
                </div>

                {hasContent && (
                    <div className="text-slate-400">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                )}
            </div>

            {hasContent && isExpanded && (
                <div className="px-2 pb-2 overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    <div className="bg-white/50 rounded border border-slate-200 p-2 overflow-x-auto">
                        <pre className="text-[10px] leading-tight text-slate-600 whitespace-pre-wrap break-all">
                            {step.content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ExecutionTrace = ({ steps }: ExecutionTraceProps) => {
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
                    {steps.map((step, idx) => (
                        <StepItem key={idx} step={step} />
                    ))}
                </div>
            )}
        </div>
    );
};
