import { create } from 'zustand';
import type { ChatState, Message, AgentType, Step } from '../types';
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

    updateLastMessage: (content: string) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            allMsgs[targetIdx].content = content;

            // Sync to canvas if it's mindmap (other agents wait for steps/done)
            const msg = allMsgs[targetIdx];
            const currentAgent = msg.agent || state.activeAgent;
            const isMindmap = currentAgent === 'mindmap';
            const isStreaming = state.isLoading;
            const assistantMsgs = allMsgs.filter(m => m.role === 'assistant');
            const isLatestAssistant = assistantMsgs.length > 0 && msg.id === assistantMsgs[assistantMsgs.length - 1].id;

            if (isStreaming && isMindmap && isLatestAssistant && msg.id) {
                set({ activeMessageId: msg.id });
                setCanvasState({
                    activeMessageId: msg.id,
                    activeAgent: (currentAgent as AgentType) || state.activeAgent
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

    addStepToLastMessage: (step: Step) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = allMsgs[targetIdx];
            msg.steps = [...(msg.steps || []), { ...step, timestamp: Date.now() }];

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

            return { allMessages: allMsgs, messages: newMessages };
        }
        return {};
    }),

    updateLastStepContent: (content, isStreaming = false, status = 'running', type, append = false) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const msg = allMsgs[targetIdx];
            if (msg.steps && msg.steps.length > 0) {
                const steps = [...msg.steps];
                const lastStep = { ...steps[steps.length - 1] };
                if (append) {
                    lastStep.content = (lastStep.content || '') + content;
                } else {
                    lastStep.content = content;
                }
                lastStep.isStreaming = isStreaming;
                lastStep.status = status;
                if (type) lastStep.type = type;
                steps[steps.length - 1] = lastStep;
                msg.steps = steps;

                // Sync to canvas if it's a tool_end OR during streaming for immediate feedback
                // ANTI-HIJACKING: Only sync if this message IS ALREADY the active one, 
                // or if there is no active message (auto-tracking the absolute latest).
                const currentCanvasState = getCanvasState();
                const currentAgent = msg.agent || state.activeAgent;
                const isMindmap = currentAgent === 'mindmap';
                const assistantMsgs = allMsgs.filter(m => m.role === 'assistant');
                const isLatestAssistant = assistantMsgs.length > 0 && msg.id === assistantMsgs[assistantMsgs.length - 1].id;

                const isActive = currentCanvasState.activeMessageId === null ||
                    currentCanvasState.activeMessageId === msg.id ||
                    (status === 'done' && isLatestAssistant) ||
                    (isStreaming && isMindmap && isLatestAssistant);

                const shouldSync = status === 'done' || (isStreaming && isMindmap);

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

                const mappedMessages: Message[] = history.map((m: any) => ({
                    id: m.id,
                    parent_id: m.parent_id,
                    role: m.role,
                    content: m.content,
                    images: m.images,
                    steps: m.steps,
                    agent: m.agent,
                    turn_index: m.turn_index,
                    created_at: m.created_at
                }));

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
