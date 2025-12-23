import { useRef, useEffect, useState } from 'react';
import {
    Send, Loader2, X, Copy, RotateCcw, Check, Command, Square,
    Workflow, Network, Code2, BarChart3, PenTool, AlertCircle, Paperclip
} from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { ExecutionTrace } from './ExecutionTrace';
import type { Message, Step } from '../types';

const AGENTS = [
    {
        id: 'flow',
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
        id: 'chart',
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
        currentCode,
        setCurrentCode,
        setAgent,
        inputImages,
        addInputImage,
        setInputImages,
        clearInputImages,
        addStepToLastMessage,
        setMessages,
        toast,
        clearToast
    } = useChatStore();

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
    const abortControllerRef = useRef<AbortController | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            addStepToLastMessage({
                type: 'agent_select',
                name: 'System',
                content: 'Generation stopped by user.',
                status: 'done',
                timestamp: Date.now()
            });
        }
    };

    const triggerSubmit = async (customPrompt?: string, customImages?: string[]) => {
        const promptToUse = customPrompt ?? input;
        const imagesToUse = customImages ?? [...inputImages];

        if ((!promptToUse.trim() && imagesToUse.length === 0) || isLoading) return;

        if (!customPrompt) {
            setInput('');
            setShowMentions(false);
            clearInputImages();
            setCurrentCode(''); // Clear stale code from previous turn
        }

        addMessage({ role: 'user', content: promptToUse, images: imagesToUse });
        setLoading(true);
        addMessage({ role: 'assistant', content: '' });

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
                    context: { current_code: currentCode }
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
                            } else if (eventName === 'agent_selected') {
                                setAgent(data.agent);
                                addStepToLastMessage({
                                    type: 'agent_select',
                                    name: data.agent,
                                    status: 'done',
                                    timestamp: Date.now()
                                });
                            } else if (eventName === 'tool_start') {
                                addStepToLastMessage({
                                    type: 'tool_start',
                                    name: data.tool,
                                    content: JSON.stringify(data.input),
                                    status: 'running',
                                    timestamp: Date.now()
                                });
                            } else if (eventName === 'thought') {
                                thoughtBuffer += data.content;
                                updateLastMessage(thoughtBuffer);
                            } else if (eventName === 'tool_args_stream') {
                                const argsDelta = data.args;
                                if (argsDelta) {
                                    toolArgsBuffer += argsDelta;
                                    // Robustly match the first string argument value, regardless of key name (e.g., content, code, markdown, xml_content, option_str)
                                    // Regex explanation: Look for a key followed by a colon and a quote. Then capture until the end if no closing quote, or handle escaped quotes.
                                    const contentMatch = toolArgsBuffer.match(/"(content|description|data|markdown|code|xml_content|option_str)"\s*:\s*"/);
                                    if (contentMatch) {
                                        const startIdx = contentMatch.index! + contentMatch[0].length;
                                        let endIdx = toolArgsBuffer.indexOf('"', startIdx);
                                        while (endIdx !== -1 && toolArgsBuffer[endIdx - 1] === '\\') {
                                            endIdx = toolArgsBuffer.indexOf('"', endIdx + 1);
                                        }
                                        if (endIdx !== -1) {
                                            let partialContent = toolArgsBuffer.substring(startIdx, endIdx)
                                                .replace(/\\n/g, '\n')
                                                .replace(/\\"/g, '"')
                                                .replace(/\\\\/g, '\\');
                                            setCurrentCode(partialContent);
                                        } else {
                                            let partialContent = toolArgsBuffer.substring(startIdx)
                                                .replace(/\\n/g, '\n')
                                                .replace(/\\"/g, '"')
                                                .replace(/\\\\/g, '\\');
                                            setCurrentCode(partialContent);
                                        }
                                    }
                                }
                            } else if (eventName === 'tool_end') {
                                addStepToLastMessage({
                                    type: 'tool_end',
                                    name: 'Tool Finished',
                                    content: typeof data.output === 'string' ? data.output : JSON.stringify(data.output),
                                    status: 'done',
                                    timestamp: Date.now()
                                });
                                if (data.output) {
                                    setCurrentCode(data.output);
                                }
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
                    const hasVisibleSteps = msg.steps && msg.steps.some(s => !(s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')));

                    if (msg.role === 'assistant' && !msg.content.trim() && !hasVisibleSteps && (!msg.images || msg.images.length === 0)) {
                        return null;
                    }

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

                    const handleRetry = (index: number) => {
                        if (isLoading) return;
                        const msgs = [...messages];
                        let retryPrompt = '';
                        let retryImages: string[] = [];
                        if (msgs[index].role === 'user') {
                            retryPrompt = msgs[index].content;
                            retryImages = msgs[index].images || [];
                            setMessages(msgs.slice(0, index));
                        } else {
                            for (let i = index - 1; i >= 0; i--) {
                                if (msgs[i].role === 'user') {
                                    retryPrompt = msgs[i].content;
                                    retryImages = msgs[i].images || [];
                                    setMessages(msgs.slice(0, i));
                                    break;
                                }
                            }
                        }
                        if (retryPrompt || retryImages.length > 0) {
                            void triggerSubmit(retryPrompt, retryImages);
                        }
                    };

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-300 group",
                                msg.role === 'user' ? "items-end" : "items-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm"
                                        : "bg-white border border-slate-100 text-slate-800 rounded-tl-sm"
                                )}
                            >
                                {msg.steps && msg.steps.length > 0 && (
                                    <ExecutionTrace steps={msg.steps} messageIndex={idx} />
                                )}
                                <ReactMarkdown
                                    components={{
                                        code: ({ node, ...props }) => <code className="bg-black/10 rounded px-1 py-0.5 whitespace-pre-wrap break-words" {...props} />,
                                        pre: ({ node, ...props }) => <pre className="bg-slate-900 text-slate-50 p-3 rounded-lg overflow-x-auto text-xs my-2 max-w-full custom-scrollbar" {...props} />
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                                {msg.images && msg.images.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mt-2">
                                        {msg.images.map((img, i) => (
                                            <img key={i} src={img} alt="attached" className="max-w-full h-auto max-h-48 rounded-lg border border-white/20" />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 mt-1.5 px-2 transition-opacity duration-200",
                                "opacity-0 group-hover:opacity-100"
                            )}>
                                <button
                                    onClick={() => handleCopy(msg, idx)}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
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
                                        onClick={() => handleRetry(idx)}
                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                        title="Retry/Regenerate"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                            <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                        </div>
                    </div>
                )}
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
                                "absolute bottom-full mb-3 w-80 max-w-[400px] bg-slate-900 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-2xl z-50 flex flex-col whitespace-normal border border-white/10 overflow-hidden transform group-hover:translate-y-0 translate-y-2 scale-95 group-hover:scale-100 items-start",
                                idx === 0 ? "left-0" :
                                    idx === AGENTS.length - 1 ? "right-0" :
                                        "left-1/2 -translate-x-1/2"
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
                                    idx === 0 ? "left-6" :
                                        idx === AGENTS.length - 1 ? "right-6" :
                                            "left-1/2 -translate-x-1/2"
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
