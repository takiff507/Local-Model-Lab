import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sliders, RefreshCw, FolderOpen, Trash2, Image as ImageIcon, Play, Sparkles, Layers, Cpu, ShieldCheck, RotateCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { getImageBackendStatus, onImageGenerationProgress, startImageGeneration, downloadImageBackend, cancelImageBackendDownload, onImageBackendDownloadProgress, getSystemInfo, openGenerationsFolder } from '../ipc';
import type { ImageBackendStatus } from '../ipc';
import { buildInstalledModelCatalog } from '../modelsData';
import { checkPromptSafety } from '../safety';
import CustomDropdown from './CustomDropdown';

interface HistoryItem {
  id: string;
  url: string;
  outputPath?: string;
  prompt: string;
  negativePrompt: string;
  steps: number;
  cfg: number;
  seed: number;
  aspect: string;
  model: string;
  backend?: string;
}

interface GenerateTabProps {
  downloadedModels: string[];
  localModelFiles: string[];
  activeModelId: string;
  setActiveModelId: (id: string) => void;
}

const cleanErrorMessage = (err: string): string => {
  if (!err) return '';
  if (err.includes('Command failed:')) {
    const lines = err.split(/\r?\n/);
    const errorLines = lines.filter(line => 
      (line.includes('[ERROR]') || line.includes('failed') || line.includes('Error')) && 
      !line.includes('sd-cli.exe') &&
      !line.includes('stable-diffusion.cpp.exe')
    );
    if (errorLines.length > 0) {
      return errorLines.map(line => line.trim().replace(/^\[ERROR\]\s*/i, '')).join('\n');
    }
    return 'Local generation failed. The local engine encountered an unexpected error.';
  }
  return err;
};

const LATENT_TILES = Array.from({ length: 64 }, (_, index) => index);

export default function GenerateTab({
  downloadedModels,
  localModelFiles,
  activeModelId,
  setActiveModelId,
}: GenerateTabProps) {
  const [prompt, setPrompt] = useState('A cinematic neon city street at night, detailed reflections, dramatic lighting, ultra sharp');
  const [negativePrompt, setNegativePrompt] = useState('ugly, blurry, low resolution, disfigured, text, watermark');
  const [steps, setSteps] = useState(8);
  const [cfg, setCfg] = useState(1.5);
  const [seed, setSeed] = useState(12345678);
  const [aspect, setAspect] = useState('1:1');
  const [scheduler, setScheduler] = useState('euler_a');
  const [clipSkip, setClipSkip] = useState(2);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [gpuEnabled, setGpuEnabled] = useState(true);
  const [selectedGpuIndex, setSelectedGpuIndex] = useState(0);
  const [limitCpuThreads, setLimitCpuThreads] = useState(false);
  const [cpuThreads, setCpuThreads] = useState(4);
  const [vaeTiling, setVaeTiling] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    getSystemInfo().then(info => {
      setSystemInfo(info);
      if (info && info.cores) {
        setCpuThreads(Math.max(1, Math.floor(info.cores / 2)));
      }
    });
  }, []);
  const [backendStatus, setBackendStatus] = useState<ImageBackendStatus>({
    available: false,
    backend: 'missing',
    label: 'Scanning...',
    detail: 'Checking local image backend.',
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  const [downloadingBackend, setDownloadingBackend] = useState(false);
  const [backendProgress, setBackendProgress] = useState(0);
  const [backendStatusText, setBackendStatusText] = useState('');
  const [backendError, setBackendError] = useState('');
  const [selectedBackendType, setSelectedBackendType] = useState<'cpu' | 'vulkan' | 'cuda12'>('vulkan');

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return `${parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleInstallBackend = async (type: 'cpu' | 'vulkan' | 'cuda12') => {
    setDownloadingBackend(true);
    setBackendProgress(0);
    setBackendStatusText('Initializing backend download...');
    setBackendError('');

    const unsubscribe = onImageBackendDownloadProgress((data: any) => {
      if (data.status === 'downloading') {
        setBackendProgress(data.progress);
        setBackendStatusText(`Downloading engine: ${data.progress}% (${formatSpeed(data.speed)})`);
      } else if (data.status === 'extracting') {
        setBackendProgress(99);
        setBackendStatusText('Extracting engine files...');
      } else if (data.status === 'installing') {
        setBackendProgress(99);
        setBackendStatusText('Configuring local engine...');
      } else if (data.status === 'completed') {
        setBackendProgress(100);
        setBackendStatusText('Backend installed successfully!');
      }
    });

    try {
      const res = await downloadImageBackend(type);
      if (res.success) {
        const status = await getImageBackendStatus();
        setBackendStatus(status);
      } else {
        setBackendError(res.error || 'Failed to install local backend.');
      }
    } catch (err: any) {
      setBackendError(err.message || 'An error occurred during installation.');
    } finally {
      unsubscribe();
      setDownloadingBackend(false);
    }
  };

  const handleCancelBackendDownload = () => {
    cancelImageBackendDownload();
    setDownloadingBackend(false);
    setBackendStatusText('Installation cancelled.');
  };

  const availableImageModels = useMemo(
    () => buildInstalledModelCatalog(downloadedModels, localModelFiles, 'image'),
    [downloadedModels, localModelFiles],
  );

  const activeModel = availableImageModels.find(model => model.id === activeModelId);
  const isLocalEngine = backendStatus.backend === 'stable-diffusion.cpp';
  const isAutomatic1111 = backendStatus.backend === 'automatic1111';
  const safety = checkPromptSafety(prompt);
  const canGenerate = Boolean(activeModel) && backendStatus.available && safety.allowed && !isGenerating;
  const displayProgress = isGenerating ? Math.min(progress, 99) : progress;

  const refreshBackend = useCallback(async () => {
    const status = await getImageBackendStatus();
    setBackendStatus(status);
  }, []);

  useEffect(() => {
    refreshBackend();
  }, [refreshBackend]);

  useEffect(() => {
    if (!activeModelId) return;

    if (activeModelId === 'sdxl-lightning') {
      setSteps(8);
      setCfg(1.5);
      setScheduler('euler_a');
    } else if (activeModelId === 'flux-schnell') {
      setSteps(4);
      setCfg(1.0);
      setScheduler('euler_a');
    } else if (activeModelId === 'sd35-turbo') {
      setSteps(8);
      setCfg(1.5);
      setScheduler('euler_a');

    } else {
      setSteps(25);
      setCfg(7.5);
      setScheduler('dpmpp_2m_karras');
    }
  }, [activeModelId]);

  useEffect(() => {
    return onImageGenerationProgress((data) => {
      if (typeof data.progress === 'number') setProgress(data.progress);
      if (data.text) setProgressText(data.text);
    });
  }, []);

  useEffect(() => {
    if (availableImageModels.length > 0) {
      const isCurrentAvailable = availableImageModels.some(model => model.id === activeModelId);
      if (!isCurrentAvailable) setActiveModelId(availableImageModels[0].id);
    } else {
      setActiveModelId('');
    }
  }, [activeModelId, availableImageModels, setActiveModelId]);

  useEffect(() => {
    if (aspect === '1:1') {
      setWidth(512);
      setHeight(512);
    } else if (aspect === '16:9') {
      setWidth(768);
      setHeight(448);
    } else if (aspect === '9:16') {
      setWidth(448);
      setHeight(768);
    } else if (aspect === '4:3') {
      setWidth(640);
      setHeight(480);
    }
  }, [aspect]);

  const handleGenerate = async () => {
    if (!activeModel || isGenerating) return;

    const safetyCheck = checkPromptSafety(prompt);
    if (!safetyCheck.allowed) {
      setErrorMessage(safetyCheck.reason || 'Prompt blocked by local safety rules.');
      return;
    }

    if (!backendStatus.available) {
      setErrorMessage(backendStatus.detail);
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setProgressText('Starting local image generation...');
    setErrorMessage('');

    const finalSeed = seed === -1 ? Math.floor(Math.random() * 99999999) : seed;

    try {
      const result = await startImageGeneration({
        modelPath: activeModel.filename,
        prompt,
        negativePrompt,
        width,
        height,
        steps,
        cfg,
        seed: finalSeed,
        scheduler,
        clipSkip,
        gpuEnabled: isLocalEngine ? gpuEnabled : undefined,
        selectedGpuIndex: isLocalEngine ? selectedGpuIndex : undefined,
        limitCpuThreads: isLocalEngine ? limitCpuThreads : undefined,
        cpuThreads: isLocalEngine ? cpuThreads : undefined,
        vaeTiling: isLocalEngine ? vaeTiling : undefined,
      });

      if (!result.success || !result.imageUrl) {
        setErrorMessage(cleanErrorMessage(result.error || 'Local image generation failed.'));
        return;
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        url: result.imageUrl,
        outputPath: result.outputPath,
        prompt,
        negativePrompt,
        steps,
        cfg,
        seed: finalSeed,
        aspect,
        model: activeModel.name,
        backend: result.backend,
      };

      setHistory(prev => [newItem, ...prev]);
      setSelectedItem(newItem);
      setProgress(100);
      setProgressText('Image generated locally.');
    } catch (error: any) {
      setErrorMessage(cleanErrorMessage(error.message || 'Local image generation failed.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 99999999));
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div style={{
        width: '300px',
        borderRight: '1px solid var(--border-light)',
        background: 'rgba(13, 15, 19, 0.4)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        height: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          <Sliders size={18} style={{ color: 'var(--accent)' }} />
          <span>Basic Settings</span>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${backendStatus.available ? 'rgba(39, 201, 63, 0.25)' : 'rgba(255, 189, 46, 0.22)'}`,
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={13} />
                Local Backend
              </span>
              <span style={{ fontSize: '0.68rem', color: backendStatus.available ? '#27c93f' : '#ffbd2e' }}>{backendStatus.label}</span>
            </div>
            <button
              className="btn-secondary"
              onClick={refreshBackend}
              title="Rescan local image backend"
              style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RotateCw size={13} />
            </button>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>{backendStatus.detail}</p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-light)',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={13} />
              Safety Lock
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Blocks explicit and prohibited prompts</span>
          </div>
          <span style={{ fontSize: '0.65rem', color: '#27c93f', fontWeight: 700 }}>Enabled</span>
        </div>

        <div style={{ position: 'relative', zIndex: 10 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Active Model</label>
          <CustomDropdown
            value={activeModelId}
            onChange={(val) => setActiveModelId(val)}
            options={availableImageModels.map(model => ({ value: model.id, label: model.name }))}
            placeholder="No image models installed"
          />
        </div>

        <div style={{ position: 'relative', zIndex: 9 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Sampling Method (Scheduler)</label>
          <CustomDropdown
            value={scheduler}
            onChange={(val) => setScheduler(val)}
            options={[
              { value: 'dpmpp_2m_karras', label: 'DPM++ 2M Karras (High Quality)' },
              { value: 'euler_a', label: 'Euler a (Recommended)' },
              { value: 'ddim', label: 'DDIM (Fast)' },
              { value: 'heun', label: 'Heun' },
              { value: 'euler', label: 'Euler' },
            ]}
          />
        </div>

        <div style={{ position: 'relative', zIndex: 7 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Aspect Ratio</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {['1:1', '16:9', '9:16', '4:3'].map(ratio => (
              <button
                key={ratio}
                onClick={() => setAspect(ratio)}
                style={{
                  background: aspect === ratio ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: aspect === ratio ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                  borderRadius: '6px',
                  color: aspect === ratio ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  padding: '6px 0',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Width</span>
            <span>{width} px</span>
          </div>
          <input type="range" min="256" max="1024" step="64" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Height</span>
            <span>{height} px</span>
          </div>
          <input type="range" min="256" max="1024" step="64" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Steps</span>
            <span>{steps}</span>
          </div>
          <input type="range" min="1" max="50" value={steps} onChange={(e) => setSteps(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>CFG Scale</span>
            <span>{cfg}</span>
          </div>
          <input type="range" min="1.0" max="15.0" step="0.5" value={cfg} onChange={(e) => setCfg(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        {isAutomatic1111 && (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Clip Skip (A1111 / Forge)</span>
              <span>{clipSkip}</span>
            </div>
            <input type="range" min="1" max="4" step="1" value={clipSkip} onChange={(e) => setClipSkip(parseInt(e.target.value))} style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', alignItems: 'center' }}>
            <span>Seed</span>
            <button onClick={handleRandomSeed} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              <RefreshCw size={10} />
              <span>Random</span>
            </button>
          </div>
          <input type="text" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)} style={{ width: '100%', fontSize: '0.8rem', textAlign: 'center' }} />
        </div>

        {isLocalEngine && (
          <>
        {/* Accordion header */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '10px' }}>
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)', 
              fontWeight: 700, 
              fontSize: '0.82rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              width: '100%', 
              cursor: 'pointer',
              padding: '4px 0'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={14} style={{ color: 'var(--accent)' }} />
              Hardware & Advanced Settings
            </span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showAdvanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* GPU Settings Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GPU Acceleration</span>
                <input type="checkbox" checked={gpuEnabled} onChange={(e) => setGpuEnabled(e.target.checked)} />
              </div>
              
              {gpuEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Target GPU Index (Device)</label>
                  <CustomDropdown
                    value={String(selectedGpuIndex)}
                    onChange={value => setSelectedGpuIndex(Number(value))}
                    options={[
                      { value: '0', label: 'GPU 0 (Dedicated / Default)' },
                      { value: '1', label: 'GPU 1 (Secondary / Integrated)' },
                      { value: '2', label: 'GPU 2' },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* CPU Threads settings card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Limit CPU Threads</span>
                <input type="checkbox" checked={limitCpuThreads} onChange={(e) => setLimitCpuThreads(e.target.checked)} />
              </div>

              {limitCpuThreads && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>Threads (CPU Load)</span>
                    <span>{cpuThreads} / {systemInfo?.cores || 8}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max={systemInfo?.cores || 16} 
                    value={cpuThreads} 
                    onChange={(e) => setCpuThreads(parseInt(e.target.value))} 
                    style={{ width: '100%' }} 
                  />
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0 }}>
                    Lower threads count keeps Windows responsive during generation.
                  </p>
                </div>
              )}
            </div>

            {/* VAE Tiling Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Low-VRAM VAE Tiling</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Prevents out-of-device memory crashes.</span>
              </div>
              <input type="checkbox" checked={vaeTiling} onChange={(e) => setVaeTiling(e.target.checked)} />
            </div>
          </div>
        )}
          </>
        )}

        {isAutomatic1111 && (
          <div style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '16px',
            color: 'var(--text-muted)',
            fontSize: '0.68rem',
            lineHeight: '1.5',
          }}>
            A1111/Forge manages GPU, CPU, and VRAM options in its own WebUI. Local Model Lab sends the visible prompt and generation settings through its local API.
          </div>
        )}
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#07080a',
        height: '100%',
        position: 'relative',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflow: 'hidden',
        }}>
          {isGenerating ? (
            <div className="generation-visual" aria-live="polite">
              <div className="generation-stage-shell">
                <div className="generation-stage" style={{ aspectRatio: aspect.replace(':', ' / ') }}>
                  <div className="generation-latent-grid" aria-hidden="true">
                    {LATENT_TILES.map(tile => (
                      <span key={tile} style={{ animationDelay: `${-(tile % 16) * 0.13}s` }} />
                    ))}
                  </div>
                  <div className="generation-tone" aria-hidden="true" />
                  <div
                    className="generation-fog"
                    aria-hidden="true"
                    style={{ left: `${Math.max(8, displayProgress)}%` }}
                  />
                  <div
                    className="generation-scan"
                    aria-hidden="true"
                    style={{ left: `${Math.max(8, displayProgress)}%` }}
                  />
                  <div className="generation-grain" aria-hidden="true" />
                  <div className="generation-stage-topline">
                    <span><Sparkles size={14} />Local diffusion</span>
                    <span>{width} x {height}</span>
                  </div>
                  <div className="generation-resolving-mark">
                    <Sparkles size={18} />
                    <span>Resolving details</span>
                  </div>
                  <div className="generation-stage-percent">
                    {displayProgress}<small>%</small>
                  </div>
                </div>
              </div>
              <div className="generation-status">
                <div className="generation-status__line">
                  <span className="generation-live-dot" />
                  <strong>
                    {displayProgress < 18
                      ? 'Preparing composition'
                      : displayProgress < 72
                        ? 'Developing the image'
                        : 'Refining details'}
                  </strong>
                  <span>{displayProgress}%</span>
                </div>
                <div className="generation-progress-track">
                  <span style={{ width: `${displayProgress}%` }} />
                </div>
                <p>{progressText || 'Turning your prompt into pixels...'}</p>
                <div className="generation-metrics">
                  <span>ON-DEVICE</span>
                  <span>{width} x {height}</span>
                  <span>SEED {seed === -1 ? 'RANDOM' : seed}</span>
                </div>
              </div>
            </div>
          ) : selectedItem ? (
            <div style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}>
              <img
                src={selectedItem.url}
                alt="Generated"
                style={{
                  width: '100%',
                  height: 'auto',
                  aspectRatio: selectedItem.aspect ? selectedItem.aspect.replace(':', '/') : '1/1',
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                }}
              />
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={openGenerationsFolder} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '6px 12px' }}>
                  <FolderOpen size={14} />
                  <span>Open folder</span>
                </button>
                <button
                  onClick={() => {
                    const newHistory = history.filter(item => item.id !== selectedItem.id);
                    setHistory(newHistory);
                    setSelectedItem(newHistory[0] || null);
                  }}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '6px 12px', borderColor: 'rgba(255,95,86,0.3)', color: '#ff5f56' }}
                >
                  <Trash2 size={14} />
                  <span>Remove from history</span>
                </button>
                {selectedItem.backend && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {selectedItem.backend === 'stable-diffusion.cpp' ? 'Local Engine' : selectedItem.backend}
                  </span>
                )}
              </div>
            </div>
          ) : !safety.allowed || errorMessage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px', maxWidth: '520px' }}>
              <AlertTriangle size={48} style={{ color: '#ffbd2e' }} />
              <span style={{ color: '#ffbd2e', fontWeight: 600 }}>{errorMessage || safety.reason}</span>
            </div>
          ) : !activeModel ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px', maxWidth: '520px' }}>
              <ImageIcon size={48} style={{ color: '#ff5f56' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#ff5f56', fontWeight: 600 }}>No Image Model Installed</span>
                <span style={{ fontSize: '0.85rem' }}>Download or import a local .safetensors, .ckpt, or image GGUF model first.</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Downloading an image model from Model Library also offers engine setup.
                </span>
              </div>
            </div>
          ) : !backendStatus.available ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              maxWidth: '560px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(8px)',
              textAlign: 'center',
            }}>
              <Cpu size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Setup Local Image Generation Engine
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
                Local Model Lab runs image generation locally. To enable local generation, you need to download a lightweight execution engine (~24MB - 38MB).
              </p>

              {downloadingBackend ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${backendProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #a1a1aa)', transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{backendStatusText}</span>
                  <button onClick={handleCancelBackendDownload} className="btn-secondary" style={{ marginTop: '8px', color: '#ff5f56', borderColor: 'rgba(255, 95, 86, 0.2)' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { type: 'cpu', label: 'CPU Core', size: '24MB', desc: 'Compatible with any PC, slower' },
                      { type: 'vulkan', label: 'Vulkan GPU', size: '38MB', desc: 'Fast. Fits AMD/Intel/Nvidia' },
                      { type: 'cuda12', label: 'CUDA GPU', size: '362MB', desc: 'Nvidia RTX only, fastest' },
                    ].map(opt => (
                      <div
                        key={opt.type}
                        onClick={() => setSelectedBackendType(opt.type as any)}
                        style={{
                          background: selectedBackendType === opt.type ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                          border: selectedBackendType === opt.type ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                          borderRadius: '10px',
                          padding: '12px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: selectedBackendType === opt.type ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{opt.size}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: '1.2', marginTop: '4px' }}>{opt.desc}</span>
                      </div>
                    ))}
                  </div>

                  {backendError && (
                    <div style={{ fontSize: '0.75rem', color: '#ff5f56', marginTop: '4px' }}>{backendError}</div>
                  )}

                  <button
                    onClick={() => handleInstallBackend(selectedBackendType)}
                    className="btn-accent"
                    style={{ padding: '10px 24px', alignSelf: 'center', fontSize: '0.85rem' }}
                  >
                    Download and Setup Engine
                  </button>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Downloading an image model from Model Library also offers engine setup.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px', maxWidth: '520px' }}>
              <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
              <span>Enter a prompt below to generate with your local image backend</span>
            </div>
          )}
        </div>

        <div style={{
          padding: '24px',
          borderTop: '1px solid var(--border-light)',
          background: 'rgba(13, 15, 19, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Describe what you want to visualize..."
              style={{
                flex: 1,
                height: '70px',
                resize: 'none',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.85rem',
              }}
            />

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-accent"
              style={{
                width: '120px',
                height: '42px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              <Play size={16} />
              <span>Generate</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Negative:</span>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => {
                setNegativePrompt(e.target.value);
                setErrorMessage('');
              }}
              placeholder="What to exclude from image..."
              style={{
                flex: 1,
                fontSize: '0.75rem',
                background: 'rgba(0,0,0,0.2)',
                padding: '4px 10px',
                borderRadius: '6px',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{
        width: '260px',
        borderLeft: '1px solid var(--border-light)',
        background: 'rgba(13, 15, 19, 0.4)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
          <Layers size={18} style={{ color: 'var(--accent)' }} />
          <span>Generation History</span>
        </div>

        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          gridAutoRows: 'min-content',
          overflowY: 'auto',
        }}>
          {history.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: selectedItem?.id === item.id ? '2px solid var(--accent)' : '1px solid var(--border-light)',
                transition: 'all 0.2s ease',
              }}
            >
              <img src={item.url} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: selectedItem?.id === item.id ? 'transparent' : 'rgba(0,0,0,0.3)',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onMouseLeave={(e) => {
                  if (selectedItem?.id !== item.id) e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
