import { create } from 'zustand';
import type { ChatState, Message, AgentType, Step, DocAnalysisBlock } from '../types';
import { setCanvasState, getCanvasState } from './canvasState';

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    input: '',
    activeAgent: 'mindmap',
    isLoading: false,
    sessionId: null,
    sessions: [],
    allMessages: [],
    inputImages: [],
    isStreamingCode: false,
    activeMessageId: null,
    selectedVersions: {},
    activeStepRef: null,
    toast: null,
    inputFiles: [],
    parsingStatus: null,

    setInput: (input) => set({ input }),
    setAgent: (agent) => {
        set({ activeAgent: agent });
        setCanvasState({ activeAgent: agent });
    },
    setLoading: (loading) => set({ isLoading: loading }),
    setStreamingCode: (streaming) => set({ isStreamingCode: streaming }),
    setSessionId: (id) => set({ sessionId: id }),
    setMessages: (messages) => set({ messages }),
    setActiveMessageId: (id) => {
        const state = get() as ChatState;
        const msg = state.allMessages.find(m => m.id === id);
        const msgAgent = msg?.agent as AgentType | undefined;

        set({ activeMessageId: id });
        if (msgAgent) {
            set({ activeAgent: msgAgent });
        }
        setCanvasState({
            activeMessageId: id,
            activeAgent: msgAgent || state.activeAgent
        });
    },
    setActiveStepRef: (ref) => set({ activeStepRef: ref }),

    setInputImages: (images) => set({ inputImages: images }),
    addInputImage: (image) => set((state) => ({ inputImages: [...state.inputImages, image] })),
    clearInputImages: () => set({ inputImages: [] }),

    setInputFiles: (files) => set({ inputFiles: files }),
    addInputFile: (file) => set((state) => ({ inputFiles: [...state.inputFiles, file] })),
    clearInputFiles: () => set({ inputFiles: [] }),
    setParsingStatus: (status) => set({ parsingStatus: status }),

    reportError: (error) => set({ toast: { message: error, type: 'error' } }),
    reportSuccess: () => set({}),
    clearToast: () => set({ toast: null }),

    addMessage: (message: Message) => set((state) => {
        const allMsgs = [...state.allMessages, message];
        const turnIndex = message.turn_index || 0;
        const newSelectedVersions = { ...state.selectedVersions };

        const newMessage = { ...message };
        if (newMessage.id) {
            newSelectedVersions[turnIndex] = newMessage.id;
        } else {
            delete newSelectedVersions[turnIndex];
        }

        const activeMessageId = newMessage.id || state.activeMessageId;

        const turnMap: Record<number, Message[]> = {};
        allMsgs.forEach(m => {
            const turn = m.turn_index || 0;
            if (!turnMap[turn]) turnMap[turn] = [];
            turnMap[turn].push(m);
        });

        const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
        const newMessages: Message[] = [];
        sortedTurns.forEach(turn => {
            const siblings = turnMap[turn];
            const selectedId = newSelectedVersions[turn];
            const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
            newMessages.push(selected);
        });

        const newState = {
            allMessages: allMsgs,
            messages: newMessages,
            selectedVersions: newSelectedVersions,
            activeMessageId: activeMessageId
        };

        return newState as any;
    }),

    updateLastMessage: (content: string, isStreaming = false, status: 'running' | 'done' | 'error' = 'done', sessionId?: number, skipCanvasSync = false) => set((state) => {
        if (sessionId && sessionId !== state.sessionId) return {};
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = { ...allMsgs[targetIdx] };
            if (status === 'error') {
                msg.error = content;
            } else {
                msg.content = content || '';
            }
            allMsgs[targetIdx] = msg;

            // Sync to canvas state if active and should sync
            const currentCanvasState = getCanvasState();
            const currentAgent = msg.agent || state.activeAgent;
            const isLatestAssistant = targetIdx === allMsgs.length - 1;
            const isStreamingAgent = currentAgent === 'mindmap' || currentAgent === 'infographic';

            const isActive = currentCanvasState.activeMessageId === null ||
                currentCanvasState.activeMessageId === msg.id ||
                (status === 'done' && isLatestAssistant) ||
                (isStreaming && isStreamingAgent && isLatestAssistant);

            if (isActive && !skipCanvasSync && (status === 'done' || (isStreaming && isStreamingAgent))) {
                if (msg.id) set({ activeMessageId: msg.id });
                setCanvasState({
                    activeMessageId: msg.id || null,
                    activeAgent: (currentAgent as AgentType) || state.activeAgent,
                    renderKey: status === 'done' ? (getCanvasState().renderKey || 0) + 1 : undefined
                });
            }

            const turnMap: Record<number, Message[]> = {};
            allMsgs.forEach(m => {
                const turn = m.turn_index || 0;
                if (!turnMap[turn]) turnMap[turn] = [];
                turnMap[turn].push(m);
            });

            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
            const newMessages: Message[] = [];
            sortedTurns.forEach(turn => {
                const siblings = turnMap[turn];
                const selectedId = state.selectedVersions[turn];
                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                newMessages.push(selected);
            });

            return { allMessages: allMsgs, messages: newMessages };
        }
        return {};
    }),

    replaceLastStep: (step, sessionId) => set((state) => {
        if (sessionId && sessionId !== state.sessionId) return {};
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = { ...allMsgs[targetIdx] };
            if (msg.steps && msg.steps.length > 0) {
                const steps = [...msg.steps];

                // GUARD: Never replace an agent_select step with a different type
                if (steps[steps.length - 1].type === 'agent_select' && step.type !== 'agent_select') {
                    console.log("GUARD: Prevented replacement of agent_select step");
                    return {};
                }

                steps[steps.length - 1] = { ...step, timestamp: Date.now() };
                msg.steps = steps;
                allMsgs[targetIdx] = msg;

                // Rebuild messages list for UI sync
                const turnMap: Record<number, Message[]> = {};
                allMsgs.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });
                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const newMessages: Message[] = [];
                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const selectedId = state.selectedVersions[turn];
                    const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                    newMessages.push(selected);
                });

                return { allMessages: allMsgs, messages: newMessages };
            }
        }
        return {};
    }),

    addStepToLastMessage: (step: Step, sessionId?: number) => set((state) => {
        if (sessionId && sessionId !== state.sessionId) return {};
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = { ...allMsgs[targetIdx] };

            // Prevent duplicate agent_select steps
            const lastStep = msg.steps && msg.steps.length > 0 ? msg.steps[msg.steps.length - 1] : null;
            if (step.type === 'agent_select' && lastStep?.type === 'agent_select' && lastStep?.name === step.name) {
                // Ignore duplicate
                return {};
            }

            msg.steps = [...(msg.steps || []), { ...step, timestamp: Date.now() }];
            allMsgs[targetIdx] = msg;

            // Sync agent type to message if it's an agent selection step
            if (step.type === 'agent_select') {
                msg.agent = step.name;
            }
            // Rebuild messages list
            const turnMap: Record<number, Message[]> = {};
            allMsgs.forEach(m => {
                const turn = m.turn_index || 0;
                if (!turnMap[turn]) turnMap[turn] = [];
                turnMap[turn].push(m);
            });
            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
            const newMessages: Message[] = [];
            sortedTurns.forEach(turn => {
                const siblings = turnMap[turn];
                const selectedId = state.selectedVersions[turn];
                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                newMessages.push(selected);
            });

            if (sessionId && sessionId !== state.sessionId) return {};
            return { allMessages: allMsgs, messages: newMessages };
        }
        return {};
    }),

    updateLastStepContent: (content, isStreaming = false, status = 'running', type, append = false, sessionId?: number) => set((state) => {
        if (sessionId && sessionId !== state.sessionId) return {};
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = { ...allMsgs[targetIdx] };
            if (msg.steps && msg.steps.length > 0) {
                const steps = [...msg.steps];
                const lastStep = { ...steps[steps.length - 1] };

                // GUARD: Never allow updateLastStepContent to change the type of an agent_select step
                if (type && lastStep.type === 'agent_select' && type !== 'agent_select') {
                    console.log("GUARD: Prevented updateLastStepContent from changing agent_select type");
                    return {};
                }

                if (append) {
                    lastStep.content = (lastStep.content || '') + (content || '');
                } else {
                    lastStep.content = content || '';
                }
                lastStep.isStreaming = isStreaming;
                lastStep.status = status;
                if (type) lastStep.type = type;
                steps[steps.length - 1] = lastStep;
                msg.steps = steps;
                allMsgs[targetIdx] = msg;

                // Sync to canvas if it's a tool_end OR during streaming for immediate feedback
                const currentCanvasState = getCanvasState();
                const currentAgent = msg.agent || state.activeAgent;
                const isStreamingAgent = currentAgent === 'mindmap' || currentAgent === 'infographic';
                const assistantMsgs = allMsgs.filter(m => m.role === 'assistant');
                const isLatestAssistant = assistantMsgs.length > 0 && msg.id === assistantMsgs[assistantMsgs.length - 1].id;

                const isActive = currentCanvasState.activeMessageId === null ||
                    currentCanvasState.activeMessageId === msg.id ||
                    (status === 'done' && isLatestAssistant) ||
                    (isStreaming && isStreamingAgent && isLatestAssistant);

                const shouldSync = status === 'done' || (isStreaming && isStreamingAgent);

                if (isActive && shouldSync && msg.id) {
                    set({ activeMessageId: msg.id }); // Sync store
                    setCanvasState({
                        activeMessageId: msg.id,
                        activeAgent: (currentAgent as AgentType) || state.activeAgent,
                        renderKey: status === 'done' ? (getCanvasState().renderKey || 0) + 1 : undefined
                    });
                } else if (status === 'done') {
                    // 即使没有 msg.id，tool_end 时也强制刷新画布
                    setCanvasState({
                        renderKey: (getCanvasState().renderKey || 0) + 1
                    });
                }

                // Rebuild messages list
                const turnMap: Record<number, Message[]> = {};
                allMsgs.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });
                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const newMessages: Message[] = [];
                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const selectedId = state.selectedVersions[turn];
                    const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                    newMessages.push(selected);
                });

                return { allMessages: allMsgs, messages: newMessages };
            }
        }
        return {};
    }),

    updateDocAnalysisBlock: (index, content, status, append = true, sessionId) => set((state) => {
        if (sessionId && sessionId !== state.sessionId) return {};
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = { ...allMsgs[targetIdx] };
            const blocks = [...(msg.docAnalysisBlocks || [])];
            const existingIdx = blocks.findIndex(b => b.index === index);

            if (existingIdx !== -1) {
                const block = { ...blocks[existingIdx] };
                block.content = append ? (block.content + content) : content;
                block.status = status;
                blocks[existingIdx] = block;
            } else {
                blocks.push({
                    index,
                    content,
                    status
                });
                blocks.sort((a, b) => {
                    if (a.index === -1) return 1;
                    if (b.index === -1) return -1;
                    return a.index - b.index;
                });
            }

            msg.docAnalysisBlocks = blocks;
            allMsgs[targetIdx] = msg;

            // Rebuild messages list
            const turnMap: Record<number, Message[]> = {};
            allMsgs.forEach(m => {
                const turn = m.turn_index || 0;
                if (!turnMap[turn]) turnMap[turn] = [];
                turnMap[turn].push(m);
            });
            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
            const newMessages: Message[] = [];
            sortedTurns.forEach(turn => {
                const siblings = turnMap[turn];
                const selectedId = state.selectedVersions[turn];
                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                newMessages.push(selected);
            });

            return { allMessages: allMsgs, messages: newMessages };
        }
        return {};
    }),

    loadSessions: async () => {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                const data = await response.json();
                set({ sessions: data });
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    },

    selectSession: async (sessionId: number) => {
        set({ isLoading: true, sessionId, messages: [], allMessages: [], selectedVersions: {} });
        try {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                const history = data.messages || [];

                const mappedMessages: Message[] = history.map((m: any) => {
                    // Extract docAnalysisBlocks from steps
                    const docAnalysisBlocks: DocAnalysisBlock[] = [];
                    if (m.steps) {
                        m.steps.forEach((step: Step) => {
                            if (step.type === 'doc_analysis') {
                                try {
                                    const content = JSON.parse(step.content || '{}');
                                    if (typeof content === 'object' && content.index !== undefined) {
                                        docAnalysisBlocks.push({
                                            index: content.index,
                                            content: content.content,
                                            status: 'done'
                                        });
                                    } else {
                                        // Legacy/Fallback
                                        docAnalysisBlocks.push({
                                            index: -1,
                                            content: step.content || '',
                                            status: 'done'
                                        });
                                    }
                                }
                                catch (e) {
                                    // Fallback for plain text content
                                    docAnalysisBlocks.push({
                                        index: -1,
                                        content: step.content || '',
                                        status: 'done'
                                    });
                                }
                            }
                        });
                    }

                    // Deduplicate blocks by index, keeping the last one found
                    const uniqueBlocksMap = new Map<number, DocAnalysisBlock>();
                    docAnalysisBlocks.forEach(block => {
                        uniqueBlocksMap.set(block.index, block);
                    });
                    const uniqueBlocks = Array.from(uniqueBlocksMap.values());

                    uniqueBlocks.sort((a, b) => {
                        if (a.index === -1) return 1;
                        if (b.index === -1) return -1;
                        return a.index - b.index;
                    });

                    return {
                        id: m.id,
                        parent_id: m.parent_id,
                        role: m.role,
                        content: m.content,
                        images: m.images,
                        files: m.files,
                        steps: m.steps,
                        agent: m.agent,
                        turn_index: m.turn_index,
                        created_at: m.created_at,
                        docAnalysisBlocks: uniqueBlocks.length > 0 ? uniqueBlocks : undefined,
                    };
                });

                const initialSelected: Record<number, number> = {};
                const turnMap: Record<number, Message[]> = {};
                mappedMessages.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });

                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const activeMessages: Message[] = [];
                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const latest = siblings[siblings.length - 1];
                    if (latest.id) initialSelected[turn] = latest.id;
                    activeMessages.push(latest);
                });

                // Find last agent and active message
                let lastAgent: AgentType = 'mindmap';
                for (let i = activeMessages.length - 1; i >= 0; i--) {
                    const msg = activeMessages[i];
                    if (msg.role === 'assistant' && msg.agent) {
                        lastAgent = msg.agent as AgentType;
                        break;
                    }
                }

                const activeId = activeMessages[activeMessages.length - 1]?.id || null;

                set({
                    messages: activeMessages,
                    allMessages: mappedMessages,
                    selectedVersions: initialSelected,
                    activeAgent: lastAgent,
                    activeMessageId: activeId,
                    isLoading: false
                });

                // 同步到画布状态
                setCanvasState({
                    activeAgent: lastAgent,
                    activeMessageId: activeId,
                    renderKey: (getCanvasState().renderKey || 0) + 1
                });
            }
        } catch (error) {
            console.error('Failed to select session:', error);
            set({ isLoading: false });
        }
    },

    deleteSession: async (sessionId: number) => {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
            if (response.ok) {
                const { sessions, sessionId: currentId } = get();
                set({ sessions: sessions.filter(s => s.id !== sessionId) });
                if (currentId === sessionId) {
                    get().createNewChat();
                }
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    },

    switchMessageVersion: (messageId: number) => {
        const state = get() as ChatState;
        const allMsgs = state.allMessages;
        const targetMsg = allMsgs.find(m => m.id === messageId);
        if (!targetMsg) return;

        const turnIndex = targetMsg.turn_index || 0;
        const newSelectedVersions = { ...state.selectedVersions, [turnIndex]: messageId };

        const turnMap: Record<number, Message[]> = {};
        allMsgs.forEach(m => {
            const turn = m.turn_index || 0;
            if (!turnMap[turn]) turnMap[turn] = [];
            turnMap[turn].push(m);
        });

        const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
        const newMessages: Message[] = [];
        sortedTurns.forEach(turn => {
            const siblings = turnMap[turn];
            const selectedId = newSelectedVersions[turn];
            const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
            newMessages.push(selected);
        });

        // Find agent from context
        let lastAgent: AgentType = 'mindmap';
        const targetIdx = newMessages.findIndex(m => m.id === messageId);

        if (targetMsg.agent) {
            lastAgent = targetMsg.agent as AgentType;
        } else {
            for (let i = targetIdx; i >= 0; i--) {
                const msg = newMessages[i];
                if (msg.role === 'assistant' && msg.agent) {
                    lastAgent = msg.agent as AgentType;
                    break;
                }
            }
        }

        const newState = {
            messages: newMessages,
            selectedVersions: newSelectedVersions,
            activeAgent: lastAgent,
            activeMessageId: messageId,
            isStreamingCode: false
        };

        set(newState);

        // 同步到画布
        setCanvasState({
            activeAgent: lastAgent,
            activeMessageId: messageId,
            renderKey: (getCanvasState().renderKey || 0) + 1
        });
    },

    syncCodeToMessage: (messageId: number) => {
        const state = get() as ChatState;
        const allMsgs = state.allMessages;
        const targetMsg = allMsgs.find(m => m.id === messageId);
        if (!targetMsg) return;

        // Find agent
        let lastAgent: AgentType = 'mindmap';
        if (targetMsg.agent) {
            lastAgent = targetMsg.agent as AgentType;
        } else {
            const currentMsgs = state.messages;
            const targetIdx = currentMsgs.findIndex(m => m.id === messageId);
            for (let i = targetIdx; i >= 0; i--) {
                const msg = currentMsgs[i];
                if (msg.role === 'assistant' && msg.agent) {
                    lastAgent = msg.agent as AgentType;
                    break;
                }
            }
        }

        const newState = {
            activeAgent: lastAgent,
            activeMessageId: messageId
        };
        set(newState);

        // 同步到画布
        setCanvasState({
            activeAgent: lastAgent,
            activeMessageId: messageId,
            renderKey: (getCanvasState().renderKey || 0) + 1
        });
    },

    handleSync: (msg: Message) => {
        if (msg.id) {
            get().setActiveMessageId(msg.id);
        }
    },

    syncToLatest: () => {
        const state = get() as ChatState;
        const allMsgs = state.allMessages;
        if (allMsgs.length === 0) return;

        const turnMap: Record<number, Message[]> = {};
        allMsgs.forEach(m => {
            const turn = m.turn_index || 0;
            if (!turnMap[turn]) turnMap[turn] = [];
            turnMap[turn].push(m);
        });

        // 重置所有轮次为最新版本
        const newSelectedVersions: Record<number, number> = {};
        Object.keys(turnMap).forEach(turnKey => {
            const siblings = turnMap[Number(turnKey)];
            newSelectedVersions[Number(turnKey)] = siblings[siblings.length - 1].id!;
        });

        const sortedTurns = Object.keys(newSelectedVersions).map(Number).sort((a, b) => a - b);
        const newMessages: Message[] = [];
        sortedTurns.forEach(turn => {
            const siblings = turnMap[turn];
            newMessages.push(siblings[siblings.length - 1]);
        });

        const latestMsg = newMessages[newMessages.length - 1];
        if (!latestMsg) return;

        // 查找最新 agent
        let lastAgent: AgentType = 'mindmap';
        for (let i = newMessages.length - 1; i >= 0; i--) {
            const msg = newMessages[i];
            if (msg.role === 'assistant' && msg.agent) {
                lastAgent = msg.agent as AgentType;
                break;
            }
        }

        const newState = {
            messages: newMessages,
            selectedVersions: newSelectedVersions,
            activeAgent: lastAgent,
            activeMessageId: latestMsg.id,
        };

        set(newState);
        setCanvasState({
            activeAgent: lastAgent,
            activeMessageId: latestMsg.id,
            renderKey: (getCanvasState().renderKey || 0) + 1
        });
    },

    createNewChat: () => {
        set({
            messages: [],
            input: '',
            isLoading: false,
            sessionId: null,
            allMessages: [],
            inputImages: [],
            isStreamingCode: false,
            activeMessageId: null,
            selectedVersions: {},
            activeAgent: 'mindmap',
        });
        setCanvasState({
            activeAgent: 'mindmap',
            activeMessageId: null,
            renderKey: (getCanvasState().renderKey || 0) + 1
        });
    }
}));
