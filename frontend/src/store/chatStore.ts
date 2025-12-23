import { create } from 'zustand';
import type { ChatState, Message } from '../types';

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    input: '',
    activeAgent: 'mindmap',
    currentCode: '',
    isLoading: false,
    sessionId: null,
    inputImages: [],
    isStreamingCode: false,
    toast: null, // Simple toast state
    activeStepRef: null,

    setInput: (input) => set({ input }),
    setAgent: (agent) => set({ activeAgent: agent }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setCurrentCode: (code: string | ((prev: string) => string)) =>
        set((state) => ({
            currentCode: typeof code === 'function' ? code(state.currentCode) : code
        })),
    setLoading: (loading) => set({ isLoading: loading }),
    setStreamingCode: (streaming) => set({ isStreamingCode: streaming }),
    setSessionId: (id) => set({ sessionId: id }),
    setMessages: (messages: Message[]) => set({ messages }),
    updateLastMessage: (content) => set((state) => {
        const msgs = [...state.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1].content = content;
        } else {
            // Should probably add if not exists, but usually we add 'assistant' empty msg first
        }
        return { messages: msgs };
    }),
    setInputImages: (images) => set({ inputImages: images }),
    addInputImage: (image) => set((state) => ({ inputImages: [...state.inputImages, image] })),
    clearInputImages: () => set({ inputImages: [] }),
    addStepToLastMessage: (step) => set((state) => {
        const msgs = [...state.messages];
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.role === 'assistant') {
                lastMsg.steps = lastMsg.steps || [];
                lastMsg.steps.push(step);
            }
        }
        return { messages: msgs };
    }),
    updateLastStepContent: (content: string, isStreaming?: boolean, status?: 'running' | 'done') => set((state) => {
        const msgs = [...state.messages];
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.role === 'assistant' && lastMsg.steps && lastMsg.steps.length > 0) {
                const lastStep = lastMsg.steps[lastMsg.steps.length - 1];
                if (typeof content === 'string') {
                    lastStep.content = (lastStep.content || '') + content;
                }
                if (isStreaming !== undefined) lastStep.isStreaming = isStreaming;
                if (status !== undefined) lastStep.status = status;
            }
        }
        return { messages: msgs };
    }),


    setActiveStepRef: (ref) => set({ activeStepRef: ref }),

    reportError: (errorMsg) => set((state) => {
        const msgs = [...state.messages];
        let targetStep = null;

        if (state.activeStepRef) {
            const { messageIndex, stepIndex } = state.activeStepRef;
            if (msgs[messageIndex] && msgs[messageIndex].steps && msgs[messageIndex].steps![stepIndex]) {
                targetStep = msgs[messageIndex].steps![stepIndex];
            }
        } else if (msgs.length > 0) {
            // Fallback to last step of last message
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.steps && lastMsg.steps.length > 0) {
                targetStep = lastMsg.steps[lastMsg.steps.length - 1];
            }
        }

        if (targetStep) {
            targetStep.isError = true;
            targetStep.error = errorMsg;
            // Force re-render of components using messages
            return { messages: msgs, toast: { message: errorMsg, type: 'error' } };
        }

        return { toast: { message: errorMsg, type: 'error' } };
    }),

    reportSuccess: () => set((state) => {
        if (!state.activeStepRef) return {}; // Do nothing if not explicit re-render? Or clear last?

        const msgs = [...state.messages];
        const { messageIndex, stepIndex } = state.activeStepRef;

        if (msgs[messageIndex] && msgs[messageIndex].steps && msgs[messageIndex].steps![stepIndex]) {
            const targetStep = msgs[messageIndex].steps![stepIndex];
            targetStep.isError = false;
            targetStep.error = undefined;
            return { messages: msgs };
        }
        return {};
    }),

    markLastStepAsError: (errorMsg) => useChatStore.getState().reportError(errorMsg),

    clearToast: () => set({ toast: null }),
}));
