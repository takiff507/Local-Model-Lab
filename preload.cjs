const { contextBridge, ipcRenderer } = require('electron');

const invokeChannels = new Set([
  'get-system-info',
  'get-system-status',
  'get-downloaded-models',
  'verify-model-download',
  'delete-model',
  'export-chat',
  'import-local-models',
  'open-models-folder',
  'open-generations-folder',
  'get-start-on-boot',
  'set-start-on-boot',
  'open-external',
  'start-text-engine',
  'stop-text-engine',
  'chat-completion',
  'get-image-backend-status',
  'start-image-generation',
  'download-image-backend',
]);

const sendChannels = new Set([
  'download-model',
  'cancel-download',
  'window-minimize',
  'window-maximize',
  'window-close',
  'cancel-image-backend-download',
]);

const eventPrefixes = [
  'download-progress-',
  'engine-log',
  'engine-status',
  'image-generation-progress',
  'image-backend-download-progress',
];

function canListen(channel) {
  return eventPrefixes.some(prefix => channel === prefix || channel.startsWith(prefix));
}

contextBridge.exposeInMainWorld('localModelLab', {
  invoke(channel, payload) {
    if (!invokeChannels.has(channel)) {
      throw new Error(`Blocked IPC invoke channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  send(channel, payload) {
    if (!sendChannels.has(channel)) {
      throw new Error(`Blocked IPC send channel: ${channel}`);
    }
    ipcRenderer.send(channel, payload);
  },
  on(channel, callback) {
    if (!canListen(channel)) {
      throw new Error(`Blocked IPC listen channel: ${channel}`);
    }
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
