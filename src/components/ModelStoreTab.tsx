import { useMemo, useState } from 'react';
import type React from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  HardDrive,
  Info,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  RECOMMENDED_MODELS,
  createLocalModelFromFilename,
  getModelCompatibility,
  getModelLegalInfo,
} from '../modelsData';
import type { HardwareProfile, Model } from '../modelsData';
import { deleteModel, openExternal, verifyModelDownload } from '../ipc';
import CustomDropdown from './CustomDropdown';

interface ModelStoreTabProps {
  downloadedModels: string[];
  setDownloadedModels: React.Dispatch<React.SetStateAction<string[]>>;
  localModelFiles: string[];
  setLocalModelFiles: React.Dispatch<React.SetStateAction<string[]>>;
  systemInfo?: HardwareProfile | null;
  downloadStates: Record<string, any>;
  handleStartDownload: (model: Model) => void;
  handleCancelDownload: (modelId: string) => void;
  handleImportLocalModels: () => Promise<void>;
}

type CatalogFilter = 'all' | 'text' | 'image' | 'installed';
type CatalogSort = 'recommended' | 'smallest' | 'name';
type Availability = { status: 'idle' | 'checking' | 'available' | 'error'; message?: string };

const compatibilityOrder = { excellent: 0, good: 1, limited: 2, unsupported: 3 };

export default function ModelStoreTab({
  downloadedModels,
  setDownloadedModels,
  localModelFiles,
  setLocalModelFiles,
  systemInfo,
  downloadStates,
  handleStartDownload,
  handleCancelDownload,
  handleImportLocalModels,
}: ModelStoreTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [sort, setSort] = useState<CatalogSort>('recommended');
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [isChecking, setIsChecking] = useState(false);

  const knownFilenames = useMemo(
    () => new Set(RECOMMENDED_MODELS.map(model => model.filename.toLowerCase())),
    [],
  );
  const importedModels = useMemo(
    () => localModelFiles
      .filter(filename => !knownFilenames.has(filename.toLowerCase()))
      .map(createLocalModelFromFilename)
      .filter((model): model is Model => Boolean(model)),
    [knownFilenames, localModelFiles],
  );

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return RECOMMENDED_MODELS
      .filter(model => {
        if (filter === 'text' || filter === 'image') return model.type === filter;
        if (filter === 'installed') return downloadedModels.includes(model.id);
        return true;
      })
      .filter(model => {
        if (!normalizedQuery) return true;
        return [model.name, model.company, model.category, model.description, model.parameters]
          .some(value => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sort === 'smallest') return a.sizeGB - b.sizeGB;
        if (sort === 'name') return a.name.localeCompare(b.name);
        const aFit = compatibilityOrder[getModelCompatibility(a, systemInfo).level];
        const bFit = compatibilityOrder[getModelCompatibility(b, systemInfo).level];
        return aFit - bFit || a.sizeGB - b.sizeGB;
      });
  }, [downloadedModels, filter, query, sort, systemInfo]);

  const handleDeleteModel = async (model: Model) => {
    if (!window.confirm(`Delete ${model.name} from disk? This cannot be undone.`)) return;
    const result = await deleteModel(model.filename);
    if (!result.success) {
      window.alert(`Failed to delete model: ${result.message || 'Unknown error'}`);
      return;
    }
    setDownloadedModels(current => current.filter(id => id !== model.id));
    setLocalModelFiles(current => current.filter(filename => filename !== model.filename));
  };

  const checkCatalog = async () => {
    setIsChecking(true);
    for (const model of RECOMMENDED_MODELS) {
      setAvailability(current => ({ ...current, [model.id]: { status: 'checking' } }));
      const result = await verifyModelDownload(model.id, model.url, model.filename, model.sizeGB);
      setAvailability(current => ({
        ...current,
        [model.id]: result.success
          ? { status: 'available', message: result.totalBytes ? `${(result.totalBytes / 1024 ** 3).toFixed(2)} GB verified` : 'Source verified' }
          : { status: 'error', message: result.error || 'Source unavailable' },
      }));
    }
    setIsChecking(false);
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytesPerSecond) / Math.log(1024)));
    return `${(bytesPerSecond / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  };

  const renderModel = (model: Model, isCustom = false) => {
    const download = downloadStates[model.id] || { progress: 0, speed: 0, status: 'idle' };
    const installed = isCustom || downloadedModels.includes(model.id);
    const compatibility = getModelCompatibility(model, systemInfo);
    const legal = getModelLegalInfo(model);
    const source = availability[model.id] || { status: 'idle' };

    return (
      <article className="model-row" key={model.id}>
        <div className="model-row__body">
          <div className="model-row__titleline">
            <h3>{model.name}</h3>
            <span className="model-pill model-pill--neutral">{model.type} AI</span>
            {model.tag && <span className="model-pill model-pill--accent">{model.tag}</span>}
            <span className="model-pill" style={{ color: compatibility.color, borderColor: `${compatibility.color}55` }}>
              {compatibility.label}
            </span>
            {source.status === 'available' && (
              <span className="model-source-status model-source-status--ok"><FileCheck2 size={13} /> Live source</span>
            )}
            {source.status === 'error' && (
              <span className="model-source-status model-source-status--error" title={source.message}><CircleAlert size={13} /> Unavailable</span>
            )}
          </div>

          <p className="model-row__description">{model.description}</p>
          <div className="model-row__facts">
            <span><strong>{model.size}</strong> download</span>
            <span><strong>{model.parameters}</strong> parameters</span>
            {model.company && <span>By <strong>{model.company}</strong></span>}
            {model.category && <span><strong>{model.category}</strong></span>}
          </div>
          <p className="model-row__compatibility" style={{ color: compatibility.color }}>{compatibility.detail}</p>

          <div className="model-row__legal">
            <span>{legal.license}</span>
            {!isCustom && (
              <button type="button" onClick={() => openExternal(legal.sourceUrl)} title="Open model source">
                {legal.repository}<ExternalLink size={12} />
              </button>
            )}
          </div>

          {download.status === 'downloading' && (
            <div className="model-progress">
              <div className="model-progress__label">
                <span>{download.message || 'Downloading verified weights...'}</span>
                <span>{download.progress}% | {formatSpeed(download.speed)}</span>
              </div>
              <div className="model-progress__track"><span style={{ width: `${download.progress}%` }} /></div>
            </div>
          )}

          {download.status === 'error' && (
            <div className="model-error"><Info size={14} /><span>{download.error || 'Download failed. Retry to resume.'}</span></div>
          )}
        </div>

        <div className="model-row__actions">
          {installed ? (
            <>
              <span className="installed-label"><CheckCircle2 size={18} />Installed</span>
              <button className="btn-secondary danger-button" onClick={() => handleDeleteModel(model)} title="Delete model">
                <Trash2 size={15} /><span>Delete</span>
              </button>
            </>
          ) : download.status === 'downloading' ? (
            <button className="btn-secondary danger-button" onClick={() => handleCancelDownload(model.id)}>
              <XCircle size={16} /><span>Cancel</span>
            </button>
          ) : (
            <button className="btn-accent" onClick={() => handleStartDownload(model)}>
              <Download size={16} /><span>{download.status === 'error' ? 'Retry' : 'Download'}</span>
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <main className="model-library">
      <header className="workspace-header">
        <div className="workspace-header__title">
          <Database size={24} />
          <div>
            <h2>Model Library</h2>
            <p>Verified public model files, hardware fit guidance, and local-only inference.</p>
          </div>
        </div>
        <div className="workspace-header__actions">
          <button className="btn-secondary" onClick={checkCatalog} disabled={isChecking}>
            <RefreshCw size={16} className={isChecking ? 'spin' : ''} /><span>{isChecking ? 'Checking...' : 'Verify sources'}</span>
          </button>
          <button className="btn-secondary" onClick={handleImportLocalModels}>
            <Upload size={16} /><span>Import model</span>
          </button>
        </div>
      </header>

      <section className="catalog-toolbar" aria-label="Model filters">
        <label className="catalog-search">
          <Search size={17} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search model, company, or capability" />
        </label>
        <div className="segmented-control">
          {(['all', 'text', 'image', 'installed'] as CatalogFilter[]).map(value => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>
          ))}
        </div>
        <CustomDropdown
          value={sort}
          onChange={value => setSort(value as CatalogSort)}
          width="190px"
          options={[
            { value: 'recommended', label: 'Best for this PC' },
            { value: 'smallest', label: 'Smallest first' },
            { value: 'name', label: 'Name A-Z' },
          ]}
        />
      </section>

      <div className="catalog-summary">
        <span>{filteredModels.length} catalog models</span>
        <span>{downloadedModels.length + importedModels.length} installed</span>
        <span>Downloads from Hugging Face only</span>
      </div>

      <section className="model-list">
        {filteredModels.map(model => renderModel(model))}
        {filteredModels.length === 0 && (
          <div className="empty-state"><Search size={24} /><p>No models match these filters.</p></div>
        )}
      </section>

      {importedModels.length > 0 && filter !== 'text' && filter !== 'image' && (
        <section className="imported-section">
          <div className="section-label"><HardDrive size={18} /><h3>Imported local files</h3></div>
          <div className="model-list">{importedModels.map(model => renderModel(model, true))}</div>
        </section>
      )}
    </main>
  );
}