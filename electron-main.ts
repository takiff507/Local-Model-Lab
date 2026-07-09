import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, execFile, execSync } from 'child_process';
import * as os from 'os';
import axios from 'axios';
import { fileURLToPath, pathToFileURL } from 'url';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let activeDownloads: { [key: string]: { cancel: () => void } } = {};

const MODEL_EXTENSIONS = ['.gguf', '.safetensors', '.ckpt', '.bin'];

function sendEngineLog(text: string, type = 'system') {
  mainWindow?.webContents.send('engine-log', { type, text });
}

function sendImageProgress(progress: number, text: string) {
  mainWindow?.webContents.send('image-generation-progress', { progress, text });
}

function getModelsFolder() {
  return path.join(app.getPath('userData'), 'LocalAI_Models');
}

function getImageOutputFolder() {
  return path.join(app.getPath('userData'), 'LML_Generations');
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isModelFile(filename: string) {
  return MODEL_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

const TRUSTED_MODEL_HOSTS = new Set(['huggingface.co']);

function isTrustedDownloadHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return TRUSTED_MODEL_HOSTS.has(normalized) || normalized.endsWith('.hf.co');
}

function validateModelDownloadInput(payload: any) {
  const modelId = String(payload?.modelId || '');
  const filename = path.basename(String(payload?.filename || ''));
  const rawUrl = String(payload?.url || '');

  if (!/^[a-z0-9][a-z0-9._:-]{1,80}$/i.test(modelId)) throw new Error('Invalid model identifier.');
  if (!filename || filename !== payload?.filename || !isModelFile(filename)) throw new Error('Invalid model filename.');

  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' || !TRUSTED_MODEL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Only verified HTTPS downloads from Hugging Face are allowed.');
  }
  if (!parsed.pathname.includes('/resolve/') || decodeURIComponent(parsed.pathname).split('/').pop() !== filename) {
    throw new Error('Model URL and filename do not match.');
  }

  const sizeGB = Number(payload?.sizeGB || 0);
  return { modelId, filename, url: parsed.toString(), sizeGB: Number.isFinite(sizeGB) ? sizeGB : 0 };
}

function getRemoteSize(headers: Record<string, any>) {
  const value = headers['x-linked-size'] || headers['content-length'] || '0';
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertDownloadResponse(response: any) {
  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
    throw new Error(`Model host returned ${contentType || 'a non-model response'} instead of model weights.`);
  }
  const finalUrl = String(response.request?.res?.responseUrl || response.config?.url || '');
  if (finalUrl) {
    const finalHost = new URL(finalUrl).hostname;
    if (!isTrustedDownloadHost(finalHost)) throw new Error(`Blocked untrusted download redirect: ${finalHost}`);
  }
}

async function probeRemoteModel(url: string) {
  const response = await axios.head(url, {
    timeout: 20000,
    maxRedirects: 8,
    beforeRedirect: options => {
      if (options.hostname && !isTrustedDownloadHost(options.hostname)) {
        throw new Error(`Blocked untrusted download redirect: ${options.hostname}`);
      }
    },
  });
  assertDownloadResponse(response);
  return {
    totalBytes: getRemoteSize(response.headers),
    finalUrl: String(response.request?.res?.responseUrl || url),
  };
}
function safeModelPath(filenameOrPath: string) {
  if (path.isAbsolute(filenameOrPath)) {
    return filenameOrPath;
  }
  return path.join(getModelsFolder(), path.basename(filenameOrPath));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const distPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

function detectNvidiaGpu() {
  try {
    const output = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
      timeout: 2500,
      windowsHide: true,
    }).toString().trim();

    if (!output) return null;
    const rows = output.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
    let maxMemoryGB = 0;
    const names: string[] = [];

    for (const row of rows) {
      const [name, memoryMb] = row.split(',').map(part => part.trim());
      if (name) names.push(name);
      const parsed = Number(memoryMb);
      if (!Number.isNaN(parsed)) {
        maxMemoryGB = Math.max(maxMemoryGB, Math.round(parsed / 1024));
      }
    }

    return {
      name: names.join(' / '),
      memoryGB: maxMemoryGB,
    };
  } catch {
    return null;
  }
}

function detectWindowsGpus() {
  if (process.platform !== 'win32') return null;

  try {
    // Try registry query first to bypass Win32_VideoController 4GB VRAM overflow limitation
    const command = `powershell -NoProfile -Command "Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | Where-Object { $_.'HardwareInformation.qwMemorySize' -ne $null } | Select-Object @{N='Name';E={$_.'HardwareInformation.AdapterString'}}, @{N='AdapterRAM';E={$_.'HardwareInformation.qwMemorySize'}} | ConvertTo-Json -Compress"`;
    let output = '';
    try {
      output = execSync(command, { timeout: 4000, windowsHide: true }).toString().trim();
    } catch {
      // ignore registry query fail
    }

    // Fallback to WMI if registry query is empty or failed
    if (!output || output === '[]') {
      const wmiCommand = 'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"';
      output = execSync(wmiCommand, { timeout: 4000, windowsHide: true }).toString().trim();
    }

    if (!output) return null;

    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const names: string[] = [];
    let maxMemoryGB = 0;

    for (const row of rows) {
      const name = row?.Name || row?.['HardwareInformation.AdapterString'];
      if (name) names.push(String(name));
      const adapterRam = Number(row?.AdapterRAM || 0);
      if (adapterRam > 0) {
        maxMemoryGB = Math.max(maxMemoryGB, Math.round(adapterRam / (1024 * 1024 * 1024)));
      }
    }

    return {
      name: names.join(' / '),
      memoryGB: maxMemoryGB,
    };
  } catch (error) {
    console.error('Failed to detect Windows GPU info:', error);
    return null;
  }
}

ipcMain.handle('get-system-info', async () => {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
  const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const nvidia = detectNvidiaGpu();
  const windowsGpu = detectWindowsGpus();
  const gpuName = nvidia?.name || windowsGpu?.name || 'Integrated / Unknown GPU';
  const gpuMemoryGB = nvidia?.memoryGB || windowsGpu?.memoryGB || 0;

  ensureDir(getModelsFolder());
  ensureDir(getImageOutputFolder());

  return {
    cpu: cpuModel,
    cores: cpus.length,
    ram: `${totalMemoryGB} GB`,
    ramGB: totalMemoryGB,
    gpu: gpuName,
    gpuMemoryGB,
    platform: process.platform,
    modelsPath: getModelsFolder(),
  };
});

ipcMain.handle('get-downloaded-models', async () => {
  const modelsFolder = getModelsFolder();
  ensureDir(modelsFolder);

  try {
    return fs.readdirSync(modelsFolder).filter(file => isModelFile(file) && !file.endsWith('.tmp'));
  } catch (error) {
    console.error('Failed to read models folder:', error);
    return [];
  }
});

ipcMain.handle('get-start-on-boot', async () => ({
  enabled: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
  supported: app.isPackaged,
}));

ipcMain.handle('set-start-on-boot', async (_event, payload) => {
  if (!app.isPackaged) return { success: false, enabled: false, message: 'Available in the packaged Windows app.' };
  const enabled = Boolean(payload?.enabled);
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  return { success: true, enabled: app.getLoginItemSettings().openAtLogin };
});

ipcMain.handle('open-generations-folder', async () => {
  try {
    ensureDir(getImageOutputFolder());
    const message = await shell.openPath(getImageOutputFolder());
    return message ? { success: false, message } : { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});
ipcMain.handle('open-models-folder', async () => {
  try {
    ensureDir(getModelsFolder());
    await shell.openPath(getModelsFolder());
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('open-external', async (_event, payload) => {
  try {
    const parsed = new URL(String(payload?.url || ''));
    const allowedHosts = new Set(['huggingface.co', 'github.com']);
    if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) {
      throw new Error('Blocked untrusted external URL.');
    }
    await shell.openExternal(parsed.toString());
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});
ipcMain.handle('import-local-models', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import local AI model files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'AI Model Files', extensions: ['gguf', 'safetensors', 'ckpt', 'bin'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, files: [] };
    }

    const modelsFolder = getModelsFolder();
    ensureDir(modelsFolder);
    const imported: string[] = [];

    for (const selectedPath of result.filePaths) {
      const filename = path.basename(selectedPath);
      if (!isModelFile(filename)) continue;

      const destPath = path.join(modelsFolder, filename);
      if (path.resolve(selectedPath) !== path.resolve(destPath)) {
        fs.copyFileSync(selectedPath, destPath);
      }
      imported.push(filename);
      sendEngineLog(`[models] Imported local model: ${filename}`);
    }

    return { success: true, files: imported };
  } catch (error: any) {
    return { success: false, files: [], message: error.message };
  }
});

ipcMain.handle('export-chat', async (_event, payload) => {
  try {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export local chat',
      defaultPath: `LML-Chat-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: 'Text document', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    const body = messages
      .slice(0, 1000)
      .map((message: any) => `${String(message?.sender || 'message').toUpperCase()} [${String(message?.timestamp || '')}]\n${String(message?.text || '')}`)
      .join('\n\n');
    fs.writeFileSync(result.filePath, `Local Model Lab - Local Chat Export\n${new Date().toLocaleString()}\n\n${body}\n`, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});
ipcMain.handle('delete-model', async (_event, { filename }) => {
  const safeName = path.basename(filename);
  const filePath = path.join(getModelsFolder(), safeName);
  const tempPath = `${filePath}.tmp`;

  try {
    let deleted = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      deleted = true;
    }
    return deleted ? { success: true } : { success: false, message: 'File not found' };
  } catch (error: any) {
    console.error('Failed to delete model file:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('verify-model-download', async (_event, payload) => {
  try {
    const request = validateModelDownloadInput(payload);
    const remote = await probeRemoteModel(request.url);
    const minimumBytes = request.sizeGB > 0 ? Math.floor(request.sizeGB * 0.6 * 1024 * 1024 * 1024) : 1024 * 1024;
    if (remote.totalBytes > 0 && remote.totalBytes < minimumBytes) {
      throw new Error('The remote file is much smaller than the catalog entry. Download blocked for safety.');
    }
    return { success: true, totalBytes: remote.totalBytes, finalUrl: remote.finalUrl };
  } catch (error: any) {
    const status = error?.response?.status;
    const prefix = status ? `HTTP ${status}: ` : '';
    return { success: false, error: `${prefix}${error.message || 'Model file is unavailable.'}` };
  }
});

ipcMain.on('download-model', async (event, payload) => {
  let request: ReturnType<typeof validateModelDownloadInput>;
  try {
    request = validateModelDownloadInput(payload);
  } catch (error: any) {
    const channelId = String(payload?.modelId || 'invalid').replace(/[^a-z0-9._:-]/gi, '').slice(0, 80) || 'invalid';
    event.sender.send(`download-progress-${channelId}`, { status: 'error', error: error.message });
    return;
  }

  const { modelId, filename: safeName, url, sizeGB } = request;
  const modelsFolder = getModelsFolder();
  ensureDir(modelsFolder);
  const destPath = path.join(modelsFolder, safeName);
  const tempPath = `${destPath}.tmp`;

  try {
    const remote = await probeRemoteModel(url);
    const totalBytes = remote.totalBytes;
    const minimumBytes = sizeGB > 0 ? Math.floor(sizeGB * 0.6 * 1024 * 1024 * 1024) : 1024 * 1024;

    if (totalBytes > 0 && totalBytes < minimumBytes) {
      throw new Error('Remote file size does not match the model catalog.');
    }

    if (totalBytes > 0 && fs.existsSync(destPath) && fs.statSync(destPath).size === totalBytes) {
      event.sender.send(`download-progress-${modelId}`, {
        progress: 100,
        downloaded: totalBytes,
        total: totalBytes,
        speed: 0,
        status: 'completed',
        filePath: destPath,
      });
      return;
    }

    if (fs.existsSync(tempPath) && totalBytes > 0 && fs.statSync(tempPath).size > totalBytes) {
      fs.unlinkSync(tempPath);
    }

    const startByte = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
    const isResuming = startByte > 0;
    const cancelTokenSource = axios.CancelToken.source();
    activeDownloads[modelId] = { cancel: () => cancelTokenSource.cancel('User cancelled download') };

    const headers: Record<string, string> = {};
    if (isResuming) headers.Range = `bytes=${startByte}-`;

    const response = await axios({
      method: 'get',
      url,
      headers,
      responseType: 'stream',
      cancelToken: cancelTokenSource.token,
      timeout: 30000,
      maxRedirects: 8,
      beforeRedirect: options => {
        if (options.hostname && !isTrustedDownloadHost(options.hostname)) {
          throw new Error(`Blocked untrusted download redirect: ${options.hostname}`);
        }
      },
    });
    assertDownloadResponse(response);

    const responseBytes = getRemoteSize(response.headers);
    const actualTotalBytes = totalBytes || (response.status === 206 ? startByte + responseBytes : responseBytes);
    const useResume = isResuming && response.status === 206;
    let downloadedBytes = useResume ? startByte : 0;
    let lastTime = Date.now();
    let lastDownloaded = downloadedBytes;
    let currentSpeed = 0;

    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      const currentTime = Date.now();
      const timeElapsed = (currentTime - lastTime) / 1000;
      if (timeElapsed >= 0.5) {
        currentSpeed = Math.round((downloadedBytes - lastDownloaded) / timeElapsed);
        lastDownloaded = downloadedBytes;
        lastTime = currentTime;
      }
      const progress = actualTotalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / actualTotalBytes) * 100)) : 0;
      event.sender.send(`download-progress-${modelId}`, {
        progress,
        downloaded: downloadedBytes,
        total: actualTotalBytes,
        speed: currentSpeed,
        status: 'downloading',
      });
    });

    const writer = fs.createWriteStream(tempPath, { flags: useResume ? 'a' : 'w' });
    await pipeline(response.data, writer);

    const finalSize = fs.statSync(tempPath).size;
    if (actualTotalBytes > 0 && finalSize !== actualTotalBytes) {
      throw new Error(`Incomplete download: received ${finalSize} of ${actualTotalBytes} bytes. Retry will resume it.`);
    }
    if (finalSize < minimumBytes) {
      throw new Error('Downloaded file failed the size integrity check.');
    }

    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    fs.renameSync(tempPath, destPath);
    delete activeDownloads[modelId];
    event.sender.send(`download-progress-${modelId}`, {
      progress: 100,
      downloaded: finalSize,
      total: actualTotalBytes || finalSize,
      speed: 0,
      status: 'completed',
      filePath: destPath,
    });
    sendEngineLog(`[models] Download verified and completed: ${safeName}`);
  } catch (error: any) {
    delete activeDownloads[modelId];
    const status = error?.response?.status;
    const message = axios.isCancel(error)
      ? 'Cancelled. The partial file is saved and can be resumed.'
      : `${status ? `HTTP ${status}: ` : ''}${error.message || 'Download failed.'}`;
    event.sender.send(`download-progress-${modelId}`, { status: 'error', error: message });
  }
});

ipcMain.on('cancel-download', (_event, { modelId }) => {
  if (activeDownloads[modelId]) {
    activeDownloads[modelId].cancel();
    delete activeDownloads[modelId];
  }
});

let activeBackendDownload: { cancel: () => void } | null = null;

ipcMain.handle('download-image-backend', async (event, { backendType }) => {
  const urls = {
    cpu: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-767-885f01a/sd-master-885f01a-bin-win-cpu-x64.zip',
    vulkan: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-767-885f01a/sd-master-885f01a-bin-win-vulkan-x64.zip',
    cuda12: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-767-885f01a/sd-master-885f01a-bin-win-cuda12-x64.zip'
  };

  const url = urls[backendType as keyof typeof urls];
  if (!url) {
    return { success: false, error: `Invalid backend type: ${backendType}` };
  }

  const tempFolder = app.getPath('temp');
  const filename = `sd-backend-${backendType}.zip`;
  const zipPath = path.join(tempFolder, filename);
  const extractPath = path.join(tempFolder, `sd-extract-${backendType}`);

  try {
    // 1. Download ZIP file
    const cancelTokenSource = axios.CancelToken.source();
    activeBackendDownload = { cancel: () => cancelTokenSource.cancel('User cancelled download') };

    event.sender.send('image-backend-download-progress', { status: 'downloading', progress: 0, speed: 0 });

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      cancelToken: cancelTokenSource.token,
    });

    const totalBytes = parseInt(String(response.headers['content-length'] || '0'), 10);
    let downloadedBytes = 0;
    let lastTime = Date.now();
    let lastDownloaded = 0;
    let currentSpeed = 0;

    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      const currentTime = Date.now();
      const timeElapsed = (currentTime - lastTime) / 1000;

      if (timeElapsed >= 0.5) {
        currentSpeed = Math.round((downloadedBytes - lastDownloaded) / timeElapsed);
        lastDownloaded = downloadedBytes;
        lastTime = currentTime;
      }

      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      event.sender.send('image-backend-download-progress', {
        status: 'downloading',
        progress,
        downloaded: downloadedBytes,
        total: totalBytes,
        speed: currentSpeed,
      });
    });

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (err) => reject(err));
    });

    activeBackendDownload = null;

    // 2. Unzip using PowerShell
    event.sender.send('image-backend-download-progress', { status: 'extracting', progress: 99 });
    
    // Clean extract path if exists
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    fs.mkdirSync(extractPath, { recursive: true });

    const psCommand = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`;
    await new Promise<void>((resolve, reject) => {
      exec(psCommand, { windowsHide: true }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // 3. Move files to appData userData/bin
    event.sender.send('image-backend-download-progress', { status: 'installing', progress: 99 });

    const destBinFolder = path.join(app.getPath('userData'), 'bin');
    ensureDir(destBinFolder);

    // Recursively search for sd.exe or sd-cli.exe inside the extracted folder
    function findExeDir(dir: string): string {
      const files = fs.readdirSync(dir);
      if (files.some(f => {
        const l = f.toLowerCase();
        return l === 'sd.exe' || l === 'sd-cli.exe' || l === 'stable-diffusion.exe';
      })) {
        return dir;
      }
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          const found = findExeDir(fullPath);
          if (found) return found;
        }
      }
      return '';
    }

    const sourceDir = findExeDir(extractPath) || extractPath;

    // Copy all files and folders from sourceDir to destBinFolder
    const itemsToCopy = fs.readdirSync(sourceDir);
    for (const item of itemsToCopy) {
      const srcItem = path.join(sourceDir, item);
      const destItem = path.join(destBinFolder, item);
      if (fs.statSync(srcItem).isDirectory()) {
        fs.cpSync(srcItem, destItem, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcItem, destItem);
      }
    }

    // 4. Cleanup
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Failed to clean up temp files:', cleanupErr);
    }

    event.sender.send('image-backend-download-progress', { status: 'completed', progress: 100 });
    return { success: true };
  } catch (error: any) {
    activeBackendDownload = null;
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
    } catch {}
    console.error('Backend download/install error:', error);
    return { success: false, error: error.message || 'Failed to install backend.' };
  }
});

ipcMain.on('cancel-image-backend-download', () => {
  if (activeBackendDownload) {
    activeBackendDownload.cancel();
    activeBackendDownload = null;
  }
});

let activeLlama: any = null;
let activeModel: any = null;
let activeContext: any = null;
let activeSession: any = null;
let activeTextModelPath = '';

async function disposeTextEngine() {
  if (activeSession) activeSession = null;
  if (activeContext) { await activeContext.dispose(); activeContext = null; }
  if (activeModel) { await activeModel.dispose(); activeModel = null; }
  activeLlama = null;
  activeTextModelPath = '';
}

ipcMain.handle('start-text-engine', async (_event, { modelPath, systemPrompt }) => {
  try {
    const absoluteModelPath = safeModelPath(modelPath);
    if (!fs.existsSync(absoluteModelPath)) {
      return { success: false, message: `Model file not found: ${absoluteModelPath}` };
    }

    if (activeSession && path.resolve(activeTextModelPath) === path.resolve(absoluteModelPath)) {
      return { success: true, message: 'Model already loaded' };
    }

    if (activeSession) {
      sendEngineLog('[engine] Switching model. Unloading previous model...', 'text');
      await disposeTextEngine();
    }

    sendEngineLog('[engine] Loading built-in llama.cpp runtime...', 'text');
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp');

    activeLlama = await getLlama();
    sendEngineLog('[engine] Runtime ready. Loading model file...', 'text');

    activeModel = await activeLlama.loadModel({ modelPath: absoluteModelPath });
    sendEngineLog('[engine] Model loaded. Creating context...', 'text');

    activeContext = await activeModel.createContext({ contextSize: 2048 });
    activeSession = new LlamaChatSession({
      contextSequence: activeContext.getSequence(),
      systemPrompt: systemPrompt || 'You are a helpful, respectful, and honest assistant.',
    });
    activeTextModelPath = absoluteModelPath;

    sendEngineLog('[engine] Text model ready. Chat is fully local.', 'text');
    mainWindow?.webContents.send('engine-status', { type: 'text', status: 'running' });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to start text engine:', error);
    sendEngineLog(`[engine] Error: ${error.message}`, 'text');
    try { await disposeTextEngine(); } catch {}
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-text-engine', async () => {
  try {
    await disposeTextEngine();
    sendEngineLog('[engine] Text model unloaded from memory.', 'text');
    mainWindow?.webContents.send('engine-status', { type: 'text', status: 'stopped' });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('chat-completion', async (_event, { messages, temperature = 0.7, maxTokens = 512, topP = 0.9, repPenalty = 1.1 }) => {
  if (!activeSession) {
    return { success: false, error: 'Model not loaded. Please launch a model first.' };
  }

  try {
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    sendEngineLog(`[inference] Processing prompt (${lastUserMessage.length} chars)...`, 'text');

    const response = await activeSession.prompt(lastUserMessage, {
      maxTokens,
      temperature,
      topP,
      repeatPenalty: { penalty: repPenalty },
    });

    sendEngineLog(`[inference] Response generated (${response.length} chars).`, 'text');
    return { success: true, content: response };
  } catch (error: any) {
    console.error('Chat completion error:', error);
    return { success: false, error: error.message };
  }
});

function localSafetyCheck(prompt: string, safetyEnabled: boolean) {
  const normalized = ` ${prompt.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const hardBlocks = [' child porn ', ' rape ', ' sexual assault ', ' non consensual ', ' nonconsensual ', ' bestiality '];
  const explicit = [' nude ', ' nudity ', ' porn ', ' xxx ', ' explicit ', ' sex ', ' sexual ', ' erotic ', ' fetish ', ' genitals ', ' nsfw '];
  const minor = [' minor ', ' underage ', ' child ', ' kid ', ' teen ', ' schoolgirl ', ' schoolboy ', ' loli ', ' shota '];

  const hasHardBlock = hardBlocks.some(term => normalized.includes(term));
  const hasExplicit = explicit.some(term => normalized.includes(term));
  const hasMinor = minor.some(term => normalized.includes(term));

  if (hasHardBlock || (hasExplicit && hasMinor)) {
    return 'Blocked by local 18+ safety rules.';
  }
  if (safetyEnabled && hasExplicit) {
    return '18+ safety is ON. Disable it only for lawful adult-only local workflows.';
  }
  return '';
}

function getBinSearchPaths() {
  const paths = [
    path.join(app.getPath('userData'), 'bin'),
    path.join(__dirname, 'bin'),
    path.join(app.getAppPath(), 'bin'),
  ];

  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, 'bin'));
  }

  return Array.from(new Set(paths));
}

function findStableDiffusionCli() {
  const candidates = [
    'sd.exe',
    'sd-cli.exe',
    'stable-diffusion.exe',
    'stable-diffusion-cli.exe',
    'stable-diffusion.cpp.exe',
    'sd',
    'stable-diffusion',
  ];

  for (const binDir of getBinSearchPaths()) {
    for (const candidate of candidates) {
      const fullPath = path.join(binDir, candidate);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  return '';
}

async function detectAutomatic1111() {
  try {
    await axios.get('http://127.0.0.1:7860/sdapi/v1/options', { timeout: 900 });
    return true;
  } catch {
    return false;
  }
}

async function detectComfyUI() {
  try {
    await axios.get('http://127.0.0.1:8188/system_stats', { timeout: 900 });
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('get-image-backend-status', async () => {
  const cliPath = findStableDiffusionCli();
  if (cliPath) {
    return {
      available: true,
      backend: 'Local Engine',
      label: 'Local GPU Engine Ready',
      detail: 'Using local graphics hardware acceleration.',
    };
  }

  if (await detectAutomatic1111()) {
    return {
      available: true,
      backend: 'automatic1111',
      label: 'A1111/Forge Ready',
      detail: 'Detected local Stable Diffusion WebUI on 127.0.0.1:7860.',
    };
  }

  if (await detectComfyUI()) {
    return {
      available: false,
      backend: 'comfyui',
      label: 'ComfyUI Detected',
      detail: 'ComfyUI is local, but automatic workflow wiring is not enabled yet. Use stable-diffusion.cpp or A1111/Forge for one-click generation.',
    };
  }

  return {
    available: false,
    backend: 'missing',
    label: 'Backend Missing',
    detail: 'Install a local generation engine or start a local WebUI with API enabled.',
  };
});

function mapA1111Sampler(scheduler: string) {
  const samplers: Record<string, string> = {
    dpmpp_2m_karras: 'DPM++ 2M Karras',
    euler_a: 'Euler a',
    ddim: 'DDIM',
    heun: 'Heun',
    euler: 'Euler',
  };
  return samplers[scheduler] || 'Euler a';
}

function mapSdCppSampler(scheduler: string) {
  const samplers: Record<string, string> = {
    dpmpp_2m_karras: 'dpm++2m',
    euler_a: 'euler_a',
    ddim: 'euler_a',
    heun: 'heun',
    euler: 'euler',
  };
  return samplers[scheduler] || 'euler_a';
}

function runStableDiffusionCli(exePath: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = execFile(exePath, args, { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 * 20 }, (error) => {
      if (error) reject(error);
      else resolve();
    });

    const parseProgress = (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        sendEngineLog(`[image] ${text}`, 'image');

        // Look for progress pattern like "18/25" or "25/25"
        const match = text.match(/(\d+)\/(\d+)/);
        if (match) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          if (total > 0 && current <= total) {
            const percent = Math.round((current / total) * 100);
            sendImageProgress(percent, `Generating: Step ${current}/${total}`);
          }
        }
      }
    };

    child.stdout?.on('data', parseProgress);
    child.stderr?.on('data', parseProgress);
  });
}

async function generateWithStableDiffusionCpp(payload: any, modelPath: string, outputPath: string) {
  const exePath = findStableDiffusionCli();
  if (!exePath) throw new Error('stable-diffusion.cpp executable was not found.');

  const args = [
    '-m', modelPath,
    '-p', payload.prompt,
    '-n', payload.negativePrompt || '',
    '-W', String(payload.width),
    '-H', String(payload.height),
    '--steps', String(payload.steps),
    '--cfg-scale', String(payload.cfg),
    '--sampling-method', mapSdCppSampler(payload.scheduler),
    '--seed', String(payload.seed),
    '-o', outputPath,
  ];

  // Apply VAE Tiling based on user preference (default: true)
  if (payload.vaeTiling !== false) {
    args.push('--vae-tiling');
  }

  // Set custom CPU threads if enabled
  if (payload.limitCpuThreads && payload.cpuThreads > 0) {
    args.push('--threads', String(payload.cpuThreads));
  }

  // Set custom batch count
  if (payload.batchCount && payload.batchCount > 1) {
    args.push('--batch-count', String(payload.batchCount));
  }

  // Configure GPU visible devices environment variables
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (payload.gpuEnabled === false) {
    env.GGML_VK_VISIBLE_DEVICES = '';
    env.GGML_VULKAN_DEVICE = '-1';
    env.CUDA_VISIBLE_DEVICES = '-1';
  } else {
    const gpuIndex = typeof payload.selectedGpuIndex === 'number' ? payload.selectedGpuIndex : 0;
    env.GGML_VULKAN_DEVICE = String(gpuIndex);
    env.GGML_VK_VISIBLE_DEVICES = String(gpuIndex);
    env.CUDA_VISIBLE_DEVICES = String(gpuIndex);
  }

  sendImageProgress(5, 'Preparing local generation engine...');
  sendEngineLog(`[image] Local Engine active: ${path.basename(exePath)}`, 'image');
  await runStableDiffusionCli(exePath, args, path.dirname(exePath), env);
}

async function generateWithAutomatic1111(payload: any, outputPath: string) {
  sendImageProgress(18, 'Sending job to local A1111/Forge backend...');
  const response = await axios.post('http://127.0.0.1:7860/sdapi/v1/txt2img', {
    prompt: payload.prompt,
    negative_prompt: payload.negativePrompt || '',
    width: payload.width,
    height: payload.height,
    steps: payload.steps,
    cfg_scale: payload.cfg,
    seed: payload.seed,
    sampler_name: mapA1111Sampler(payload.scheduler),
    clip_skip: payload.clipSkip,
    save_images: false,
    send_images: true,
  }, { timeout: 1000 * 60 * 30 });

  const image = response.data?.images?.[0];
  if (!image) throw new Error('Local backend returned no image.');
  const cleanBase64 = String(image).replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(outputPath, Buffer.from(cleanBase64, 'base64'));
}

ipcMain.handle('start-image-generation', async (_event, payload) => {
  try {
    const safetyReason = localSafetyCheck(`${payload.prompt} ${payload.negativePrompt || ''}`, Boolean(payload.safetyEnabled));
    if (safetyReason) {
      return { success: false, error: safetyReason };
    }

    const modelPath = safeModelPath(payload.modelPath);
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: `Image model file not found: ${modelPath}` };
    }

    ensureDir(getImageOutputFolder());
    const seed = payload.seed === -1 ? Math.floor(Math.random() * 999999999) : payload.seed;
    const outputPath = path.join(getImageOutputFolder(), `lml_${Date.now()}_${seed}.png`);
    const jobPayload = { ...payload, seed };

    sendImageProgress(6, 'Preparing local image job...');
    sendEngineLog(`[image] Prompt accepted. Model: ${path.basename(modelPath)}`, 'image');

    const cliPath = findStableDiffusionCli();
    if (cliPath) {
      await generateWithStableDiffusionCpp(jobPayload, modelPath, outputPath);
    } else if (await detectAutomatic1111()) {
      await generateWithAutomatic1111(jobPayload, outputPath);
    } else {
      return {
        success: false,
        error: 'No local image backend found. Add stable-diffusion.cpp sd.exe to bin or start A1111/Forge locally with API enabled.',
      };
    }

    if (!fs.existsSync(outputPath)) {
      return { success: false, error: 'Local backend finished but no output image was created.' };
    }

    sendImageProgress(100, 'Image generated locally.');
    sendEngineLog(`[image] Output saved: ${outputPath}`, 'image');
    return {
      success: true,
      imageUrl: pathToFileURL(outputPath).href,
      outputPath,
      backend: cliPath ? 'Local Engine' : 'WebUI Backend',
    };
  } catch (error: any) {
    console.error('Image generation error:', error);
    sendImageProgress(0, `Image generation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

function getGPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', { windowsHide: true }, (err, stdout) => {
      if (!err && stdout) {
        const val = parseInt(stdout.trim());
        if (!Number.isNaN(val)) return resolve(val);
      }

      exec('powershell -NoProfile -Command "(Get-Counter -Counter \\\"\\GPU Engine(*)\\Utilization Percentage\\\").CounterSamples | Measure-Object -Property CookedValue -Sum | Select-Object -ExpandProperty Sum"', { windowsHide: true }, (err2, stdout2) => {
        if (!err2 && stdout2) {
          let val = Math.round(parseFloat(stdout2.trim()) / 100);
          if (!Number.isNaN(val)) {
            if (val > 100) val = 100;
            return resolve(val);
          }
        }
        resolve(activeSession ? 65 : 0);
      });
    });
  });
}

let lastCpuSample = { idle: 0, total: 0 };

ipcMain.handle('get-system-status', async () => {
  try {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    const total = user + nice + sys + idle + irq;
    let cpuUsage = 0;
    if (lastCpuSample.total > 0) {
      const totalDiff = total - lastCpuSample.total;
      const idleDiff = idle - lastCpuSample.idle;
      cpuUsage = Math.round(100 * (1 - idleDiff / totalDiff));
      if (cpuUsage < 0) cpuUsage = 0;
      if (cpuUsage > 100) cpuUsage = 100;
    }
    lastCpuSample = { idle, total };

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const gpuUsage = await getGPUUsage();

    return { cpuUsage, ramUsage, gpuUsage };
  } catch (error) {
    console.error('System status query error:', error);
    return { cpuUsage: 0, ramUsage: 0, gpuUsage: 0 };
  }
});
