// Simple window-based state for canvas rendering
// This bypasses zustand completely for canvas updates

interface CanvasState {
    activeAgent: string;
    activeMessageId: number | null;
    renderKey: number;
}

declare global {
    interface Window {
        __canvasState: CanvasState;
    }
}

// Initialize
if (typeof window !== 'undefined') {
    window.__canvasState = {
        activeAgent: 'mindmap',
        activeMessageId: null,
        renderKey: 0
    };
}

export const setCanvasState = (state: Partial<CanvasState>) => {
    if (typeof window === 'undefined') return;

    window.__canvasState = {
        ...window.__canvasState,
        ...state,
        renderKey: (window.__canvasState.renderKey || 0) + 1
    };

    // Notify all listeners
    window.dispatchEvent(new CustomEvent('canvas-state-change', {
        detail: window.__canvasState
    }));
};

export const getCanvasState = (): CanvasState => {
    if (typeof window === 'undefined') {
        return {
            activeAgent: 'mindmap',
            activeMessageId: null,
            renderKey: 0
        };
    }
    return window.__canvasState;
};
