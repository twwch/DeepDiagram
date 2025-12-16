import { useRef, useEffect } from 'react';
import { Send, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { ExecutionTrace } from './ExecutionTrace';


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
        // activeAgent, // Not needed in component scope anymore if we only use setAgent
        setAgent,
        inputImages,
        addInputImage,
        setInputImages,
        clearInputImages,
        addStepToLastMessage
    } = useChatStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            addInputImage(base64String);
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be selected again
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

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && inputImages.length === 0) || isLoading) return;

        const userMsg = input;
        const currentImages = [...inputImages]; // Capture current images

        setInput('');
        clearInputImages();

        // Optimistically add message
        // For now we just show text, ideally we show images too in the chat bubble
        addMessage({ role: 'user', content: userMsg, images: currentImages });
        setLoading(true);

        // Placeholder for assistant message
        addMessage({ role: 'assistant', content: '' });

        let thoughtBuffer = "";
        let toolArgsBuffer = "";
        let detectedAgent = ""; // Local variable to track agent for this session

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: userMsg,
                    images: currentImages,
                    // agent_id: activeAgent, // Removed for auto-routing
                    session_id: sessionId,
                    context: {
                        current_code: currentCode
                    }
                }),
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
                                // BACKEND DECIDED AGENT
                                setAgent(data.agent);
                                detectedAgent = data.agent; // Update local tracker
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
                                    content: JSON.stringify(data.input), // Show input if needed
                                    status: 'running',
                                    timestamp: Date.now()
                                });
                            } else if (eventName === 'thought') {
                                thoughtBuffer += data.content;
                                updateLastMessage(thoughtBuffer);
                            } else if (eventName === 'tool_args_stream') {
                                // Accumulate args and try to extract content for live preview
                                const argsDelta = data.args;
                                if (argsDelta) {
                                    // Hack: use a local variable for this render cycle? 
                                    // Actually we need a Ref if we want to persist across renders without re-render on every character?
                                    // But we are inside a while loop, so local variable works for this scope.
                                    // However, `toolArgsBuffer` was not declared. Let's declare it outside loop.
                                    toolArgsBuffer += argsDelta;

                                    // Try to basic regex extract 'content' or 'description' string
                                    // This is very rough but might give the visual effect
                                    const contentMatch = toolArgsBuffer.match(/"(content|description|data)"\s*:\s*"((?:[^"\\]|\\.)*)/);
                                    if (contentMatch && contentMatch[2]) {
                                        // Unescape basic chars
                                        let partialContent = contentMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                                        setCurrentCode(partialContent);
                                    }
                                }
                            } else if (eventName === 'tool_end') {
                                addStepToLastMessage({
                                    type: 'tool_end',
                                    name: 'Tool Finished', // Would be nice to link to start
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



        } catch (error) {
            console.error('Error:', error);
            updateLastMessage(thoughtBuffer + '\n\n[Error encountered]');
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 w-[400px] shadow-lg z-20">
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    DeepDiagram AI
                </h1>
                <p className="text-xs text-slate-500 mt-1">Describe what you want to create or upload an image.</p>
            </div>

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
                    // Hide empty assistant messages (waiting for content/steps)
                    // But ensure we show if there are visible steps (not just 'general' agent select)
                    const hasVisibleSteps = msg.steps && msg.steps.some(s => !(s.type === 'agent_select' && (s.name === 'general' || s.name === 'general_agent')));

                    if (msg.role === 'assistant' && !msg.content.trim() && !hasVisibleSteps && (!msg.images || msg.images.length === 0)) {
                        return null;
                    }

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === 'user' ? "justify-end" : "justify-start"
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
                                {/* Execution Steps */}
                                {msg.steps && msg.steps.length > 0 && (
                                    <ExecutionTrace steps={msg.steps} />
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
                        </div>
                    )
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
            <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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

                <form onSubmit={handleSubmit} className="relative group">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Upload Image"
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        placeholder={inputImages.length > 0 ? "Ask about this image..." : "Ask DeepDiagram to create charts, flowcharts, or mindmaps..."}
                        className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={(!input.trim() && inputImages.length === 0) || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg disabled:shadow-none"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};
