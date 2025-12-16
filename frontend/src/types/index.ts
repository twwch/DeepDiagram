export type AgentType = 'mindmap' | 'flow' | 'charts' | 'drawio' | 'general';

export interface Step {
    type: 'agent_select' | 'tool_start' | 'tool_end';
    name?: string; // e.g. "mindmap_agent", "create_chart"
    content?: string; // Input or Output
    status?: 'running' | 'done' | 'error';
    timestamp?: number;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    images?: string[];
    steps?: Step[]; // Execution trace
}

export interface ChartOption {
    // Loose typing for ECharts option
    [key: string]: any;
}

export interface ChatState {
    messages: Message[];
    input: string;
    activeAgent: AgentType;
    currentCode: string; // The code currently rendered (markdown, mermaid, or echarts json)
    isLoading: boolean;
    sessionId: number | null;
    inputImages: string[]; // Base64 data URLs

    setInput: (input: string) => void;
    setAgent: (agent: AgentType) => void;
    addMessage: (message: Message) => void;
    setCurrentCode: (code: string) => void;
    setLoading: (loading: boolean) => void;
    setSessionId: (id: number) => void;
    updateLastMessage: (content: string) => void;
    setInputImages: (images: string[]) => void;
    addInputImage: (image: string) => void;
    clearInputImages: () => void;
    addStepToLastMessage: (step: import('../types').Step) => void;
}
