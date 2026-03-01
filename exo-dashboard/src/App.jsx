import Header from './components/Header.jsx';
import StatusPanel from './components/StatusPanel.jsx';
import ManualRun from './components/ManualRun.jsx';
import LogViewer from './components/LogViewer.jsx';
import SourceToggles from './components/SourceToggles.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import ExtractConversation from './components/ExtractConversation.jsx';

export default function App() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Header />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-8">
        <div className="lg:col-span-4">
          <StatusPanel />
        </div>
        <div>
          <ManualRun />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mt-5">
        <div className="lg:col-span-3">
          <LogViewer />
        </div>
        <div className="space-y-5">
          <SourceToggles />
          <StatsPanel />
        </div>
      </div>

      <div className="mt-5">
        <ExtractConversation />
      </div>
    </div>
  );
}
