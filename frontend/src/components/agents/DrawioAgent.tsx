import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import type { AgentRef } from './types';

export const DrawioAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, setCurrentCode, isStreamingCode } = useChatStore();
    const [iframeReady, setIframeReady] = useState(false);
    const drawioIframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (drawioIframeRef.current?.contentWindow) {
                drawioIframeRef.current.contentWindow.postMessage(JSON.stringify({
                    action: 'export',
                    format: type,
                    spin: true
                }), '*');
            } else {
                alert('Editor not ready.');
            }
        }
    }));

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== 'string') return;

            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch (e) {
                return;
            }

            if (msg.event === 'export') {
                if (msg.data) {
                    const downloadFile = (url: string, ext: string) => {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `deepdiagram-drawio-${new Date().getTime()}.${ext}`;
                        a.click();
                    };
                    downloadFile(msg.data, msg.format === 'xmlsvg' || msg.format === 'svg' ? 'svg' : 'png');
                }
            }
            if (msg.event === 'configure') {
                drawioIframeRef.current?.contentWindow?.postMessage(JSON.stringify({
                    action: 'configure',
                    config: {
                        compressXml: false,
                        sidebarVisible: false,
                        formatVisible: false,
                        showFormatPanel: false,
                        showStartScreen: false,
                        gridColor: '#f1f3f4',
                        // Ensure sidebars are hidden in all themes
                        sidebar_visible: false,
                        format_visible: false,
                        showSidebar: false,
                        libraries: false
                    }
                }), '*');
            }
            if (msg.event === 'init') {
                setIframeReady(true);
                // Force close panels after a delay to ensure the UI is fully loaded
                const win = drawioIframeRef.current?.contentWindow;
                setTimeout(() => {
                    win?.postMessage(JSON.stringify({ action: 'exec', cmd: 'formatPanel', value: false }), '*');
                    win?.postMessage(JSON.stringify({ action: 'exec', cmd: 'sidebar', value: false }), '*');
                }, 1000);
            }
            else if (msg.event === 'save' || msg.event === 'autosave') {
                if (msg.xml) {
                    setCurrentCode(msg.xml);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentCode, setCurrentCode]);

    useEffect(() => {
        if (!isStreamingCode && iframeReady && currentCode && drawioIframeRef.current) {
            let cleanXml = currentCode.replace(/```xml\s?/, '').replace(/```/, '').trim();
            if (cleanXml.startsWith('<')) {
                const win = drawioIframeRef.current.contentWindow;
                win?.postMessage(JSON.stringify({
                    action: 'load',
                    xml: cleanXml,
                    autosave: 1,
                    fit: 1
                }), '*');

                // Explicit fit after a short delay to ensure rendering is complete
                setTimeout(() => {
                    win?.postMessage(JSON.stringify({
                        action: 'fit',
                        padding: 20
                    }), '*');
                }, 1200);
            }
        }
    }, [iframeReady, currentCode, isStreamingCode]);

    // Use ui=atlas with explicit sidebar=0 and format=0 which are more reliable
    const drawioUrl = "https://embed.diagrams.net/?" + new URLSearchParams({
        embed: '1',
        ui: 'atlas',
        spin: '1',
        modified: 'unsavedChanges',
        proto: 'json',
        configure: '1',
        fit: '1',
        sidebar: '0',
        format: '0',
        libs: '0',
        menubar: '0',
        toolbar: '0',
        status: '0',
        noSaveBtn: '1',
        noExitBtn: '1'
    }).toString();

    return (
        <div className="w-full h-full">
            <iframe
                ref={drawioIframeRef}
                src={drawioUrl}
                className="w-full h-full border-none"
                title="Draw.io Editor"
            />
        </div>
    );
});
