
export interface AgentProps {
    content: string;
}

export interface AgentRef {
    handleDownload: (type: 'png' | 'svg') => Promise<void>;
    resetView?: () => void;
}
