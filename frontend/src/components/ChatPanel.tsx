import { useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Code2,
    Command,
    Copy,
    History,
    Loader2,
    MessageSquare,
    Network,
    Paperclip,
    PenTool,
    Plus,
    RotateCcw,
    Send,
    Square,
    Trash2,
    Workflow,
    X
} from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { ExecutionTrace } from './ExecutionTrace';
import type { Message, Step } from '../types';

const AGENTS = [
    {
        id: 'flowchart',
        label: 'Flowchart',
        description: 'Architect logic with intelligent auto-layout. Transform complex workflows into clear, readable diagrams with optimized edge routing.',
        features: ['Logic flows', 'Step-by-step processes', 'Conditional routing'],
        icon: Workflow
    },
    {
        id: 'mindmap',
        label: 'Mindmap',
        description: 'Infinite canvas for visual thinking. Map out hierarchical structures, brainstorm ideas, and organize messy concepts into clean, expandable trees.',
        features: ['Idea mapping', 'Knowledge structure', 'Brainstorming'],
        icon: Network
    },
    {
        id: 'mermaid',
        label: 'Mermaid',
        description: 'Industrial-strength text-to-diagram engine. Generate Sequence, Gantt, Class, and ER diagrams using clean Markdown-inspired syntax.',
        features: ['Sequence diagrams', 'Gantt charts', 'Text-to-visual'],
        icon: Code2
    },
    {
        id: 'charts',
        label: 'Charts',
        description: 'Professional data storytelling. Convert raw data into interactive Bar, Line, Pie, and Gauge charts with sleek animations and responsive designs.',
        features: ['Data visualization', 'Dashboard metrics', 'Trend analysis'],
        icon: BarChart3
    },
    {
        id: 'drawio',
        label: 'Draw.io',
        description: 'The ultimate canvas for precision engineering. Design cloud architectures, network topologies, and blueprint-level technical diagrams.',
        features: ['Cloud architecture', 'Network topology', 'Professional drafting'],
        icon: PenTool
    },
    {
        id: 'infographic',
        label: 'Infographic',
        description: 'Advanced data storytelling. Create professional infographics, data posters, and visual summaries with creative layouts and rich components.',
        features: ['Data posters', 'Visual storytelling', 'Creative layouts'],
        icon: BarChart3
    },
];

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
        handleSync
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
            navigator.clipboard.writeText(textToCopy);
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
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            addInputImage(base64String);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isPagingRef.current) {
            isPagingRef.current = false;
            return;
        }
        scrollToBottom();
    }, [messages]);


    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
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
            setStreamingCode(false); // Ensure flags are reset
            addStepToLastMessage({
                type: 'agent_select',
                name: 'System',
                content: 'Generation stopped by user.',
                status: 'done',
                timestamp: Date.now()
            });
        }
    };

    const triggerSubmit = async (customPrompt?: string, customImages?: string[], parentId?: number | null, isRetry?: boolean, errorMessage?: string) => {
        let promptToUse = customPrompt ?? input;
        const imagesToUse = customImages ?? [...inputImages];

        if (errorMessage) {
            promptToUse += `\n\n[System Note: The previous diagram generation failed to render with the following error. Please fix the syntax: ${errorMessage}]`;
        }

        if ((!promptToUse.trim() && imagesToUse.length === 0) || isLoading) return;

        if (!customPrompt) {
            setInput('');
            setShowMentions(false);
            clearInputImages();
        }
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

        if (!isRetry) {
            const userTurn = parentTurn + 1;
            const assistantTurn = userTurn + 1;
            addMessage({ role: 'user', content: promptToUse, images: imagesToUse, parent_id: effectiveParentId ?? null, turn_index: userTurn });
            setLoading(true);
            addMessage({ role: 'assistant', content: '', parent_id: undefined, turn_index: assistantTurn });
            setActiveMessageId(null); // Will fallback to last message in allMessages until ID is confirmed
        } else {
            const assistantTurn = parentTurn + 1;
            setLoading(true);
            addMessage({ role: 'assistant', content: '', parent_id: parentId ?? null, turn_index: assistantTurn });
            setActiveMessageId(null);
        }

        let thoughtBuffer = "";
        let toolArgsBuffer = "";

        // Create new AbortController
        abortControllerRef.current = new AbortController();

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
                    is_retry: isRetry
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) return;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        const eventName = line.split('\n')[0].replace('event: ', '');
                        const dataStr = line.split('\n')[1]?.replace('data: ', '');

                        if (!dataStr) continue;

                        try {
                            const data = JSON.parse(dataStr);

                            if (eventName === 'session_created') {
                                setSessionId(data.session_id);
                                void loadSessions(); // Refresh list when new session is created
                            } else if (eventName === 'message_created') {
                                // Update the ID and Turn Index of the unconfirmed message
                                useChatStore.setState((state) => {
                                    const allMsgs = [...state.allMessages];

                                    // Find the first message of this role that doesn't have an ID yet
                                    const targetIdx = allMsgs.findIndex(m => m.role === data.role && !m.id);
                                    if (targetIdx !== -1) {
                                        const oldId = allMsgs[targetIdx].id;
                                        allMsgs[targetIdx].id = data.id;
                                        if (data.turn_index !== undefined) {
                                            allMsgs[targetIdx].turn_index = data.turn_index;
                                        }

                                        // Propagate ID to any children (though with linear turns this is less critical)
                                        allMsgs.forEach(m => {
                                            if (m.parent_id === oldId && oldId !== undefined) {
                                                m.parent_id = data.id;
                                            }
                                        });

                                        // Update activeMessageId if it's the assistant
                                        let activeId = state.activeMessageId;
                                        // 所有 assistant 消息都即时激活
                                        if (data.role === 'assistant') {
                                            activeId = data.id;
                                        }

                                        // Update selected version for this turn
                                        const turn = allMsgs[targetIdx].turn_index ?? 0;
                                        const newSelectedVersions = { ...state.selectedVersions, [turn]: data.id };

                                        // Rebuild messages list
                                        const turnMap: Record<number, Message[]> = {};
                                        allMsgs.forEach(m => {
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
                                            allMessages: allMsgs,
                                            messages: newMessages,
                                            selectedVersions: newSelectedVersions,
                                            activeMessageId: activeId
                                        };
                                    }
                                    return {};
                                });
                            } else if (eventName === 'agent_selected') {
                                setAgent(data.agent);
                                addStepToLastMessage({
                                    type: 'agent_select',
                                    name: data.agent,
                                    status: 'done',
                                    timestamp: Date.now()
                                });
                            } else if (eventName === 'tool_start') {
                                // Add tool start step
                                addStepToLastMessage({
                                    type: 'tool_start',
                                    name: data.tool,
                                    content: JSON.stringify(data.input),
                                    status: 'running',
                                    timestamp: Date.now()
                                });
                                // Add a "Result" step that will hold the streaming content and auto-expand
                                addStepToLastMessage({
                                    type: 'tool_end',
                                    name: 'Result',
                                    content: '',
                                    status: 'running',
                                    timestamp: Date.now(),
                                    isStreaming: true
                                });
                            } else if (eventName === 'thought') {
                                thoughtBuffer += data.content;
                                updateLastMessage(thoughtBuffer);
                            } else if (eventName === 'tool_code') {
                                // Direct code stream from a tool
                                setStreamingCode(true);
                                // Also update the "Result" step in the trace
                                updateLastStepContent(data.content, true, 'running', undefined, true);
                            } else if (eventName === 'tool_args_stream') {
                                const argsDelta = data.args;
                                if (argsDelta) {
                                    toolArgsBuffer += argsDelta;
                                    // Extract content from tool arguments for agents that support streaming
                                    // NOTE: Mindmap uses 'instruction' which is the user request, NOT the actual markdown.
                                    // Mindmap content comes from tool_end only. Do NOT extract from tool_args_stream for mindmap.
                                    const contentMatch = toolArgsBuffer.match(/"(content|description|data|markdown|code|xml_content|option_str)"\s*:\s*"/);
                                    if (contentMatch) {
                                        const startIdx = contentMatch.index! + contentMatch[0].length;
                                        let endIdx = toolArgsBuffer.indexOf('"', startIdx);
                                        while (endIdx !== -1 && toolArgsBuffer[endIdx - 1] === '\\') {
                                            endIdx = toolArgsBuffer.indexOf('"', endIdx + 1);
                                        }
                                        // Don't stream tool_args for mindmap - it only contains instruction, not markdown
                                        // Other agents can use this if they have actual code in their args
                                    }
                                }
                            } else if (eventName === 'tool_end') {
                                setStreamingCode(false);
                                updateLastStepContent(data.output, false, 'done');
                            } else if (eventName === 'code_update') {
                                // Handled by dynamic derivation from history
                            }
                        } catch (jsonErr) {
                            console.error("JSON Parse error", jsonErr);
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Error:', error);
                updateLastMessage(thoughtBuffer + '\n\n[Error encountered]');
            }
        } finally {
            setLoading(false);
            setStreamingCode(false);
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
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        DeepDiagram AI
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Describe what you want to create or upload an image.</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* New Chat Button */}
                    <button
                        onClick={() => {
                            stopGeneration();
                            createNewChat();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
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
                            <History className="w-3.5 h-3.5" />
                            <span>History</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showHistory && "rotate-180")} />
                        </button>

                        {showHistory && (
                            <div className="absolute right-0 mt-2 w-80 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Recent Chats</span>
                                    <History className="w-3 h-3 text-slate-300" />
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
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                        <div className="p-4 bg-slate-100 rounded-full">
                            <Send className="w-8 h-8 text-slate-300" />
                        </div>
                        <p>Start a conversation to create visuals.</p>
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
                        (activeMessageId === null && !msg.id && idx === messages.findIndex(m => !m.id))
                    );
                    const hasVisibleSteps = msg.steps && msg.steps.some(s => !(s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')));
                    const hasContent = msg.content.trim() || hasVisibleSteps || (msg.images && msg.images.length > 0);

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
                                {msg.steps && msg.steps.length > 0 && (
                                    <ExecutionTrace steps={msg.steps} messageIndex={idx} onRetry={() => handleRetry(idx)} onSync={() => handleSync(msg)} />
                                )}
                                <ReactMarkdown
                                    components={{
                                        code: ({ node, ...props }) => <code onClick={(e) => e.stopPropagation()} className="bg-black/10 rounded px-1 py-0.5 whitespace-pre-wrap break-words" {...props} />,
                                        pre: ({ node, ...props }) => <pre onClick={(e) => e.stopPropagation()} className="bg-slate-900 text-slate-50 p-3 rounded-lg overflow-x-auto text-xs my-2 max-w-full custom-scrollbar" {...props} />
                                    }}
                                >
                                    {msg.content
                                        .split('### Execution Trace:')[0]  // 过滤掉 Execution Trace 部分
                                        .split('\n')
                                        .filter(line => !line.includes('[Error'))
                                        .join('\n')
                                        .trim()}
                                </ReactMarkdown>
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
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-20">
                {/* Image Previews */}
                {inputImages.length > 0 && (
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
                )}

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
                        accept="image/*"
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
                                    title="Upload Image"
                                    disabled={isLoading}
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => isLoading ? stopGeneration() : void triggerSubmit()}
                                disabled={!isLoading && (!input.trim() && inputImages.length === 0)}
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                                    isLoading
                                        ? "bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-md shadow-red-500/20"
                                        : (!input.trim() && inputImages.length === 0)
                                            ? "bg-slate-200 text-slate-400 pointer-events-none"
                                            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20"
                                )}
                            >
                                {isLoading ? <Square className="w-4 h-4 fill-white" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
