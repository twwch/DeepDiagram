import { useEffect, useRef, useState } from 'react';
import {
    Sparkles, ChevronDown, ChevronUp, Loader2, Workflow, Network,
    Code2, BarChart3, PenTool, Brain, Send, Paperclip, X, FileText,
    Settings, Command, Square, Copy, Check, RotateCcw, Zap, Github,
    Plus, History as HistoryIcon, MessageSquare, Trash2, AlertCircle,
    ChevronRight, ChevronLeft
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsModal } from './common/SettingsModal';
import { useChatStore } from '../store/chatStore';
import type { Step, Message, DocAnalysisBlock } from '../types';
import { cn, copyToClipboard, parseMixedContent } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExecutionTrace } from './ExecutionTrace';

const AGENTS = [
    {
        id: 'flowchart',
        label: 'Flowchart',
        description: 'Architect logic with intelligent auto-layout. Transform complex workflows into clear, readable diagrams with optimized edge routing.',
        features: ['Logic flows', 'Step-by-step processes', 'Conditional routing'],
        icon: Workflow,
        color: 'indigo',
        demoInput: '@flowchart A 5-level deep mindmap of Artificial Intelligence covering History, Technical Pillars (ML/DL/NLP), Ethics & Society, and Future Horizons like AGI.'
    },
    {
        id: 'mindmap',
        label: 'Mindmap',
        description: 'Infinite canvas for visual thinking. Map out hierarchical structures, brainstorm ideas, and organize messy concepts into clean, expandable trees.',
        features: ['Idea mapping', 'Knowledge structure', 'Brainstorming'],
        icon: Network,
        color: 'amber',
        demoInput: '@mindmap plan a marketing strategy for a new coffee shop.'
    },
    {
        id: 'mermaid',
        label: 'Mermaid',
        description: 'Industrial-strength text-to-diagram engine. Generate Sequence, Gantt, Class, and ER diagrams using clean Markdown-inspired syntax.',
        features: ['Sequence diagrams', 'Gantt charts', 'Text-to-visual'],
        icon: Code2,
        color: 'emerald',
        demoInput: '@mermaid a comprehensive sequence diagram for a distributed OAuth2.0 authentication flow involving Client, Auth Server, and Resource Server.'
    },
    {
        id: 'charts',
        label: 'Charts',
        description: 'Professional data storytelling. Convert raw data into interactive Bar, Line, Pie, and Gauge charts with sleek animations and responsive designs.',
        features: ['Data visualization', 'Dashboard metrics', 'Trend analysis'],
        icon: BarChart3,
        color: 'rose',
        demoInput: '@charts a professional dashboard with a 12-month revenue trend line including area gradients, and a bar chart comparing sales performance across 5 regions.'
    },
    {
        id: 'drawio',
        label: 'Draw.io',
        description: 'The ultimate canvas for precision engineering. Design cloud architectures, network topologies, and blueprint-level technical diagrams.',
        features: ['Cloud architecture', 'Network topology', 'Professional drafting'],
        icon: PenTool,
        color: 'blue',
        demoInput: '@drawio a professional cloud architecture diagram for a global e-commerce platform using AWS (VPC, Route53, ELB, AutoScaling, RDS, and CloudFront).'
    },
    {
        id: 'infographic',
        label: 'Infographic',
        description: 'Advanced data storytelling. Create professional infographics, data posters, and visual summaries with creative layouts and rich components.',
        features: ['Data posters', 'Visual storytelling', 'Creative layouts'],
        icon: BarChart3,
        color: 'violet',
        demoInput: '@infographic a visually stunning horizontal timeline of the Industrial Revolutions, from Steam Power to Industry 4.0, using professional icons and descriptions.'
    },
];

const DocAnalysisCard = ({ block }: { block: DocAnalysisBlock }) => {
    const [isExpanded, setIsExpanded] = useState(block.status === 'running');

    useEffect(() => {
        if (block.status === 'done') {
            const timer = setTimeout(() => setIsExpanded(false), 500); // 0.5s delay for smooth transition
            return () => clearTimeout(timer);
        }
    }, [block.status]);

    // Support both <thinking> and <think> tags
    // 1. Try to match complete tags first
    const completeThinkingMatch = block.content.match(/<(thinking|think)>([\s\S]*?)<\/(thinking|think)>/i);

    let thinking: string | undefined;
    let displayContent = block.content;

    if (completeThinkingMatch) {
        thinking = completeThinkingMatch[2];
        displayContent = block.content.replace(/<(thinking|think)>([\s\S]*?)<\/(thinking|think)>/gi, '').trim();
    } else {
        // 2. Check for incomplete/streaming tags at the start
        const startMatch = block.content.match(/^<(thinking|think)>([\s\S]*)/i);
        if (startMatch) {
            thinking = startMatch[2];
            displayContent = ''; // Hide everything else as it is part of thinking
        }
    }

    const getTitle = () => {
        if (block.index === -1) return "Final Comprehensive Synthesis";
        return `Detailed Analysis Chunk #${block.index + 1} `;
    };

    return (
        <div className="mb-3 overflow-hidden border border-blue-100/50 bg-blue-50/30 rounded-xl transition-all shadow-sm">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50/50 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "p-1.5 rounded-lg",
                        block.status === 'running' ? "bg-blue-100 text-blue-600 animate-pulse" : "bg-green-100 text-green-600"
                    )}>
                        {block.status === 'running' ? <Loader2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            {getTitle()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                            {block.status === 'running' ? 'Processing insights...' : 'Analysis complete'}
                        </span>
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-blue-50/50 animate-in fade-in slide-in-from-top-2 duration-300 max-h-64 overflow-y-auto custom-scrollbar">
                    {thinking && (
                        <div className="mt-3 p-3 bg-slate-100/50 rounded-lg border border-slate-200/50 italic text-[11px] text-slate-500 leading-relaxed">
                            <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
                                <Brain className="w-3 h-3" />
                                <span className="font-bold uppercase tracking-widest text-[9px]">Reasoning Process</span>
                            </div>
                            {thinking}
                        </div>
                    )}
                    <div className="prose prose-slate prose-sm max-w-none text-xs leading-relaxed mt-3 prose-p:my-1 prose-headings:text-slate-700 prose-headings:font-bold prose-headings:mb-1 prose-headings:mt-3 first:prose-headings:mt-0">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse" {...props} />
                                    </div>
                                ),
                                thead: ({ node, ...props }) => <thead className="bg-slate-50 text-slate-700 font-semibold" {...props} />,
                                th: ({ node, ...props }) => <th className="px-3 py-2 border-b border-slate-200 whitespace-nowrap" {...props} />,
                                td: ({ node, ...props }) => <td className="px-3 py-2 border-b border-slate-100" {...props} />,
                                code: ({ node, className, children, ...props }) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match && !String(children).includes('\n');

                                    if (isInline) {
                                        return (
                                            <code
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-slate-100 rounded px-1.5 py-0.5 text-slate-800 break-words font-mono text-[11px] border border-slate-200"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }

                                    return (
                                        <code
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn("font-mono text-xs", className)}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                },
                                pre: ({ node, children, ...props }) => (
                                    <div className="relative group my-3">
                                        <pre
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-[#1e1e1e] text-slate-50 p-3 rounded-lg overflow-x-auto text-xs custom-scrollbar border border-slate-700/50 shadow-sm"
                                            {...props}
                                        >
                                            {children}
                                        </pre>
                                    </div>
                                )
                            }}
                        >
                            {displayContent}
                        </ReactMarkdown>
                    </div>
                    {block.status === 'running' && (
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-blue-500 font-medium animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Streaming...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ChatPanel = () => {
    const {
        messages,
        input,
        setInput,
        isLoading,
        addMessage,
        setLoading,
        updateLastMessage,
        sessionId,
        setSessionId,
        setAgent,
        inputImages,
        addInputImage,
        setInputImages,
        clearInputImages,
        addStepToLastMessage,
        updateLastStepContent,
        setStreamingCode,
        toast,
        clearToast,
        sessions,
        allMessages,
        loadSessions,
        selectSession,
        createNewChat,
        deleteSession,
        switchMessageVersion,
        activeMessageId,
        setActiveMessageId,
        handleSync,
        inputFiles,
        addInputFile,
        setInputFiles,
        clearInputFiles,
        setParsingStatus,
        parsingStatus,
    } = useChatStore();

    const isPagingRef = useRef(false);

    // Auto-clear toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => clearToast(), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, clearToast]);


    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const historyRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const { models, activeModelId, setActiveModelId, hasShownRecommendation, setHasShownRecommendation } = useSettingsStore();
    const activeModel = models.find(m => m.id === activeModelId);
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [concurrency, setConcurrency] = useState(3);
    const modelSelectorRef = useRef<HTMLDivElement>(null);

    // Close model selector when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
                setIsModelSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Show recommendation if no models configured
    useEffect(() => {
        if (models.length === 0 && !hasShownRecommendation) {
            const timer = setTimeout(() => {
                setShowRecommendation(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [models.length, hasShownRecommendation]);

    const handleCloseRecommendation = () => {
        setShowRecommendation(false);
        setHasShownRecommendation(true);
    };

    const handleCopy = (msg: Message, index: number) => {
        let textToCopy = msg.content;
        if (!textToCopy.trim() && msg.steps) {
            textToCopy = msg.steps
                .filter((s: Step) => !!s.content)
                .map((s: Step) => {
                    const prefix = s.type === 'tool_start' ? 'Calling ' + (s.name || '') + ': ' : s.type === 'tool_end' ? 'Result: ' : '';
                    return prefix + (s.content || '') + ' ';
                })
                .join('\n\n');
        }
        if (textToCopy) {
            void copyToClipboard(textToCopy);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    const handleRetry = (index: number, errorMessage?: string) => {
        if (isLoading) return;
        const msgs = [...messages];
        let retryPrompt = '';
        let retryImages: string[] = [];
        let parentId: number | null | undefined = undefined;

        if (msgs[index].role === 'user') {
            retryPrompt = msgs[index].content;
            retryImages = msgs[index].images || [];
            parentId = msgs[index].parent_id ?? null;
        } else {
            for (let i = index - 1; i >= 0; i--) {
                if (msgs[i].role === 'user') {
                    retryPrompt = msgs[i].content;
                    retryImages = msgs[i].images || [];
                    parentId = msgs[i].id ?? null; // Ensure we don't pass undefined
                    break;
                }
            }
        }
        if (retryPrompt || retryImages.length > 0) {
            // We don't slice history anymore to support linear versioning
            // The logic will be handled by Turn Index and Version switching
            const isAssistantRetry = msgs[index].role === 'assistant';
            void triggerSubmit(retryPrompt, retryImages, parentId, isAssistantRetry, errorMessage);
        }
    };

    // Listen for cross-component retry requests (e.g. from Canvas)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const index = detail?.index;
            const error = detail?.error;
            if (typeof index === 'number') {
                handleRetry(index, error);
            }
        };
        window.addEventListener('deepdiagram-retry', handler);
        return () => window.removeEventListener('deepdiagram-retry', handler);
    }, [messages, isLoading]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        void loadSessions();
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                if (file.type.startsWith('image/')) {
                    addInputImage(base64);
                } else {
                    addInputFile({ name: file.name, data: base64 });
                }
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        const newFiles = [...inputFiles];
        newFiles.splice(index, 1);
        setInputFiles(newFiles);
    };

    const removeImage = (index: number) => {
        const newImages = [...inputImages];
        newImages.splice(index, 1);
        setInputImages(newImages);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64String = reader.result as string;
                        addInputImage(base64String);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        shouldAutoScrollRef.current = isAtBottom;
    };

    useEffect(() => {
        if (isPagingRef.current) {
            isPagingRef.current = false;
            return;
        }

        // Auto-scroll only if strictly at bottom or if it's a new user message (length changed effectively)
        // But for streaming updates (same length, content changed), respect user scroll position.
        // Simple heuristic: rely on shouldAutoScrollRef which tracks user intention
        if (shouldAutoScrollRef.current) {
            scrollToBottom();
        }
    }, [messages]);

    // Force scroll to bottom when starting a new generation (user sent message)
    useEffect(() => {
        if (isLoading) {
            shouldAutoScrollRef.current = true;
            scrollToBottom();
        }
    }, [isLoading]);


    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)} px`;
        }
    }, [input]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);

        const lastWord = val.split(' ').pop();
        if (lastWord && lastWord.startsWith('@')) {
            setShowMentions(true);
            setMentionFilter(lastWord.substring(1).toLowerCase());
        } else {
            setShowMentions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void triggerSubmit();
        }
    };

    // Called by Popup Menu: Replaces partial mention
    const selectAgent = (agentId: string) => {
        const words = input.split(' ');
        words.pop();
        const newInput = words.join(' ') + (words.length > 0 ? ' ' : '') + '@' + agentId + ' ';

        setInput(newInput);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    // Called by Toolbar Chips: Prepends or Updates existing tag
    const toggleAgentTag = (agentId: string) => {
        let newInput = input;
        const tagRegex = /^@[a-zA-Z0-9_\.]+\s?/;
        const match = newInput.match(tagRegex);

        if (match) {
            // Check if it's the same agent. Note: match includes trailing space if present
            // We compare against '@agentId' (trimmed) to be safe
            if (match[0].trim() === '@' + agentId) {
                // If same, remove it (toggle off)
                newInput = newInput.replace(tagRegex, '');
            } else {
                // If different, replace it
                newInput = newInput.replace(tagRegex, '@' + agentId + ' ');
            }
        } else {
            // No tag, prepend it
            newInput = '@' + agentId + ' ' + newInput;
        }

        setInput(newInput);
        inputRef.current?.focus();
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setLoading(false);
            setStreamingCode(false);
        }
    };

    const triggerSubmit = async (customPrompt?: string, customImages?: string[], parentId?: number | null, isRetry?: boolean, errorMessage?: string) => {
        let promptToUse = customPrompt ?? input;
        const imagesToUse = customImages ?? [...inputImages];
        const filesToUse = [...inputFiles];

        if (errorMessage) {
            promptToUse += `\n\n[System Note: The previous diagram generation failed to render with the following error.Please fix the syntax: ${errorMessage}]`;
        }

        if ((!promptToUse.trim() && imagesToUse.length === 0 && filesToUse.length === 0) || isLoading) return;

        if (!customPrompt) {
            setInput('');
            setShowMentions(false);
            clearInputImages();
            clearInputFiles();
        }
        setParsingStatus(null);
        // Content will be derived from messages list
        setStreamingCode(false); // Reset streaming state

        const currentMessages = useChatStore.getState().messages;
        const allMessages = useChatStore.getState().allMessages;
        const effectiveParentId = parentId ?? (currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : null);

        // Calculate Turn Index
        let parentTurn = -1;
        if (effectiveParentId) {
            const pm = allMessages.find(m => m.id === effectiveParentId);
            if (pm) parentTurn = pm.turn_index ?? -1;
        }

        const timestamp = Date.now();
        if (!isRetry) {
            const userTurn = parentTurn + 1;
            const assistantTurn = userTurn + 1;
            // Use negative IDs for temporary local messages to ensure they are trackable
            const tempUserId = -timestamp;
            const tempAssistantId = -(timestamp + 1);

            addMessage({ id: tempUserId, role: 'user', content: promptToUse, images: imagesToUse, files: filesToUse, parent_id: effectiveParentId ?? null, turn_index: userTurn, created_at: new Date().toISOString() });
            setLoading(true);
            // Link to parent locally if possible, or leave as null for backend to link
            addMessage({ id: tempAssistantId, role: 'assistant', content: '', parent_id: effectiveParentId ?? null, turn_index: assistantTurn, steps: [], created_at: new Date().toISOString() });
            setActiveMessageId(tempAssistantId);
        } else {
            const assistantTurn = parentTurn + 1;
            const tempAssistantId = -timestamp;

            setLoading(true);
            addMessage({ id: tempAssistantId, role: 'assistant', content: '', parent_id: parentId ?? null, turn_index: assistantTurn, steps: [], created_at: new Date().toISOString() });
            setActiveMessageId(tempAssistantId);
        }

        if (!customPrompt) {
            setInput('');
            setShowMentions(false);
            clearInputImages();
            clearInputFiles();
        }
        setParsingStatus(null);

        let thoughtBuffer = "";
        let toolArgsBuffer = "";

        // Create new AbortController
        abortControllerRef.current = new AbortController();

        console.log('--- SUBMIT DEBUG ---');
        console.log('Active Model ID:', activeModelId);
        console.log('Active Model found:', !!activeModel);
        if (activeModel) {
            console.log('Model ID:', activeModel.modelId);
            console.log('Base URL:', activeModel.baseUrl);
        }
        console.log('--------------------');

        try {
            const response = await fetch('/api/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptToUse,
                    images: imagesToUse,
                    session_id: sessionId,
                    context: {},
                    parent_id: effectiveParentId,
                    is_retry: isRetry,
                    concurrency: concurrency,
                    model_id: activeModel?.modelId,
                    api_key: activeModel?.apiKey,
                    base_url: activeModel?.baseUrl,
                    files: filesToUse
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) return;

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // stream: true handles multi-byte characters split across chunks
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');

                // The last part is either empty (if ending in \n\n) or incomplete
                // Keep it in the buffer for the next iteration
                buffer = parts.pop() || '';

                for (const line of parts) {
                    if (!line.trim()) continue;

                    const eventMatch = line.match(/event: (.*)\ndata: (.*)/);
                    if (eventMatch) {
                        const eventName = eventMatch[1].trim();
                        const dataStr = eventMatch[2].trim();

                        try {
                            const data = JSON.parse(dataStr);
                            const eventSessionId = data.session_id;

                            // 1. Session created is special - it sets the current session
                            if (eventName === 'session_created') {
                                setSessionId(data.session_id);
                                void loadSessions();
                                continue;
                            }

                            // 2.5 Handle status updates
                            if (eventName === 'status') {
                                setParsingStatus(data.content);
                                continue;
                            }

                            // 2. Filter other events by session ID if present
                            if (eventSessionId && eventSessionId !== useChatStore.getState().sessionId) {
                                console.warn(`Ignoring event for session ${eventSessionId}(current: ${useChatStore.getState().sessionId})`);
                                continue;
                            }

                            // 3. Dispatch events
                            switch (eventName) {
                                case 'message_created':
                                    useChatStore.setState((state) => {
                                        const allMsgs = [...state.allMessages];
                                        // Match by role AND (no ID OR temp ID < 0)
                                        const targetIdx = allMsgs.findIndex(m => m.role === data.role && (!m.id || m.id < 0));
                                        if (targetIdx !== -1) {
                                            const oldId = allMsgs[targetIdx].id;
                                            const updatedMsg = {
                                                ...allMsgs[targetIdx],
                                                id: data.id,
                                                turn_index: data.turn_index !== undefined ? data.turn_index : allMsgs[targetIdx].turn_index
                                            };
                                            allMsgs[targetIdx] = updatedMsg;

                                            // Atomic update of parent_id references
                                            const finalMsgs = allMsgs.map(m => {
                                                if (m.parent_id === oldId && oldId !== undefined) {
                                                    return { ...m, parent_id: data.id };
                                                }
                                                return m;
                                            });

                                            let activeId = state.activeMessageId;
                                            if (data.role === 'assistant') {
                                                activeId = data.id;
                                            }

                                            const turn = updatedMsg.turn_index ?? 0;
                                            const newSelectedVersions = { ...state.selectedVersions, [turn]: data.id };

                                            // Rebuild messages list
                                            const turnMap: Record<number, Message[]> = {};
                                            finalMsgs.forEach(m => {
                                                const t = m.turn_index || 0;
                                                if (!turnMap[t]) turnMap[t] = [];
                                                turnMap[t].push(m);
                                            });

                                            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                                            const newMessages: Message[] = [];
                                            sortedTurns.forEach(t => {
                                                const siblings = turnMap[t];
                                                const selectedId = newSelectedVersions[t];
                                                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                                                newMessages.push(selected);
                                            });

                                            return {
                                                allMessages: finalMsgs,
                                                messages: newMessages,
                                                selectedVersions: newSelectedVersions,
                                                activeMessageId: activeId
                                            };
                                        }
                                        return {};
                                    });
                                    break;

                                case 'agent_selected':
                                    setAgent(data.agent);
                                    addStepToLastMessage({
                                        type: 'agent_select',
                                        name: data.agent,
                                        status: 'done',
                                        timestamp: Date.now()
                                    }, eventSessionId);
                                    break;

                                case 'tool_start':
                                    const stateTool = useChatStore.getState();
                                    const lastMsgTool = stateTool.allMessages[stateTool.allMessages.length - 1];
                                    const lastStepTool = lastMsgTool?.steps?.[lastMsgTool.steps.length - 1];
                                    const toolInput = JSON.stringify(data.input) || '';

                                    // Helper for robust JSON comparison
                                    const isEqualJson = (a?: string, b?: string) => {
                                        if (a === b) return true;
                                        if (!a || !b) return false;
                                        try {
                                            const pa = JSON.parse(a);
                                            const pb = JSON.parse(b);
                                            return JSON.stringify(pa) === JSON.stringify(pb);
                                        } catch {
                                            return a.trim() === b.trim();
                                        }
                                    };

                                    // 1. Aggressive Dedup & Merging
                                    if (lastStepTool) {
                                        const isIdentical = isEqualJson(lastStepTool.content, toolInput);
                                        const isGenericPrecursor = lastStepTool.type === 'tool_start' &&
                                            (lastStepTool.name === 'charts' || lastStepTool.name === 'infographic' ||
                                                lastStepTool.content === '{}' || !lastStepTool.content || lastStepTool.name === '');

                                        if (lastStepTool.type === 'tool_start' && (isIdentical || isGenericPrecursor)) {
                                            toolArgsBuffer = "";
                                            useChatStore.getState().replaceLastStep({
                                                type: 'tool_start',
                                                name: data.tool,
                                                content: toolInput,
                                                status: 'done',
                                                isStreaming: false,
                                                timestamp: Date.now()
                                            }, eventSessionId);
                                            break;
                                        }
                                    }

                                    if (lastStepTool?.isStreaming) {
                                        updateLastStepContent(lastStepTool.content || '', false, 'done', lastStepTool.type, false, eventSessionId);
                                    }

                                    toolArgsBuffer = "";
                                    addStepToLastMessage({
                                        type: 'tool_start',
                                        name: data.tool,
                                        content: toolInput,
                                        status: 'done',
                                        timestamp: Date.now(),
                                        isStreaming: false
                                    }, eventSessionId);
                                    break;

                                case 'thought':
                                    if (data.content) {
                                        thoughtBuffer += data.content;
                                        updateLastMessage(thoughtBuffer, true, 'running', eventSessionId, true);
                                    }
                                    break;

                                case 'tool_code':
                                    if (data.content) {
                                        setStreamingCode(true);
                                        const stateCode = useChatStore.getState();
                                        const lastMsgCode = stateCode.allMessages[stateCode.allMessages.length - 1];
                                        const lastStepCode = lastMsgCode?.steps?.[lastMsgCode.steps.length - 1];

                                        const isLastStepResult = lastStepCode?.type === 'tool_end' && lastStepCode.name === 'Result';

                                        if (!isLastStepResult) {
                                            if (lastStepCode?.isStreaming) {
                                                updateLastStepContent(lastStepCode.content || '', false, 'done', lastStepCode.type, false, eventSessionId);
                                            }

                                            addStepToLastMessage({
                                                type: 'tool_end',
                                                name: 'Result',
                                                content: '',
                                                status: 'running',
                                                timestamp: Date.now(),
                                                isStreaming: true
                                            }, eventSessionId);
                                        }
                                        updateLastStepContent(data.content, true, 'running', 'tool_end', true, eventSessionId);
                                    }
                                    break;

                                case 'tool_args_stream':
                                    if (data.args) {
                                        const stateArgs = useChatStore.getState();
                                        const lastMsgArgs = stateArgs.allMessages[stateArgs.allMessages.length - 1];
                                        const lastStepArgs = lastMsgArgs?.steps?.[lastMsgArgs.steps.length - 1];

                                        if (!lastStepArgs || lastStepArgs.type !== 'tool_start') {
                                            addStepToLastMessage({
                                                type: 'tool_start',
                                                name: '',
                                                content: '',
                                                status: 'running',
                                                timestamp: Date.now(),
                                                isStreaming: true
                                            }, eventSessionId);
                                            toolArgsBuffer = "";
                                        }

                                        toolArgsBuffer += data.args;
                                        updateLastStepContent(toolArgsBuffer, true, 'running', 'tool_start', false, eventSessionId);
                                    }
                                    break;

                                case 'tool_end':
                                    setStreamingCode(false);
                                    const stateEnd = useChatStore.getState();
                                    const lastMsgEnd = stateEnd.allMessages[stateEnd.allMessages.length - 1];
                                    const lastStepEnd = lastMsgEnd?.steps?.[lastMsgEnd.steps.length - 1];

                                    if (lastStepEnd?.isStreaming) {
                                        let finalContent = data.output || lastStepEnd.content || '';
                                        if (lastStepEnd.type === 'tool_end' && lastStepEnd.content) {
                                            finalContent = lastStepEnd.content;
                                        }
                                        updateLastStepContent(finalContent, false, 'done', lastStepEnd.type, false, eventSessionId);
                                    }
                                    break;

                                case 'doc_analysis_start':
                                    // No-op or init logic if needed
                                    break;

                                case 'doc_analysis_chunk':
                                    if (data.content !== undefined) {
                                        // Use status from backend event, default to 'running'
                                        const status = data.status || 'running';
                                        // Change false to true to APPEND streaming content
                                        useChatStore.getState().updateDocAnalysisBlock(data.index, data.content, status, true, eventSessionId);
                                    }
                                    break;

                                case 'doc_analysis_end':
                                    if (data.content) {
                                        // Final synthesized context can be updated if we want to show it as a special block
                                        // or just mark all existing blocks as done.
                                        // For now, let's just mark the synthesis (index -1) as done.
                                        useChatStore.getState().updateDocAnalysisBlock(-1, data.content, 'done', false, eventSessionId);
                                    }
                                    break;

                                case 'error':
                                    updateLastMessage(data.message, false, 'error', eventSessionId);
                                    break;
                            }
                        } catch (jsonErr) {
                            console.error("JSON Parse error", jsonErr, dataStr);
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Submit error:', error);
                reportError(error instanceof Error ? error.message : 'Unknown error');
            }
        } finally {
            setLoading(false);
            setStreamingCode(false);
            setParsingStatus(null);
            abortControllerRef.current = null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        void triggerSubmit();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            DeepDiagram AI
                        </h1>
                        <a
                            href="https://github.com/twwch/DeepDiagram"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-full hover:bg-slate-100 text-slate-950 transition-colors"
                            title="View on GitHub"
                        >
                            <Github className="w-5 h-5 fill-current" />
                        </a>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Describe what you want to create or upload an image.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all hover:text-blue-600 shadow-sm"
                        title="Model Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            stopGeneration();
                            createNewChat();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Chat</span>
                    </button>

                    {/* History Dropdown */}
                    <div className="relative" ref={historyRef}>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                                showHistory
                                    ? "bg-slate-100 border-slate-300 text-slate-800"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                        >
                            <HistoryIcon className="w-3.5 h-3.5" />
                            <span>History</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showHistory && "rotate-180")} />
                        </button>

                        {showHistory && (
                            <div className="absolute right-0 mt-2 w-80 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Recent Chats</span>
                                    <HistoryIcon className="w-3 h-3 text-slate-300" />
                                </div>
                                <div className="max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                                    {sessions.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            No chat history yet
                                        </div>
                                    ) : (
                                        sessions.map((session) => (
                                            <div
                                                key={session.id}
                                                className={cn(
                                                    "group flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/50 text-left transition-all cursor-pointer",
                                                    sessionId === session.id ? "bg-blue-50/80 border-blue-100" : "transparent"
                                                )}
                                                onClick={() => {
                                                    stopGeneration();
                                                    void selectSession(session.id);
                                                    setShowHistory(false);
                                                }}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg transition-colors",
                                                    sessionId === session.id ? "bg-blue-100/50 text-blue-600" : "bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-blue-500"
                                                )}>
                                                    <MessageSquare className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn(
                                                        "text-sm font-semibold truncate",
                                                        sessionId === session.id ? "text-blue-700" : "text-slate-700 group-hover:text-blue-700"
                                                    )}>
                                                        {session.title || "New Chat"}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {new Date(session.updated_at).toLocaleDateString()} • {new Date(session.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void deleteSession(session.id);
                                                    }}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete chat"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Toast */}
            {toast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-full shadow-lg text-sm font-medium">
                        <AlertCircle className="w-4 h-4" />
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}


            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-6"
            >
                {isLoading && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[600px] text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                        <p className="text-sm font-medium">Loading chat history...</p>
                    </div>
                ) : messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center min-h-[600px] text-slate-400 space-y-12 py-20 relative overflow-hidden">
                        {/* Mesh Gradient Background Decorative Elements */}
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-[100px] -z-10 animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -z-10" />

                        <div className="flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                                <div className="relative p-5 bg-white rounded-2xl shadow-2xl border border-slate-100 flex items-center justify-center">
                                    <Send className="w-10 h-10 text-blue-600 animate-bounce" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text">
                                    Design Your Vision
                                </h2>
                                <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                                    Unlock professional diagrams with AI-powered consulting.
                                    Select a showcase below to begin.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl w-full px-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                            {AGENTS.map((agent) => {
                                const colorMap: Record<string, string> = {
                                    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white',
                                    amber: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-600 group-hover:text-white',
                                    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
                                    rose: 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-600 group-hover:text-white',
                                    blue: 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white',
                                    violet: 'bg-violet-50 text-violet-600 border-violet-100 group-hover:bg-violet-600 group-hover:text-white',
                                };
                                const accentMap: Record<string, string> = {
                                    indigo: 'text-indigo-600',
                                    amber: 'text-amber-600',
                                    emerald: 'text-emerald-600',
                                    rose: 'text-rose-600',
                                    blue: 'text-blue-600',
                                    violet: 'text-violet-600',
                                };

                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => {
                                            if (agent.demoInput) {
                                                void triggerSubmit(agent.demoInput);
                                            }
                                        }}
                                        className="group relative flex flex-col text-left p-6 bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-500 active:scale-[0.98] overflow-hidden min-h-[220px]"
                                    >
                                        <div className="absolute top-0 right-0 p-8 -mr-8 -mt-8 bg-gradient-to-br from-white/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                        <div className="flex items-center gap-4 mb-5">
                                            <div className={cn(
                                                "p-3 rounded-2xl border transition-all duration-500 shrink-0",
                                                colorMap[agent.color || 'blue']
                                            )}>
                                                <agent.icon className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-slate-800 text-lg truncate">{agent.label}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Consultant Agent</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 flex-1">
                                            <p className="text-xs text-slate-500 group-hover:text-slate-700 leading-relaxed italic border-l-2 border-slate-100 pl-3 transition-colors line-clamp-4">
                                                "{agent.demoInput?.replace(`@${agent.id} `, '')}"
                                            </p>
                                        </div>

                                        <div className="mt-6 flex items-center justify-between">
                                            <div className="flex gap-1">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-blue-300 transition-colors" />
                                                ))}
                                            </div>
                                            <div className={cn(
                                                "flex items-center gap-2 text-xs font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500",
                                                accentMap[agent.color || 'blue']
                                            )}>
                                                <span>Initialize</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] animate-pulse">
                            Powered by DeepDiagram Advanced Orchestration
                        </div>
                    </div>
                )}
                {messages.map((msg, idx) => {
                    const switchVersion = (e: React.MouseEvent, msg: Message, delta: number) => {
                        e.stopPropagation(); // 防止点击穿透
                        if (isLoading) return; // Prevent switching while loading
                        const turnIndex = msg.turn_index || 0;
                        const siblings = allMessages.filter(m => (m.turn_index || 0) === turnIndex && m.role === msg.role);
                        if (siblings.length <= 1) return;

                        const currentIdx = siblings.findIndex(s => s.id === msg.id);
                        if (currentIdx === -1) return;

                        const nextIdx = (currentIdx + delta + siblings.length) % siblings.length;
                        const targetId = siblings[nextIdx].id;
                        if (targetId) {
                            isPagingRef.current = true;
                            switchMessageVersion(targetId);
                        }
                    };

                    const getVersionInfo = (msg: Message) => {
                        const turnIndex = msg.turn_index || 0;
                        const siblings = allMessages.filter(m => (m.turn_index || 0) === turnIndex && m.role === msg.role);
                        if (siblings.length <= 1) return null;
                        const currentIdx = siblings.findIndex(s => s.id === msg.id);
                        return { current: currentIdx + 1, total: siblings.length };
                    };

                    const versionInfo = msg.role === 'assistant' ? getVersionInfo(msg) : null;
                    const isGenerating = msg.role === 'assistant' && isLoading && (
                        (activeMessageId !== null && msg.id === activeMessageId) ||
                        (activeMessageId === null && !msg.id && idx === messages.map(m => m.id === undefined && m.role === 'assistant').lastIndexOf(true))
                    );
                    const hasVisibleSteps = msg.steps && msg.steps.some(s => !(s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')));
                    const hasContent = (msg.content || '').trim() || hasVisibleSteps || (msg.images && msg.images.length > 0) || (msg.files && msg.files.length > 0) || msg.error;

                    if (msg.role === 'assistant' && !hasContent && !isGenerating && !versionInfo) {
                        return null;
                    }

                    return (
                        <div key={msg.id || idx} className={cn(
                            "flex flex-col group",
                            msg.role === 'user' ? "items-end" : "items-start"
                        )}>
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl p-4 shadow-sm relative transition-all duration-300",
                                    msg.role === 'user'
                                        ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none"
                                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100/50 hover:shadow-md hover:border-blue-100/50"
                                )}
                            >
                                {msg.docAnalysisBlocks && msg.docAnalysisBlocks.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {msg.docAnalysisBlocks.map((block) => (
                                            <DocAnalysisCard key={block.index} block={block} />
                                        ))}
                                    </div>
                                )}
                                {(() => {
                                    const blocks = parseMixedContent(msg.content);
                                    const thoughtBlocks = blocks.filter(b => b.type === 'thought').map(b => ({ content: b.content, isThinking: b.isThinking }));
                                    const otherBlocks = blocks.filter(b => b.type !== 'thought');

                                    // Strict check: Only show trace if there are actual steps or meaningful thoughts
                                    const hasSteps = msg.steps && msg.steps.length > 0;
                                    const hasThoughts = thoughtBlocks.some(t => t.content && t.content.trim().length > 0);

                                    return (
                                        <div className="flex flex-col gap-2">
                                            {/* Unified Trace: Interleaves Thinking and Steps */}
                                            {(hasSteps || hasThoughts) && (
                                                <ExecutionTrace
                                                    steps={msg.steps || []}
                                                    thoughts={thoughtBlocks}
                                                    messageIndex={idx}
                                                    onRetry={() => handleRetry(idx)}
                                                    onSync={() => handleSync(msg)}
                                                />
                                            )}

                                            {/* Final Response Content */}
                                            {otherBlocks.map((block, blockIdx) => {
                                                // Clean text content for display
                                                let displayContent = block.content
                                                    .split('### Execution Trace:')[0]
                                                    .split('\n')
                                                    .filter((line: string) => !line.includes('[Error'))
                                                    .join('\n')
                                                    .trim();

                                                // Filter out standalone router keywords that might leak into the stream
                                                const routerKeywords = ['mindmap', 'flow', 'mermaid', 'charts', 'drawio', 'general', 'infographic', 'flowchart'];
                                                if (msg.steps && msg.steps.length > 0 && routerKeywords.includes(displayContent.toLowerCase())) {
                                                    return null;
                                                }

                                                if (!displayContent) return null;

                                                return (
                                                    <div key={blockIdx} className="prose prose-slate prose-sm max-w-none prose-p:my-1 prose-headings:text-slate-800 prose-headings:font-bold prose-headings:mb-1 prose-headings:mt-3 first:prose-headings:mt-0">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                table: ({ node, ...props }) => (
                                                                    <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
                                                                        <table className="w-full text-left text-sm border-collapse bg-white" {...props} />
                                                                    </div>
                                                                ),
                                                                thead: ({ node, ...props }) => <thead className="bg-slate-50 text-slate-700 font-semibold" {...props} />,
                                                                th: ({ node, ...props }) => <th className="px-4 py-2 border-b border-slate-200 whitespace-nowrap" {...props} />,
                                                                td: ({ node, ...props }) => <td className="px-4 py-2 border-b border-slate-100" {...props} />,
                                                                code: ({ node, className, children, ...props }) => {
                                                                    const match = /language-(\w+)/.exec(className || '');
                                                                    const isInline = !match && !String(children).includes('\n');

                                                                    if (isInline) {
                                                                        return (
                                                                            <code
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="bg-slate-100 rounded px-1.5 py-0.5 text-slate-800 break-words font-mono text-[11px] border border-slate-200"
                                                                                {...props}
                                                                            >
                                                                                {children}
                                                                            </code>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <code
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={cn("font-mono text-xs", className)}
                                                                            {...props}
                                                                        >
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                },
                                                                pre: ({ node, children, ...props }) => (
                                                                    <div className="relative group my-3">
                                                                        <pre
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="bg-[#1e1e1e] text-slate-50 p-3 rounded-lg overflow-x-auto text-xs custom-scrollbar border border-slate-700/50 shadow-sm"
                                                                            {...props}
                                                                        >
                                                                            {children}
                                                                        </pre>
                                                                    </div>
                                                                )
                                                            }}
                                                        >
                                                            {displayContent}
                                                        </ReactMarkdown>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                                {msg.error && (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="p-1 bg-red-100 rounded-lg">
                                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5 opacity-70">Generation Failed</p>
                                            <p className="text-xs leading-relaxed break-words">{msg.error}</p>
                                        </div>
                                    </div>
                                )}
                                {isGenerating && (
                                    <div className={cn(
                                        "flex items-center space-x-2 py-1 animate-pulse",
                                        hasContent && "mt-2 pt-2 border-t border-slate-100/50"
                                    )}>
                                        <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                                        <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                                    </div>
                                )}
                                {msg.images && msg.images.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mt-2">
                                        {msg.images.map((img, i) => (
                                            <img key={i} src={img} alt="attached" className="max-w-full h-auto max-h-48 rounded-lg border border-white/20" />
                                        ))}
                                    </div>
                                )}
                                {msg.files && msg.files.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {msg.files.map((file, i) => (
                                            <div key={i} className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                                msg.role === 'user'
                                                    ? "bg-white/10 border-white/20 text-white"
                                                    : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                                            )}>
                                                <FileText className={cn("w-4 h-4", msg.role === 'user' ? "text-blue-200" : "text-blue-500")} />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold truncate max-w-[120px]">{file.name}</span>
                                                    <span className={cn("text-[9px] uppercase tracking-wider font-bold opacity-60", msg.role === 'user' ? "text-blue-100" : "text-slate-400")}>
                                                        {file.name.split('.').pop()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {versionInfo && (
                                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100/50">
                                        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                                            <button
                                                onClick={(e) => switchVersion(e, msg, -1)}
                                                disabled={isLoading}
                                                className="p-1 hover:bg-white hover:text-blue-600 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                <ChevronLeft className="w-3 h-3" />
                                            </button>
                                            <span className="text-[10px] font-bold px-2 text-slate-500 min-w-[3rem] text-center">
                                                {versionInfo?.current} / {versionInfo?.total}
                                            </span>
                                            <button
                                                onClick={(e) => switchVersion(e, msg, 1)}
                                                disabled={isLoading}
                                                className="p-1 hover:bg-white hover:text-blue-600 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 mt-1.5 px-2 transition-opacity duration-200",
                                "opacity-0 group-hover:opacity-100"
                            )}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCopy(msg, idx); }}
                                    disabled={isLoading}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Copy content"
                                >
                                    {copiedIndex === idx ? (
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                    )}
                                </button>
                                {msg.role === 'assistant' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRetry(idx); }}
                                        disabled={isLoading}
                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Retry/Regenerate"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {msg.created_at && (
                                    <span className="text-[10px] text-slate-300 ml-1 font-medium select-none whitespace-nowrap">
                                        {new Date(msg.created_at).toLocaleString([], {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: false
                                        })}
                                    </span>
                                )}
                            </div>
                        </div >
                    );
                })}
                <div ref={messagesEndRef} />
            </div >

            {/* Input Area */}
            < div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-20" >
                {/* Image Previews */}
                {
                    inputImages.length > 0 && (
                        <div className="flex gap-2 mb-2 overflow-x-auto py-2">
                            {inputImages.map((img, idx) => (
                                <div key={idx} className="relative group/image flex-shrink-0">
                                    <img src={img} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )
                }

                {/* Agent Shortcuit Toolbar */}
                <div className="flex flex-wrap gap-2 mb-4 px-1">
                    {AGENTS.map((agent, idx) => (
                        <button
                            key={agent.id}
                            type="button"
                            onClick={() => toggleAgentTag(agent.id)}
                            className={cn(
                                "relative group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap",
                                input.startsWith('@' + agent.id + ' ')
                                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                            )}
                        >
                            <agent.icon className="w-3.5 h-3.5" />
                            <span>{agent.label}</span>

                            {/* Hover Tooltip - Positioned Above */}
                            <div className={cn(
                                "absolute bottom-full mb-3 w-56 max-w-[85vw] bg-slate-900 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-2xl z-50 flex flex-col whitespace-normal border border-white/10 overflow-hidden transform group-hover:translate-y-0 translate-y-2 scale-95 group-hover:scale-100 items-start",
                                (idx < 2 || idx === 4) ? "left-0" : "right-0"
                            )}>
                                {/* Header Stripe */}
                                <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />

                                <div className="p-4 flex flex-col gap-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/10 rounded-lg">
                                            <agent.icon className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <span className="text-sm font-bold tracking-tight text-white">{agent.label}</span>
                                    </div>

                                    <span className="text-[12px] text-slate-300 font-normal leading-relaxed text-left">
                                        {agent.description}
                                    </span>

                                    {(agent as any).features && (
                                        <div className="flex flex-wrap gap-1.5 pt-1 justify-start">
                                            {(agent as any).features.map((f: string) => (
                                                <span key={f} className="px-2 py-0.5 bg-white/5 rounded-md text-[10px] text-slate-400 font-medium border border-white/5">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Arrow */}
                                <div className={cn(
                                    "absolute top-full -mt-1 border-[6px] border-transparent border-t-slate-900",
                                    (idx < 2 || idx === 4) ? "left-6" : "right-6"
                                )}></div>
                            </div>
                        </button>
                    ))}
                </div>



                <form onSubmit={handleSubmit} className="relative group">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*,.pdf,.docx,.xlsx,.xls,.pptx,.txt,.md"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <div className="relative border border-slate-200 rounded-[28px] bg-slate-50 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all shadow-sm">
                        {/* Agent Mention Menu */}
                        {showMentions && (
                            <div className="absolute bottom-full mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="p-2 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Select Agent</span>
                                    <Command className="w-3 h-3 text-slate-300" />
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
                                    {AGENTS.filter(a => a.label.toLowerCase().includes(mentionFilter.toLowerCase()) || a.id.includes(mentionFilter.toLowerCase())).map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => selectAgent(agent.id)}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 text-left transition-colors group"
                                        >
                                            <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                                                <agent.icon className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{agent.label}</div>
                                                <div className="text-[10px] text-slate-400 line-clamp-1">{agent.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Parsing Status and File Previews */}
                        <div className="px-5 pt-3">
                            {parsingStatus && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs animate-pulse mb-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{parsingStatus}</span>
                                </div>
                            )}

                            {inputFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {inputFiles.map((file, i) => (
                                        <div key={i} className="group relative flex items-center gap-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200">
                                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="text-[10px] text-slate-600 max-w-[100px] truncate">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(i)}
                                                className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={inputImages.length > 0 ? "Ask about this image..." : "Ask anything... (Type @ to select agent)"}
                            className="w-full px-5 pt-5 pb-2 bg-transparent focus:outline-none font-medium text-slate-700 placeholder:text-slate-400 resize-none overflow-y-auto custom-scrollbar"
                            style={{ height: 'auto', minHeight: '60px' }}
                            disabled={isLoading}
                        />

                        <div className="flex items-center justify-between px-3 pb-3">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                    title="Upload Image or Document"
                                    disabled={isLoading}
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-2 px-2 py-1 bg-slate-100/50 border border-slate-200/50 rounded-lg" title="Parallel processing concurrency">
                                    <Zap className="w-3 h-3 text-amber-500" />
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={concurrency}
                                        onChange={(e) => setConcurrency(parseInt(e.target.value))}
                                        className="w-12 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 min-w-[8px]">{concurrency}</span>
                                </div>

                                <div className="relative" ref={modelSelectorRef}>
                                    <button
                                        type="button"
                                        onClick={() => models.length > 0 && setIsModelSelectorOpen(!isModelSelectorOpen)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all",
                                            activeModel
                                                ? "bg-green-50/50 border-green-200 text-green-700"
                                                : "bg-slate-100/50 border-slate-200/50 text-slate-500",
                                            models.length > 0 && "hover:bg-white hover:shadow-sm cursor-pointer"
                                        )}
                                    >
                                        <div className={cn("w-1.5 h-1.5 rounded-full", activeModel ? "bg-green-500" : "bg-blue-500")} />
                                        <span className="text-[10px] font-bold uppercase tracking-tight">
                                            {activeModel ? activeModel.name : "Default Model"}
                                        </span>
                                        {models.length > 0 && (
                                            isModelSelectorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                        )}
                                    </button>

                                    {isModelSelectorOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                                            <div className="p-2 border-b border-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Select Model</span>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                                                <button
                                                    onClick={() => {
                                                        setActiveModelId(null);
                                                        setIsModelSelectorOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all hover:bg-slate-50 text-left",
                                                        !activeModelId ? "text-blue-600 bg-blue-50/30" : "text-slate-600"
                                                    )}
                                                >
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", !activeModelId ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-slate-300")} />
                                                    Default Model
                                                </button>
                                                {models.map((model) => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => {
                                                            setActiveModelId(model.id);
                                                            setIsModelSelectorOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all hover:bg-slate-50 text-left border-t border-slate-50/50",
                                                            activeModelId === model.id ? "text-blue-600 bg-blue-50/30" : "text-slate-600"
                                                        )}
                                                    >
                                                        <div className={cn("w-1.5 h-1.5 rounded-full", activeModelId === model.id ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-slate-300")} />
                                                        <div className="flex flex-col">
                                                            <span>{model.name}</span>
                                                            <span className="text-[8px] text-slate-400 font-normal truncate max-w-[140px] uppercase tracking-tighter">{model.modelId}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-1 border-t border-slate-100 bg-slate-50/50">
                                                <button
                                                    onClick={() => {
                                                        setIsModelSelectorOpen(false);
                                                        setIsSettingsOpen(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold text-blue-600 hover:bg-white rounded-lg transition-all"
                                                >
                                                    <Settings className="w-3 h-3" />
                                                    Manage Models
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {models.length === 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsSettingsOpen(true)}
                                            className="text-[10px] font-bold text-blue-600 hover:underline ml-1"
                                        >
                                            Configure Custom Models
                                        </button>
                                    )}
                                </div>

                                {/* Recommendation Popup */}
                                {showRecommendation && models.length === 0 && (
                                    <div className="absolute bottom-full left-0 mb-4 w-72 bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-slate-800">Pro Tip</h4>
                                                    <button
                                                        onClick={handleCloseRecommendation}
                                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    Suggest configuring a smarter model (like <strong>Claude 3.7 Sonnet</strong>) for better architectural reasoning and diagram layout quality.
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        handleCloseRecommendation();
                                                        setIsSettingsOpen(true);
                                                    }}
                                                    className="mt-3 w-full py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                                                >
                                                    Configure Now
                                                </button>
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r border-b border-blue-100 rotate-45" />
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => isLoading ? stopGeneration() : void triggerSubmit()}
                                disabled={!isLoading && (!input.trim() && inputImages.length === 0 && inputFiles.length === 0)}
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                                    isLoading
                                        ? "bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-md shadow-red-500/20"
                                        : (!input.trim() && inputImages.length === 0 && inputFiles.length === 0)
                                            ? "bg-slate-200 text-slate-400 pointer-events-none"
                                            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20"
                                )}
                            >
                                {isLoading ? <Square className="w-4 h-4 fill-white" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </form>
            </div >
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div >
    );
};
