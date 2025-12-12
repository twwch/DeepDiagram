import { ChatPanel } from './components/ChatPanel';
import { CanvasPanel } from './components/CanvasPanel';

function App() {
  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 h-full shadow-2xl z-10">
        <CanvasPanel />
      </div>
      <ChatPanel />
    </div>
  );
}

export default App;
