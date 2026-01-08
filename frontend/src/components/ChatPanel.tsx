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
import { cn, copyToClipboard } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { ExecutionTrace } from './ExecutionTrace';
import type { Message, Step } from '../types';

const AGENTS = [
    {
        id: 'flowchart',
        label: 'Flowchart',
        description: 'Architect logic with intelligent auto-layout. Transform complex workflows into clear, readable diagrams with optimized edge routing.',
        features: ['Logic flows', 'Step-by-step processes', 'Conditional routing'],
        icon: Workflow,
        color: 'indigo',
        demoInput: '@flowchart draw a professional enterprise-grade CI/CD pipeline for a high-traffic e-commerce platform, including auto-scaling, blue-green deployment, and canary testing gates.'
    },
    {
        id: 'mindmap',
        label: 'Mindmap',
        description: 'Infinite canvas for visual thinking. Map out hierarchical structures, brainstorm ideas, and organize messy concepts into clean, expandable trees.',
        features: ['Idea mapping', 'Knowledge structure', 'Brainstorming'],
        icon: Network,
        color: 'amber',
        demoInput: '@mindmap create a 5-level deep strategic mindmap for a global expansion plan of an AI startup, covering Product/Market fit, Localization, Scaling, and Competitive moats.'
    },
    {
        id: 'mermaid',
        label: 'Mermaid',
        description: 'Industrial-strength text-to-diagram engine. Generate Sequence, Gantt, Class, and ER diagrams using clean Markdown-inspired syntax.',
        features: ['Sequence diagrams', 'Gantt charts', 'Text-to-visual'],
        icon: Code2,
        color: 'emerald',
        demoInput: '@mermaid draw a complex sequence diagram for a multi-factor authentication flow involving a mobile app, auth server, resource provider, and session database.'
    },
    {
        id: 'charts',
        label: 'Charts',
        description: 'Professional data storytelling. Convert raw data into interactive Bar, Line, Pie, and Gauge charts with sleek animations and responsive designs.',
        features: ['Data visualization', 'Dashboard metrics', 'Trend analysis'],
        icon: BarChart3,
        color: 'rose',
        demoInput: '@charts draw a professional financial dashboard showing the last 12 months of SaaS performance metrics including MRR growth, Churn rate vs Acquisition cost, and LTV projections.'
    },
    {
        id: 'drawio',
        label: 'Draw.io',
        description: 'The ultimate canvas for precision engineering. Design cloud architectures, network topologies, and blueprint-level technical diagrams.',
        features: ['Cloud architecture', 'Network topology', 'Professional drafting'],
        icon: PenTool,
        color: 'blue',
        demoInput: '@drawio architect a high-availability AWS cloud system with Multi-AZ VPC, subnets, ELB, EC2 auto-scaling groups, and a RDS Aurora cluster with read replicas.'
    },
    {
        id: 'infographic',
        label: 'Infographic',
        description: 'Advanced data storytelling. Create professional infographics, data posters, and visual summaries with creative layouts and rich components.',
        features: ['Data posters', 'Visual storytelling', 'Creative layouts'],
        icon: BarChart3,
        color: 'violet',
        demoInput: '@infographic draw a professional infographic roadmap for the future of Generative AI (2024-2030), showing key milestones, societal impacts, and industry shifts.'
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
            setStreamingCode(false);
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

        const timestamp = Date.now();
        if (!isRetry) {
            const userTurn = parentTurn + 1;
            const assistantTurn = userTurn + 1;
            // Use negative IDs for temporary local messages to ensure they are trackable
            const tempUserId = -timestamp;
            const tempAssistantId = -(timestamp + 1);

            addMessage({ id: tempUserId, role: 'user', content: promptToUse, images: imagesToUse, parent_id: effectiveParentId ?? null, turn_index: userTurn, created_at: new Date().toISOString() });
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

                            // 2. Filter other events by session ID if present
                            if (eventSessionId && eventSessionId !== useChatStore.getState().sessionId) {
                                console.warn(`Ignoring event for session ${eventSessionId} (current: ${useChatStore.getState().sessionId})`);
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
                                            allMsgs[targetIdx].id = data.id;
                                            if (data.turn_index !== undefined) {
                                                allMsgs[targetIdx].turn_index = data.turn_index;
                                            }
                                            allMsgs.forEach(m => {
                                                if (m.parent_id === oldId && oldId !== undefined) {
                                                    m.parent_id = data.id;
                                                }
                                            });

                                            let activeId = state.activeMessageId;
                                            if (data.role === 'assistant') {
                                                activeId = data.id;
                                            }

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
                                    break;

                                case 'agent_selected':
                                    setAgent(data.agent);
                                    // Always add the agent selection step to ensure visibility

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

                                    // 1. Aggressive Dedup & Merging:
                                    // If last step was an agent selection OR an identical tool call OR a generic precursor tool
                                    if (lastStepTool) {
                                        const isIdentical = isEqualJson(lastStepTool.content, toolInput);
                                        const isGenericPrecursor = lastStepTool.type === 'tool_start' &&
                                            (lastStepTool.name === 'charts' || lastStepTool.name === 'infographic' ||
                                                lastStepTool.content === '{}' || !lastStepTool.content || lastStepTool.name === '');

                                        const isReplaceable = lastStepTool.type === 'tool_start';

                                        if (isReplaceable && (isIdentical || isGenericPrecursor)) {
                                            console.log(`Aggressively replacing previous step with: ${data.tool}`);
                                            toolArgsBuffer = ""; // Reset buffer
                                            const replaceLastStep = useChatStore.getState().replaceLastStep;
                                            replaceLastStep({
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

                                    // 2. Mark previous step as finished if it was streaming
                                    if (lastStepTool?.isStreaming) {
                                        updateLastStepContent(lastStepTool.content || '', false, 'done', lastStepTool.type, false, eventSessionId);
                                    }

                                    // 3. Add tool start step
                                    toolArgsBuffer = ""; // Reset buffer for the new tool call
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

                                        // Ensure "Result" step exists before updating it
                                        const isLastStepResult = lastStepCode?.type === 'tool_end' && lastStepCode.name === 'Result';

                                        if (!isLastStepResult) {
                                            // Close tool_start's generating state
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

                                    // Mark whatever was last (Tool or result) as done
                                    if (lastStepEnd?.isStreaming) {
                                        updateLastStepContent(data.output || lastStepEnd.content || '', false, 'done', lastStepEnd.type, false, eventSessionId);
                                    }

                                    // Ensure a Result step exists if output came but no Result step was active
                                    if (lastStepEnd?.type !== 'tool_end' && data.output) {
                                        addStepToLastMessage({
                                            type: 'tool_end',
                                            name: 'Result',
                                            content: data.output,
                                            status: 'done',
                                            timestamp: Date.now(),
                                            isStreaming: false
                                        }, eventSessionId);
                                    }
                                    break;

                                case 'error':
                                    updateLastMessage(thoughtBuffer + `\n\n[Error: ${data.message}]`, false, 'error', eventSessionId);
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
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 && (
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
                    const hasContent = (msg.content || '').trim() || hasVisibleSteps || (msg.images && msg.images.length > 0);

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
