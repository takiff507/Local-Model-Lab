import { Minus, Square, X } from 'lucide-react';
import { minimizeWindow, maximizeWindow, closeWindow, isElectron } from '../ipc';

export default function Titlebar() {
  return (
    <div className="custom-titlebar">
      <div className="titlebar-brand">
        <img className="titlebar-logo" src="/logo.png" alt="" aria-hidden="true" />
        <span>LOCAL MODEL LAB</span>
      </div>
      <div className="titlebar-actions">
        {isElectron() ? (
          <>
            <button className="titlebar-btn btn-minimize" onClick={minimizeWindow} title="Minimize">
              <Minus size={14} strokeWidth={2.5} />
            </button>
            <button className="titlebar-btn btn-maximize" onClick={maximizeWindow} title="Maximize">
              <Square size={11} strokeWidth={2.5} />
            </button>
            <button className="titlebar-btn btn-close" onClick={closeWindow} title="Close">
              <X size={14} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
            Web Preview Mode
          </div>
        )}
      </div>
    </div>
  );
}
