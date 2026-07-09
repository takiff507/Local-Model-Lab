import { Minus, Square, X } from 'lucide-react';
import { minimizeWindow, maximizeWindow, closeWindow, isElectron } from '../ipc';

export default function Titlebar() {
  return (
    <div className="custom-titlebar">
      <div className="titlebar-brand">
        <img className="titlebar-logo" src="./logo.png" alt="" aria-hidden="true" />
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
        ) : null}
      </div>
    </div>
  );
}
