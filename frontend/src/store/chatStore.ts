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

    setInput: (input) => set({ input }),
    setAgent: (agent) => set({ activeAgent: agent }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setCurrentCode: (code) => set({ currentCode: code }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSessionId: (id) => set({ sessionId: id }),
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
                // If this is a 'tool_end', try to find matching 'tool_start' and update it? 
                // Or just append log? The user asked to "show what agent and tools are called".
                // Detailed log is better.
                lastMsg.steps.push(step);
            }
        }
        return { messages: msgs };
    }),
}));
