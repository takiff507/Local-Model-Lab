// IPC Communication helper. Electron uses a whitelisted preload bridge; web preview stays safe and local-only.

interface SystemInfo {
  cpu: string;
  cores: number;
  ram: string;
  ramGB: number;
  gpu: string;
  gpuMemoryGB: number;
  platform: string;
  modelsPath: string;
}

export interface ImageBackendStatus {
  available: boolean;
  backend: 'stable-diffusion.cpp' | 'automatic1111' | 'comfyui' | 'missing';
  label: string;
  detail: string;
}

export interface ImageGenerationRequest {
  modelPath: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  scheduler: string;
  clipSkip: number;
  vae?: string;
  gpuEnabled?: boolean;
  selectedGpuIndex?: number;
  limitCpuThreads?: boolean;
  cpuThreads?: number;
  vaeTiling?: boolean;
  batchCount?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  outputPath?: string;
  backend?: string;
  error?: string;
}

interface LocalModelLabBridge {
  invoke: (channel: string, payload?: unknown) => Promise<any>;
  send: (channel: string, payload?: unknown) => void;
  on: (channel: string, callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    localModelLab?: LocalModelLabBridge;
    require?: any;
  }
}

let legacyIpcRenderer: any = null;

if (typeof window !== 'undefined' && window.require) {
  try {
    const electron = window.require('electron');
    legacyIpcRenderer = electron.ipcRenderer;
  } catch (e) {
    console.warn('Failed to load legacy electron ipcRenderer:', e);
  }
}

const bridge = (): LocalModelLabBridge | null => {
  if (typeof window !== 'undefined' && window.localModelLab) return window.localModelLab;
  if (legacyIpcRenderer) {
    return {
      invoke: (channel, payload) => legacyIpcRenderer.invoke(channel, payload),
      send: (channel, payload) => legacyIpcRenderer.send(channel, payload),
      on: (channel, callback) => {
        const listener = (_event: any, data: any) => callback(data);
        legacyIpcRenderer.on(channel, listener);
        return () => legacyIpcRenderer.removeListener(channel, listener);
      },
    };
  }
  return null;
};

export const isElectron = () => bridge() !== null;

export const getSystemInfo = async (): Promise<SystemInfo> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('get-system-info');
  }

  return {
    cpu: 'Desktop app required',
    cores: 0,
    ram: 'Unknown',
    ramGB: 0,
    gpu: 'Unknown',
    gpuMemoryGB: 0,
    platform: 'browser-preview',
    modelsPath: 'Available in the desktop app',
  };
};

export const getDownloadedModels = async (): Promise<string[]> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('get-downloaded-models');
  }
  return [];
};

export const importLocalModels = async (): Promise<{ success: boolean; files: string[]; message?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('import-local-models');
  }
  return { success: false, files: [], message: 'Import is available inside the desktop app.' };
};

export const openExternal = async (url: string): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) return await ipc.invoke('open-external', { url });
  window.open(url, '_blank', 'noopener,noreferrer');
  return { success: true };
};
export const getStartOnBoot = async (): Promise<{ enabled: boolean; supported: boolean }> => {
  const ipc = bridge();
  if (ipc) return await ipc.invoke('get-start-on-boot');
  return { enabled: false, supported: false };
};

export const setStartOnBoot = async (enabled: boolean): Promise<{ success: boolean; enabled: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) return await ipc.invoke('set-start-on-boot', { enabled });
  return { success: false, enabled: false, message: 'Available in the packaged desktop app.' };
};

export const openGenerationsFolder = async (): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) return await ipc.invoke('open-generations-folder');
  return { success: false, message: 'Available in the desktop app.' };
};
export const openModelsFolder = async (): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('open-models-folder');
  }
  return { success: false, message: 'Models folder opens inside the desktop app.' };
};

export const exportChat = async (messages: { sender: string; text: string; timestamp: string }[]): Promise<{ success: boolean; canceled?: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) return await ipc.invoke('export-chat', { messages });
  return { success: false, message: 'Chat export is available in the desktop app.' };
};
export const deleteModel = async (filename: string): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('delete-model', { filename });
  }
  return { success: false, message: 'Model deletion is available in the desktop app.' };
};

export const startTextEngine = async (modelPath: string, systemPrompt?: string): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('start-text-engine', { modelPath, systemPrompt });
  }
  return { success: false, message: 'Text engine runs only inside Electron.' };
};

export const stopTextEngine = async (): Promise<{ success: boolean; message?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('stop-text-engine');
  }
  return { success: false, message: 'Text engine runs only inside Electron.' };
};

export const chatCompletion = async (
  messages: { role: string; content: string }[],
  temperature: number = 0.7,
  maxTokens: number = 512,
  systemPrompt?: string,
  topP?: number,
  repPenalty?: number
): Promise<{ success: boolean; content?: string; error?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('chat-completion', { messages, temperature, maxTokens, systemPrompt, topP, repPenalty });
  }
  return { success: false, error: 'Not running in Electron.' };
};

export const getImageBackendStatus = async (): Promise<ImageBackendStatus> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('get-image-backend-status');
  }
  return {
    available: false,
    backend: 'missing',
    label: 'Desktop Required',
    detail: 'Image backends are detected only inside the desktop app.',
  };
};

export const startImageGeneration = async (payload: ImageGenerationRequest): Promise<ImageGenerationResult> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('start-image-generation', payload);
  }
  return { success: false, error: 'Local image generation runs only inside Electron.' };
};

export const downloadImageBackend = async (backendType: 'cpu' | 'vulkan' | 'cuda12'): Promise<{ success: boolean; error?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('download-image-backend', { backendType });
  }
  return { success: false, error: 'Not running inside the desktop app.' };
};

export const cancelImageBackendDownload = () => {
  const ipc = bridge();
  if (ipc) {
    ipc.send('cancel-image-backend-download');
  }
};

export const onImageBackendDownloadProgress = (callback: (data: any) => void) => {
  const ipc = bridge();
  if (ipc) {
    return ipc.on('image-backend-download-progress', callback);
  }
  return () => undefined;
};

export const verifyModelDownload = async (modelId: string, url: string, filename: string, sizeGB: number): Promise<{ success: boolean; totalBytes?: number; error?: string }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('verify-model-download', { modelId, url, filename, sizeGB });
  }
  return { success: false, error: 'Model downloads are available inside the desktop app.' };
};

export const downloadModel = (modelId: string, url: string, filename: string, sizeGB: number) => {
  const ipc = bridge();
  if (ipc) {
    ipc.send('download-model', { modelId, url, filename, sizeGB });
  } else {
    console.log(`Desktop app required to download model: ${modelId} from ${url}`);
  }
};

export const cancelDownload = (modelId: string) => {
  const ipc = bridge();
  if (ipc) {
    ipc.send('cancel-download', { modelId });
  }
};

export const onDownloadProgress = (modelId: string, callback: (data: any) => void) => {
  const ipc = bridge();
  if (ipc) {
    return ipc.on(`download-progress-${modelId}`, callback);
  }
  return () => undefined;
};

export const onEngineLog = (callback: (data: { type?: string; text: string }) => void) => {
  const ipc = bridge();
  if (ipc) {
    return ipc.on('engine-log', callback);
  }
  return () => undefined;
};

export const onImageGenerationProgress = (callback: (data: { progress?: number; text?: string }) => void) => {
  const ipc = bridge();
  if (ipc) {
    return ipc.on('image-generation-progress', callback);
  }
  return () => undefined;
};

export const minimizeWindow = () => {
  const ipc = bridge();
  if (ipc) ipc.send('window-minimize');
};

export const maximizeWindow = () => {
  const ipc = bridge();
  if (ipc) ipc.send('window-maximize');
};

export const closeWindow = () => {
  const ipc = bridge();
  if (ipc) ipc.send('window-close');
};

export const getSystemStatus = async (): Promise<{ cpuUsage: number; ramUsage: number; gpuUsage: number | null }> => {
  const ipc = bridge();
  if (ipc) {
    return await ipc.invoke('get-system-status');
  }
  return { cpuUsage: 0, ramUsage: 0, gpuUsage: null };
};
