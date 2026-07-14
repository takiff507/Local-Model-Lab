import { useCallback, useEffect, useState } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import ChatTab from './components/ChatTab';
import GenerateTab from './components/GenerateTab';
import ModelStoreTab from './components/ModelStoreTab';
import SettingsTab from './components/SettingsTab';
import PolicyTab from './components/PolicyTab';
import StartupSplash from './components/StartupSplash';
import { getSystemInfo, getDownloadedModels, verifyModelDownload, downloadModel, cancelDownload, onDownloadProgress, importLocalModels, getImageBackendStatus, downloadImageBackend, cancelImageBackendDownload, onImageBackendDownloadProgress } from './ipc';
import { RECOMMENDED_MODELS } from './modelsData';
import type { HardwareProfile } from './modelsData';

interface DownloadState {
  progress: number;
  speed: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  error?: string;
  message?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [startupComplete, setStartupComplete] = useState(false);
  const [systemInfo, setSystemInfo] = useState<HardwareProfile & { modelsPath?: string } | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [localModelFiles, setLocalModelFiles] = useState<string[]>([]);
  const [activeTextModelId, setActiveTextModelId] = useState<string>('');
  const [activeImageModelId, setActiveImageModelId] = useState<string>('');
  const [downloadStates, setDownloadStates] = useState<{ [key: string]: DownloadState }>({});

  const completeStartup = useCallback(() => setStartupComplete(true), []);

  const refreshLocalModels = useCallback(async () => {
    const filenames = await getDownloadedModels();
    setLocalModelFiles(filenames);

    const downloadedIds = RECOMMENDED_MODELS
      .filter(model => filenames.includes(model.filename))
      .map(model => model.id);
    setDownloadedModels(downloadedIds);

    return downloadedIds;
  }, []);

  useEffect(() => {
    async function loadSpecsAndModels() {
      const info = await getSystemInfo();
      setSystemInfo(info);

      try {
        const downloadedIds = await refreshLocalModels();

        const firstDownloadedText = RECOMMENDED_MODELS.find(model => model.type === 'text' && downloadedIds.includes(model.id));
        if (firstDownloadedText) setActiveTextModelId(firstDownloadedText.id);

        const firstDownloadedImage = RECOMMENDED_MODELS.find(model => model.type === 'image' && downloadedIds.includes(model.id));
        if (firstDownloadedImage) setActiveImageModelId(firstDownloadedImage.id);
      } catch (err) {
        console.error('Failed to load downloaded models:', err);
      }
    }

    loadSpecsAndModels();
  }, [refreshLocalModels]);

  useEffect(() => {
    setDownloadStates(prev => {
      const initialStates: { [key: string]: DownloadState } = {};
      RECOMMENDED_MODELS.forEach(model => {
        initialStates[model.id] = downloadedModels.includes(model.id)
          ? { progress: 100, speed: 0, status: 'completed' }
          : prev[model.id]?.status === 'downloading'
            ? prev[model.id]
            : { progress: 0, speed: 0, status: 'idle' };
      });
      return { ...initialStates, ...prev };
    });
  }, [downloadedModels]);

  const handleStartDownload = async (model: any) => {
    setDownloadStates(prev => ({
      ...prev,
      [model.id]: { progress: 0, speed: 0, status: 'downloading', message: 'Initializing local setup...' },
    }));

    const availability = await verifyModelDownload(model.id, model.url, model.filename, model.sizeGB);
    if (!availability.success) {
      setDownloadStates(prev => ({
        ...prev,
        [model.id]: {
          progress: 0,
          speed: 0,
          status: 'error',
          error: `Model file unavailable: ${availability.error || 'The source did not pass verification.'}`,
        },
      }));
      return;
    }

    setDownloadStates(prev => ({
      ...prev,
      [model.id]: { ...prev[model.id], status: 'downloading', message: 'Source verified. Preparing download...' },
    }));

    if (model.type === 'image') {
      try {
        const backendStatus = await getImageBackendStatus();
        if (!backendStatus.available) {
          // Detect appropriate backend type based on system spec
          let backendType: 'cpu' | 'vulkan' | 'cuda12' = 'cpu';
          if (systemInfo && systemInfo.gpuMemoryGB && systemInfo.gpuMemoryGB > 0) {
            backendType = 'vulkan'; // Vulkan is recommended (only ~37MB, highly optimized for GPUs)
          }

          const unsubscribeProgress = onImageBackendDownloadProgress((data: any) => {
            let statusText = 'Installing local image engine...';
            if (data.status === 'downloading') {
              statusText = `Downloading engine: ${data.progress}%`;
            } else if (data.status === 'extracting') {
              statusText = 'Extracting engine files...';
            } else if (data.status === 'installing') {
              statusText = 'Configuring local engine...';
            }

            setDownloadStates(prev => {
              if (!prev[model.id] || prev[model.id].status !== 'downloading') return prev;
              return {
                ...prev,
                [model.id]: {
                  progress: Math.round(data.progress * 0.1), // scale progress to 10%
                  speed: data.speed || 0,
                  status: 'downloading',
                  message: statusText,
                }
              };
            });
          });

          const installRes = await downloadImageBackend(backendType);
          unsubscribeProgress();

          if (!installRes.success) {
            setDownloadStates(prev => ({
              ...prev,
              [model.id]: { progress: 0, speed: 0, status: 'error', error: `Local backend setup failed: ${installRes.error || 'Unknown error'}` },
            }));
            return;
          }
        }
      } catch (backendErr: any) {
        console.error('Failed to verify or install local image backend:', backendErr);
        setDownloadStates(prev => ({
          ...prev,
          [model.id]: { progress: 0, speed: 0, status: 'error', error: `Backend check failed: ${backendErr.message}` },
        }));
        return;
      }
    }

    const unsubscribe = onDownloadProgress(model.id, (data: any) => {
      if (data.status === 'downloading') {
        setDownloadStates(prev => ({
          ...prev,
          [model.id]: {
            progress: model.type === 'image' ? Math.round(10 + data.progress * 0.9) : data.progress,
            speed: data.speed,
            status: 'downloading',
            message: 'Downloading local model weights...',
          },
        }));
      } else if (data.status === 'completed') {
        setDownloadStates(prev => ({
          ...prev,
          [model.id]: { progress: 100, speed: 0, status: 'completed' },
        }));

        setDownloadedModels(prev => prev.includes(model.id) ? prev : [...prev, model.id]);
        setLocalModelFiles(prev => prev.includes(model.filename) ? prev : [...prev, model.filename]);
        unsubscribe();
      } else if (data.status === 'error') {
        setDownloadStates(prev => ({
          ...prev,
          [model.id]: { progress: 0, speed: 0, status: 'error', error: data.error },
        }));
        unsubscribe();
      }
    });

    downloadModel(model.id, model.url, model.filename, model.sizeGB);
  };

  const handleCancelDownload = (modelId: string) => {
    cancelDownload(modelId);
    cancelImageBackendDownload();
    setDownloadStates(prev => ({
      ...prev,
      [modelId]: { progress: 0, speed: 0, status: 'idle' },
    }));
  };

  const handleImportLocalModels = async () => {
    const result = await importLocalModels();
    if (!result.success) {
      alert(result.message || 'Failed to import local model files.');
      return;
    }
    await refreshLocalModels();
  };

  return (
    <>
      {!startupComplete && <StartupSplash onComplete={completeStartup} />}
      <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-main)',
      color: '#f3f4f6',
      overflow: 'hidden',
    }}>
      <Titlebar />

      <div style={{
        display: 'flex',
        flex: 1,
        height: 'calc(100vh - var(--titlebar-height))',
        overflow: 'hidden',
      }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <ChatTab
              downloadedModels={downloadedModels}
              localModelFiles={localModelFiles}
              activeModelId={activeTextModelId}
              setActiveModelId={setActiveTextModelId}
            />
          </div>

          <div style={{ display: activeTab === 'generate' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <GenerateTab
              downloadedModels={downloadedModels}
              localModelFiles={localModelFiles}
              activeModelId={activeImageModelId}
              setActiveModelId={setActiveImageModelId}
            />
          </div>

          <div style={{ display: activeTab === 'store' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <ModelStoreTab
              downloadedModels={downloadedModels}
              setDownloadedModels={setDownloadedModels}
              localModelFiles={localModelFiles}
              setLocalModelFiles={setLocalModelFiles}
              systemInfo={systemInfo}
              downloadStates={downloadStates}
              handleStartDownload={handleStartDownload}
              handleCancelDownload={handleCancelDownload}
              handleImportLocalModels={handleImportLocalModels}
            />
          </div>

          <div style={{ display: activeTab === 'settings' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <SettingsTab systemInfo={systemInfo} />
          </div>
          <div style={{ display: activeTab === 'policy' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <PolicyTab />
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
