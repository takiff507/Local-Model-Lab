import { useEffect, useState } from 'react';

interface StartupSplashProps {
  onComplete: () => void;
}

export default function StartupSplash({ onComplete }: StartupSplashProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = reducedMotion ? 550 : 1350;
    const completeDelay = reducedMotion ? 750 : 1750;
    const exitTimer = window.setTimeout(() => setIsExiting(true), exitDelay);
    const completeTimer = window.setTimeout(onComplete, completeDelay);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`startup-splash${isExiting ? ' startup-splash--exit' : ''}`} role="status" aria-label="Local Model Lab is starting">
      <div className="startup-splash__panel">
        <div className="startup-splash__meta" aria-hidden="true">
          <span>LOCAL RUNTIME / WINDOWS</span>
          <span>BUILD 1.0.1</span>
        </div>

        <div className="startup-splash__identity">
          <div className="startup-splash__mark" aria-hidden="true">
            <img src="./logo.png" alt="" />
          </div>
          <div className="startup-splash__wordmark">
            <strong>LOCAL MODEL LAB</strong>
            <span>PRIVATE AI WORKSPACE</span>
          </div>
        </div>

        <div className="startup-splash__status" aria-hidden="true">
          <span>INITIALIZING LOCAL WORKSPACE</span>
          <span className="startup-splash__status-code">SYS / READY</span>
        </div>
        <div className="startup-splash__progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
