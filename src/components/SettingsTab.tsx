import { useEffect, useState } from 'react';
import { Cpu, FolderOpen, HardDrive, Image, Power, ShieldCheck, ShieldOff, Terminal, Trash2 } from 'lucide-react';
import {
  getStartOnBoot,
  onEngineLog,
  openGenerationsFolder,
  openModelsFolder,
  setStartOnBoot,
} from '../ipc';

interface SettingsTabProps {
  systemInfo: any;
  safetyEnabled: boolean;
  setSafetyEnabled: (enabled: boolean) => void;
}

export default function SettingsTab({ systemInfo, safetyEnabled, setSafetyEnabled }: SettingsTabProps) {
  const [logs, setLogs] = useState<string[]>([
    '[system] Local Model Lab ready.',
    '[system] Local inference mode enabled.',
    '[system] Waiting for model or backend activity.',
  ]);
  const [startOnBoot, setStartOnBootState] = useState(false);
  const [bootSupported, setBootSupported] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    getStartOnBoot().then(result => {
      setStartOnBootState(result.enabled);
      setBootSupported(result.supported);
    });
    return onEngineLog(entry => {
      setLogs(current => [...current.slice(-79), `[${new Date().toLocaleTimeString()}] ${entry.text}`]);
    });
  }, []);

  const updateStartOnBoot = async (enabled: boolean) => {
    const result = await setStartOnBoot(enabled);
    setStartOnBootState(result.enabled);
    setSettingsMessage(result.success ? 'Startup preference updated.' : result.message || 'Could not update startup preference.');
  };

  return (
    <main className="settings-page">
      <header className="workspace-header">
        <div className="workspace-header__title">
          <Cpu size={24} />
          <div>
            <h2>System & Settings</h2>
            <p>Hardware detection, local storage, safeguards, startup behavior, and engine logs.</p>
          </div>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-section settings-section--wide">
          <h3><Cpu size={17} />Detected hardware</h3>
          <dl className="spec-list">
            <div><dt>Operating system</dt><dd>{systemInfo?.platform === 'win32' ? 'Windows' : systemInfo?.platform || 'Detecting...'}</dd></div>
            <div><dt>Processor</dt><dd>{systemInfo?.cpu || 'Detecting...'} ({systemInfo?.cores || 0} logical cores)</dd></div>
            <div><dt>Memory</dt><dd>{systemInfo?.ram || 'Detecting...'}</dd></div>
            <div><dt>Graphics</dt><dd>{systemInfo?.gpu || 'Detecting...'}</dd></div>
            <div><dt>Detected VRAM</dt><dd>{systemInfo?.gpuMemoryGB ? `${systemInfo.gpuMemoryGB} GB` : 'Unknown'}</dd></div>
            <div><dt>Models folder</dt><dd className="mono-value">{systemInfo?.modelsPath || 'Setting up...'}</dd></div>
          </dl>
        </section>

        <section className="settings-section">
          <h3><ShieldCheck size={17} />Safeguards</h3>
          <label className="setting-toggle">
            <span><strong>{safetyEnabled ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}18+ safety lock</strong><small>Local prompt guard. Hard safety blocks remain active.</small></span>
            <input type="checkbox" checked={safetyEnabled} onChange={event => setSafetyEnabled(event.target.checked)} />
          </label>
          <label className={`setting-toggle ${!bootSupported ? 'is-disabled' : ''}`}>
            <span><strong><Power size={15} />Start with Windows</strong><small>{bootSupported ? 'Launch Local Model Lab after sign-in.' : 'Available in the packaged Windows release.'}</small></span>
            <input type="checkbox" checked={startOnBoot} disabled={!bootSupported} onChange={event => updateStartOnBoot(event.target.checked)} />
          </label>
          {settingsMessage && <p className="settings-message">{settingsMessage}</p>}
        </section>

        <section className="settings-section">
          <h3><HardDrive size={17} />Local storage</h3>
          <button className="btn-secondary settings-action" onClick={openModelsFolder}><FolderOpen size={16} /><span>Open models folder</span></button>
          <button className="btn-secondary settings-action" onClick={openGenerationsFolder}><Image size={16} /><span>Open generations folder</span></button>
          <p className="settings-note">Local Model Lab does not upload prompts or outputs. Deleting local files is permanent.</p>
        </section>

        <section className="settings-section settings-section--logs">
          <div className="settings-log-header">
            <h3><Terminal size={17} />Inference engine logs</h3>
            <button className="icon-button" onClick={() => setLogs(['[system] Logs cleared.'])} title="Clear logs"><Trash2 size={15} /></button>
          </div>
          <div className="engine-log" role="log">
            {logs.map((log, index) => <div key={`${index}-${log}`}>{log}</div>)}
          </div>
        </section>
      </div>
    </main>
  );
}