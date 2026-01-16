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

    // Only increment renderKey if explicitly provided in the state update
    // This prevents infinite re-render loops
    const newRenderKey = state.renderKey !== undefined
        ? state.renderKey
        : window.__canvasState.renderKey;

    window.__canvasState = {
        ...window.__canvasState,
        ...state,
        renderKey: newRenderKey
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
