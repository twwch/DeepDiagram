import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThinkingPanelProps {
    thought: string;
    isThinking?: boolean;
    defaultExpanded?: boolean;
}

export const ThinkingPanel = ({ thought, isThinking = false, defaultExpanded = true }: ThinkingPanelProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const scrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScroll = useRef(true);

    // Auto-collapse logic when thinking finishes (unchanged)
    useEffect(() => {
        if (!isThinking && thought) {
            const timer = setTimeout(() => {
                setIsExpanded(false);
            }, 2000); // Collapse 2s after thinking ends
            return () => clearTimeout(timer);
        }
        if (isThinking) {
            setIsExpanded(true);
        }
    }, [isThinking, thought]);

    // Auto-scroll logic
    useEffect(() => {
        if (shouldAutoScroll.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [thought, isExpanded]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // If user is within 50px of the bottom, enable auto-scroll. Otherwise disable it.
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        shouldAutoScroll.current = isAtBottom;
    };

    if (!thought) return null;

    return (
        <div className={cn(
            "w-full border-b border-slate-200 bg-slate-50 transition-all duration-500",
            isThinking && "border-purple-200 bg-purple-50/30"
        )}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-100 transition-colors"
                title={isExpanded ? "Collapse thinking process" : "Expand thinking process"}
            >
                <div className="flex items-center gap-2 text-slate-600">
                    <BrainCircuit className={cn("w-4 h-4", isThinking ? "text-purple-600 animate-pulse" : "text-slate-400")} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                        {isThinking ? "Thinking..." : "Thinking Process"}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="p-4 pt-0 text-sm text-slate-600 font-mono whitespace-pre-wrap leading-relaxed border-t border-slate-100/50 shadow-inner overflow-y-auto max-h-[300px] custom-scrollbar"
                >
                    {thought}
                    {isThinking && <span className="inline-block w-2 h-4 ml-1 align-middle bg-purple-500 animate-pulse" />}
                </div>
            </div>
        </div>
    );
};
