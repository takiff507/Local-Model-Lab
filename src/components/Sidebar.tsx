import { useState, useEffect } from 'react';
import { MessageSquare, Image as ImageIcon, DownloadCloud, Cpu, Sliders, FileText } from 'lucide-react';
import { getSystemStatus } from '../ipc';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [gpuUsage, setGpuUsage] = useState(0);

  useEffect(() => {
    // Initial fetch
    getSystemStatus().then(status => {
      setCpuUsage(status.cpuUsage);
      setRamUsage(status.ramUsage);
      setGpuUsage(status.gpuUsage);
    });

    const interval = setInterval(() => {
      getSystemStatus().then(status => {
        setCpuUsage(status.cpuUsage);
        setRamUsage(status.ramUsage);
        setGpuUsage(status.gpuUsage);
      }).catch(err => {
        console.error('Failed to get real-time system stats:', err);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'chat', label: 'Chat Assistant', icon: MessageSquare },
    { id: 'generate', label: 'Image Creator', icon: ImageIcon },
    { id: 'store', label: 'Model Library', icon: DownloadCloud },
    { id: 'settings', label: 'System Specs', icon: Sliders },
    { id: 'policy', label: 'Policy & Legal', icon: FileText },
  ];

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'rgba(10, 10, 14, 0.45)',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      height: '100%',
      backdropFilter: 'blur(35px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(35px) saturate(1.4)',
    }}>
      {/* Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ 
          fontSize: '0.7rem', 
          color: 'rgba(255, 255, 255, 0.4)', 
          fontWeight: 700, 
          letterSpacing: '2px', 
          textTransform: 'uppercase',
          paddingLeft: '12px',
          marginBottom: '16px'
        }}>
          Workspace
        </div>
        
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '11px 16px',
                position: 'relative',
                background: isActive 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'transparent',
                border: isActive 
                  ? '1px solid rgba(255, 255, 255, 0.12)' 
                  : '1px solid transparent',
                borderRadius: '10px',
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                fontSize: '0.88rem',
                fontWeight: isActive ? 600 : 500,
                textAlign: 'left' as const,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              {/* Glowing left indicator for active tab (iOS silver/white) */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px',
                  height: '60%',
                  borderRadius: '0 3px 3px 0',
                  background: 'linear-gradient(180deg, #ffffff, rgba(255, 255, 255, 0.5))',
                  boxShadow: '0 0 12px rgba(255, 255, 255, 0.6), 0 0 4px rgba(255, 255, 255, 0.3)',
                }} />
              )}
              <Icon size={18} style={{ 
                strokeWidth: isActive ? 2.2 : 1.8,
                filter: isActive ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' : 'none',
              }} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* System Monitors (iOS Liquid Glass styled) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
          <Cpu size={13} style={{ color: '#ffffff' }} />
          <span>System Status</span>
        </div>

        {/* CPU Monitor */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>
            <span>CPU Load</span>
            <span style={{ color: cpuUsage > 75 ? '#ff5f56' : 'rgba(255, 255, 255, 0.8)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{cpuUsage}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${cpuUsage}%`, 
              height: '100%', 
              background: cpuUsage > 75 ? 'linear-gradient(90deg, #ff5f56, #ffbd2e)' : 'linear-gradient(90deg, #ffffff, rgba(255, 255, 255, 0.5))',
              borderRadius: '2px',
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: cpuUsage > 75 ? '0 0 8px rgba(255, 95, 86, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.2)',
            }}></div>
          </div>
        </div>

        {/* GPU Monitor */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>
            <span>GPU Load</span>
            <span style={{ color: gpuUsage > 75 ? '#ff5f56' : 'rgba(255, 255, 255, 0.8)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{gpuUsage}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${gpuUsage}%`, 
              height: '100%', 
              background: gpuUsage > 75 ? 'linear-gradient(90deg, #ff5f56, #ffbd2e)' : 'linear-gradient(90deg, #ffffff, rgba(255, 255, 255, 0.5))',
              borderRadius: '2px',
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: gpuUsage > 75 ? '0 0 8px rgba(255, 95, 86, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.2)',
            }}></div>
          </div>
        </div>

        {/* RAM Monitor */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>
            <span>VRAM/RAM</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{ramUsage}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${ramUsage}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2))',
              borderRadius: '2px',
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
