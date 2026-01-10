import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function copyToClipboard(text: string): Promise<boolean> {
    // 1. Try Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Modern Clipboard API failed:', err);
        }
    }

    // 2. Fallback to legacy textarea + execCommand
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Ensure textarea is not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error('Legacy clipboard fallback failed:', err);
        return false;
    }
}

/**
 * Removes <think>...</think> tags and their content from the string.
 * This is useful for cleaning up output from reasoning models like DeepSeek-R1.
 */
export function cleanContent(content: string): string {
    if (!content) return '';
    // Removes <think>...</think> (case insensitive) and handles newlines
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also remove partial <think> tag at the end (for streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/i, '');
    return cleaned.trim();
}

export type ContentBlock =
    | { type: 'text'; content: string }
    | { type: 'thought'; content: string; isThinking?: boolean };

/**
 * Parses content into a list of text and thought blocks.
 * Preserves the order of appearance.
 */
export function parseMixedContent(content: string): ContentBlock[] {
    if (!content) return [];

    const blocks: ContentBlock[] = [];

    // Robustness: Check for missing opening <think> tag
    // If we see </think> before any <think>, assume the content starts with a thought
    const firstClose = content.indexOf('</think>');
    const firstOpen = content.indexOf('<think>');

    let processContent = content;
    if (firstClose !== -1 && (firstOpen === -1 || firstClose < firstOpen)) {
        processContent = '<think>' + content;
    }

    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let lastIndex = 0;
    let match;

    // 1. Find all complete blocks
    while ((match = thinkRegex.exec(processContent)) !== null) {
        // Add preceding text
        if (match.index > lastIndex) {
            const text = processContent.slice(lastIndex, match.index);
            if (text) blocks.push({ type: 'text', content: text });
        }

        // Add thought block
        blocks.push({ type: 'thought', content: match[1].trim() });
        lastIndex = thinkRegex.lastIndex;
    }

    // 2. Check for remaining partial block (streaming)
    const remaining = processContent.slice(lastIndex);
    const partialThinkMatch = remaining.match(/<think>([\s\S]*)$/i);

    if (partialThinkMatch) {
        // Add text before the partial block
        if (partialThinkMatch.index && partialThinkMatch.index > 0) {
            blocks.push({ type: 'text', content: remaining.slice(0, partialThinkMatch.index) });
        }
        // Add partial thought
        blocks.push({ type: 'thought', content: partialThinkMatch[1].trim(), isThinking: true });
    } else if (remaining) {
        // Add remaining text
        blocks.push({ type: 'text', content: remaining });
    }

    return blocks;
}

// Keep a lightweight compatibility wrapper for places that just need clean code
export function processContent(content: string): { thought: string | null; code: string; isThinking: boolean } {
    const blocks = parseMixedContent(content);
    const thoughts = blocks.filter(b => b.type === 'thought').map(b => b.content).join('\n\n');
    const code = blocks.filter(b => b.type === 'text').map(b => b.content).join('');
    // Use boolean OR on undefined/boolean to detect if any block is thinking
    const isThinking = blocks.some(b => b.type === 'thought' && b.isThinking);
    return { thought: thoughts || null, code, isThinking };
}
