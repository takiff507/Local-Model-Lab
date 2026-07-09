export type ModelType = 'text' | 'image';

export interface Model {
  id: string;
  name: string;
  type: ModelType;
  size: string;
  sizeGB: number;
  parameters: string;
  description: string;
  url: string;
  filename: string;
  recommendedHardware: string;
  minRamGB: number;
  minVramGB: number;
  backend: string;
  tag?: string;
  localOnly?: boolean;
  custom?: boolean;
  company?: string;
  category?: string;
}

export interface HardwareProfile {
  cpu?: string;
  cores?: number;
  ram?: string;
  ramGB?: number;
  gpu?: string;
  gpuMemoryGB?: number;
  platform?: string;
}

export interface CompatibilityResult {
  level: 'excellent' | 'good' | 'limited' | 'unsupported';
  label: string;
  detail: string;
  color: string;
}

const IMAGE_FILE_HINTS = [
  'sdxl',
  'sd-',
  'sd_',
  'stable-diffusion',
  'dreamshaper',
  'realvis',
  'juggernaut',
  'flux',
  'diffusion',
  'checkpoint',
  'schnell',
  'turbo',
];

export const MODEL_FILE_EXTENSIONS = ['.gguf', '.safetensors', '.ckpt', '.bin'];

export const RECOMMENDED_MODELS: Model[] = [
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B Instruct',
    type: 'text',
    size: '1.9 GB',
    sizeGB: 1.9,
    parameters: '3 Billion',
    description: "Meta's lightweight instruct model for fast offline chat, summaries, writing, and general QA.",
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    recommendedHardware: '8GB+ RAM. Runs well on CPU; faster with GPU acceleration.',
    minRamGB: 8,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Popular',
    company: 'Meta',
    category: 'General Chat',
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen 3 4B Instruct',
    type: 'text',
    size: '2.3 GB',
    sizeGB: 2.3,
    parameters: '4 Billion',
    description: 'Efficient reasoning, coding, math, and multilingual chat model for everyday local use.',
    url: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
    filename: 'Qwen3-4B-Q4_K_M.gguf',
    recommendedHardware: '8GB+ RAM. Good CPU performance; GPU recommended for heavier chats.',
    minRamGB: 8,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Best Value',
    company: 'Alibaba',
    category: 'Reasoning & Coding',
  },
  {
    id: 'gemma-3-4b',
    name: 'Google Gemma 3 4B',
    type: 'text',
    size: '2.3 GB',
    sizeGB: 2.3,
    parameters: '4 Billion',
    description: "Google's compact open-weight model for creative writing, analysis, and assistant-style chat.",
    url: 'https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf',
    filename: 'gemma-3-4b-it-Q4_K_M.gguf',
    recommendedHardware: '8GB+ RAM. Lightweight and capable for local chat.',
    minRamGB: 8,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'New',
    company: 'Google',
    category: 'Assistant Chat',
  },
  {
    id: 'phi-4-mini',
    name: 'Microsoft Phi 4 Mini',
    type: 'text',
    size: '2.3 GB',
    sizeGB: 2.3,
    parameters: '3.8 Billion',
    description: "Microsoft's efficient small model for reasoning, logic, science, and structured answers.",
    url: 'https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf',
    filename: 'microsoft_Phi-4-mini-instruct-Q4_K_M.gguf',
    recommendedHardware: '8GB+ RAM. Strong option for laptops and edge PCs.',
    minRamGB: 8,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Smart',
    company: 'Microsoft',
    category: 'Reasoning AI',
  },
  {
    id: 'mistral-7b-v03',
    name: 'Mistral 7B Instruct v0.3',
    type: 'text',
    size: '4.1 GB',
    sizeGB: 4.1,
    parameters: '7 Billion',
    description: 'High-quality instruct model with strong task following and fast local inference.',
    url: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    recommendedHardware: '12GB+ RAM or 8GB+ VRAM GPU.',
    minRamGB: 12,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Pro',
    company: 'Mistral AI',
    category: 'Pro Assistant',
  },
  {
    id: 'qwen-2.5-7b',
    name: 'Qwen 2.5 7B Instruct',
    type: 'text',
    size: '4.4 GB',
    sizeGB: 4.4,
    parameters: '7 Billion',
    description: 'Battle-tested coding, math, reasoning, and multilingual assistant model.',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    recommendedHardware: '16GB+ RAM or 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Coder',
    company: 'Alibaba',
    category: 'Coding & Logic',
  },
  {
    id: 'tinyllama-1.1b',
    name: 'TinyLlama 1.1B Chat',
    type: 'text',
    size: '638 MB',
    sizeGB: 0.62,
    parameters: '1.1 Billion',
    description: 'Ultra-light local chat model for older PCs, testing, and very fast basic responses.',
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    recommendedHardware: '4GB+ RAM. Best choice for very low-spec PCs.',
    minRamGB: 4,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Tiny',
    company: 'TinyLlama',
    category: 'Lightweight Chat',
  },
  {
    id: 'llama3-8b-abliterated',
    name: 'Llama 3 8B Abliterated v3',
    type: 'text',
    size: '4.6 GB',
    sizeGB: 4.6,
    parameters: '8 Billion',
    description: 'Community experimental model. The app-level 18+ safety lock still applies when enabled.',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3-8B-Instruct-abliterated-v3-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-abliterated-v3-Q4_K_M.gguf',
    filename: 'Meta-Llama-3-8B-Instruct-abliterated-v3-Q4_K_M.gguf',
    recommendedHardware: '16GB+ RAM or 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 0,
    backend: 'Built-in llama.cpp runtime',
    tag: 'Advanced',
    company: 'Cognitive Computations',
    category: 'Uncensored Chat',
  },
  {
    id: 'sd-1.5-dreamshaper',
    name: 'DreamShaper 8 (SD 1.5)',
    type: 'image',
    size: '2.0 GB',
    sizeGB: 2.0,
    parameters: '860 Million',
    description: 'Fast SD 1.5 checkpoint for local art, characters, concepts, and lower-VRAM PCs.',
    url: 'https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors',
    filename: 'DreamShaper_8_pruned.safetensors',
    recommendedHardware: '8GB+ RAM. 4GB+ VRAM GPU recommended; CPU is possible but slow.',
    minRamGB: 8,
    minVramGB: 4,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Popular',
    company: 'Lykon',
    category: 'Digital Art (SD 1.5)',
  },
  {
    id: 'sdxl-lightning',
    name: 'SDXL Lightning (HD)',
    type: 'image',
    size: '6.5 GB',
    sizeGB: 6.5,
    parameters: '2.6 Billion',
    description: 'Fast SDXL-family workflow for HD local image generation when a compatible backend is installed.',
    url: 'https://huggingface.co/ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_4step.safetensors',
    filename: 'sdxl_lightning_4step.safetensors',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU. RTX 30/40-series recommended.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'HD',
    company: 'ByteDance',
    category: 'Fast HD (SDXL)',
  },
  {
    id: 'flux-schnell',
    name: 'FLUX.1 Schnell (GGUF)',
    type: 'image',
    size: '6.3 GB',
    sizeGB: 6.3,
    parameters: '12 Billion',
    description: 'High-end local image model for photorealism and prompt adherence on strong GPUs.',
    url: 'https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_0.gguf',
    filename: 'flux1-schnell-Q4_0.gguf',
    recommendedHardware: '32GB+ RAM and 12GB+ VRAM GPU. Best on RTX 4070+.',
    minRamGB: 32,
    minVramGB: 12,
    backend: 'Local image backend with FLUX GGUF support',
    tag: 'Best Quality',
    company: 'Black Forest Labs',
    category: 'Photorealism (Flux)',
  },
  {
    id: 'sd35-turbo',
    name: 'Stable Diffusion 3.5 Turbo (GGUF)',
    type: 'image',
    size: '4.4 GB',
    sizeGB: 4.4,
    parameters: '2.5 Billion',
    description: 'Turbo image model for local photorealism and fast generation on modern GPUs.',
    url: 'https://huggingface.co/city96/stable-diffusion-3.5-large-turbo-gguf/resolve/main/sd3.5_large_turbo-Q4_0.gguf',
    filename: 'sd3.5_large_turbo-Q4_0.gguf',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU for practical speeds.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend with SD3.5 GGUF support',
    tag: 'New',
    company: 'Stability AI',
    category: 'Fast Photoreal (SD3.5)',
  },
  {
    id: 'juggernaut-xl',
    name: 'Juggernaut XL V9',
    type: 'image',
    size: '6.6 GB',
    sizeGB: 6.6,
    parameters: '2.6 Billion',
    description: 'Highly acclaimed photo-realistic and cinematic checkpoint based on SDXL. Excellent general-purpose model.',
    url: 'https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors',
    filename: 'juggernaut_xl_v9.safetensors',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Cinematic',
    company: 'RunDiffusion',
    category: 'General & Cinematic (SDXL)',
  },
  {
    id: 'animagine-xl',
    name: 'Animagine XL V3.1',
    type: 'image',
    size: '6.5 GB',
    sizeGB: 6.5,
    parameters: '2.6 Billion',
    description: 'Outstanding open-source anime-style text-to-image model based on SDXL. Generates high-fidelity anime art.',
    url: 'https://huggingface.co/cagliostrolab/animagine-xl-3.1/resolve/main/animagine-xl-3.1.safetensors',
    filename: 'animagine_xl_3.1.safetensors',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Anime',
    company: 'Cagliostro Lab',
    category: 'Anime & Manga (SDXL)',
  },
  {
    id: 'pony-diffusion-xl',
    name: 'Pony Diffusion V6 XL',
    type: 'image',
    size: '6.6 GB',
    sizeGB: 6.6,
    parameters: '2.6 Billion',
    description: 'Popular stylised model trained on cartoony, 2D illustration, and anime styles. Excellent variety and prompt response.',
    url: 'https://huggingface.co/AstraliteHeart/pony-diffusion-v6/resolve/main/v6.safetensors',
    filename: 'pony_diffusion_v6_xl.safetensors',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Cartoon',
    company: 'AstraliteHeart',
    category: 'Cartoon & Anime (SDXL)',
  },
  {
    id: 'realvis-xl',
    name: 'RealVisXL V4.0',
    type: 'image',
    size: '6.6 GB',
    sizeGB: 6.6,
    parameters: '2.6 Billion',
    description: 'Top-tier realistic style model based on SDXL, focusing on human faces, photorealism, and natural lighting.',
    url: 'https://huggingface.co/SG161222/RealVisXL_V4.0/resolve/main/RealVisXL_V4.0.safetensors',
    filename: 'realvisxl_v4.0.safetensors',
    recommendedHardware: '16GB+ RAM and 8GB+ VRAM GPU.',
    minRamGB: 16,
    minVramGB: 8,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Realistic',
    company: 'SG161222',
    category: 'Ultra Photorealistic (SDXL)',
  },
  {
    id: 'absolute-reality',
    name: 'AbsoluteReality V1.8.1 (SD 1.5)',
    type: 'image',
    size: '2.0 GB',
    sizeGB: 2.0,
    parameters: '860 Million',
    description: 'One of the best photorealistic fine-tunes for SD 1.5. Excellent performance on mid-tier GPUs.',
    url: 'https://huggingface.co/Lykon/AbsoluteReality/resolve/main/AbsoluteReality_1.8.1_pruned.safetensors',
    filename: 'absolutereality_1.8.1.safetensors',
    recommendedHardware: '8GB+ RAM and 4GB+ VRAM GPU.',
    minRamGB: 8,
    minVramGB: 4,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Classic Real',
    company: 'Lykon',
    category: 'Photorealistic (SD 1.5)',
  },
  {
    id: 'comic-diffusion',
    name: 'Comic Diffusion V2 (SD 1.5)',
    type: 'image',
    size: '2.0 GB',
    sizeGB: 2.0,
    parameters: '860 Million',
    description: 'Fine-tuned model for producing western comic book styles and illustrations on lower-spec hardware.',
    url: 'https://huggingface.co/ogkalu/Comic-Diffusion/resolve/main/comic-diffusion-V2.ckpt',
    filename: 'comic-diffusion-V2.ckpt',
    recommendedHardware: '8GB+ RAM and 4GB+ VRAM GPU.',
    minRamGB: 8,
    minVramGB: 4,
    backend: 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    tag: 'Comic',
    company: 'ogkalu',
    category: 'Comic & Illustration (SD 1.5)',
  },
];

export interface ModelLegalInfo {
  repository: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}

const MODEL_LEGAL_INFO: Record<string, Omit<ModelLegalInfo, 'sourceUrl'>> = {
  'llama-3.2-3b': { repository: 'bartowski/Llama-3.2-3B-Instruct-GGUF', license: 'Llama 3.2 Community License', licenseUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF' },
  'qwen3-4b': { repository: 'Qwen/Qwen3-4B-GGUF', license: 'Apache 2.0', licenseUrl: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF' },
  'gemma-3-4b': { repository: 'ggml-org/gemma-3-4b-it-GGUF', license: 'Gemma License', licenseUrl: 'https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF' },
  'phi-4-mini': { repository: 'bartowski/microsoft_Phi-4-mini-instruct-GGUF', license: 'MIT (upstream model)', licenseUrl: 'https://huggingface.co/microsoft/Phi-4-mini-instruct' },
  'mistral-7b-v03': { repository: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF', license: 'Apache 2.0', licenseUrl: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF' },
  'qwen-2.5-7b': { repository: 'bartowski/Qwen2.5-7B-Instruct-GGUF', license: 'Apache 2.0', licenseUrl: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF' },
  'tinyllama-1.1b': { repository: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF', license: 'Apache 2.0', licenseUrl: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF' },
  'llama3-8b-abliterated': { repository: 'bartowski/Meta-Llama-3-8B-Instruct-abliterated-v3-GGUF', license: 'Llama 3 Community License', licenseUrl: 'https://huggingface.co/bartowski/Meta-Llama-3-8B-Instruct-abliterated-v3-GGUF' },
  'sd-1.5-dreamshaper': { repository: 'Lykon/DreamShaper', license: 'CreativeML Open RAIL-M', licenseUrl: 'https://huggingface.co/Lykon/DreamShaper' },
  'sdxl-lightning': { repository: 'ByteDance/SDXL-Lightning', license: 'Open RAIL++', licenseUrl: 'https://huggingface.co/ByteDance/SDXL-Lightning' },
  'flux-schnell': { repository: 'city96/FLUX.1-schnell-gguf', license: 'Apache 2.0', licenseUrl: 'https://huggingface.co/city96/FLUX.1-schnell-gguf' },
  'sd35-turbo': { repository: 'city96/stable-diffusion-3.5-large-turbo-gguf', license: 'Stability AI Community License', licenseUrl: 'https://huggingface.co/city96/stable-diffusion-3.5-large-turbo-gguf' },
  'juggernaut-xl': { repository: 'RunDiffusion/Juggernaut-XL-v9', license: 'CreativeML Open RAIL-M', licenseUrl: 'https://huggingface.co/RunDiffusion/Juggernaut-XL-v9' },
  'animagine-xl': { repository: 'cagliostrolab/animagine-xl-3.1', license: 'Open RAIL++', licenseUrl: 'https://huggingface.co/cagliostrolab/animagine-xl-3.1' },
  'pony-diffusion-xl': { repository: 'AstraliteHeart/pony-diffusion-v6', license: 'CreativeML Open RAIL-M', licenseUrl: 'https://huggingface.co/AstraliteHeart/pony-diffusion-v6' },
  'realvis-xl': { repository: 'SG161222/RealVisXL_V4.0', license: 'Open RAIL++', licenseUrl: 'https://huggingface.co/SG161222/RealVisXL_V4.0' },
  'absolute-reality': { repository: 'Lykon/AbsoluteReality', license: 'Checkpoint-specific license', licenseUrl: 'https://huggingface.co/Lykon/AbsoluteReality' },
  'comic-diffusion': { repository: 'ogkalu/Comic-Diffusion', license: 'CreativeML Open RAIL-M', licenseUrl: 'https://huggingface.co/ogkalu/Comic-Diffusion' },
};

export function getModelLegalInfo(model: Model): ModelLegalInfo {
  const known = MODEL_LEGAL_INFO[model.id];
  if (known) return { ...known, sourceUrl: `https://huggingface.co/${known.repository}` };
  return { repository: 'Local file', sourceUrl: '', license: 'User supplied', licenseUrl: '' };
}
export function parseRamGB(ram?: string): number {
  if (!ram) return 0;
  const match = ram.match(/([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

export function isModelFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return MODEL_FILE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function inferModelTypeFromFilename(filename: string): ModelType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.safetensors') || lower.endsWith('.ckpt')) {
    return 'image';
  }
  if (IMAGE_FILE_HINTS.some(hint => lower.includes(hint))) {
    return 'image';
  }
  return 'text';
}

export function createLocalModelFromFilename(filename: string): Model | null {
  if (!isModelFile(filename)) return null;
  const type = inferModelTypeFromFilename(filename);
  const displayName = filename.replace(/\.(gguf|safetensors|ckpt|bin)$/i, '').replace(/[-_]+/g, ' ');

  return {
    id: `local:${filename}`,
    name: displayName,
    type,
    size: 'Local file',
    sizeGB: 0,
    parameters: 'Custom',
    description: type === 'text'
      ? 'Imported local GGUF model. Runs through the built-in offline llama.cpp runtime.'
      : 'Imported local image checkpoint. Requires a local image backend on this PC.',
    url: '',
    filename,
    recommendedHardware: type === 'text'
      ? 'Depends on quantization and parameter count. Start with 8GB+ RAM.'
      : 'Depends on checkpoint. GPU VRAM strongly recommended.',
    minRamGB: type === 'text' ? 8 : 8,
    minVramGB: type === 'text' ? 0 : 4,
    backend: type === 'text'
      ? 'Built-in llama.cpp runtime'
      : 'Local image backend: stable-diffusion.cpp or A1111/Forge',
    localOnly: true,
    custom: true,
    tag: 'Imported',
  };
}

export function buildInstalledModelCatalog(downloadedModelIds: string[], localFiles: string[], type: ModelType): Model[] {
  const known = RECOMMENDED_MODELS.filter(model => model.type === type && downloadedModelIds.includes(model.id));
  const knownFilenames = new Set(RECOMMENDED_MODELS.map(model => model.filename.toLowerCase()));
  const custom = localFiles
    .filter(filename => !knownFilenames.has(filename.toLowerCase()))
    .map(createLocalModelFromFilename)
    .filter((model): model is Model => model !== null)
    .filter(model => model.type === type);

  return [...known, ...custom];
}

export function getModelCompatibility(model: Model, hardware?: HardwareProfile | null): CompatibilityResult {
  const ramGB = hardware?.ramGB || parseRamGB(hardware?.ram);
  const gpuMemoryGB = hardware?.gpuMemoryGB || 0;

  if (!ramGB) {
    return {
      level: 'limited',
      label: 'Needs Check',
      detail: 'Hardware is still being detected.',
      color: '#ffbd2e',
    };
  }

  if (ramGB < model.minRamGB) {
    return {
      level: 'unsupported',
      label: 'Too Heavy',
      detail: `Needs ${model.minRamGB}GB+ RAM. This PC reports ${ramGB}GB.`,
      color: '#ff5f56',
    };
  }

  if (model.type === 'image' && model.minVramGB > 0) {
    if (!gpuMemoryGB) {
      return {
        level: 'limited',
        label: 'GPU Unknown',
        detail: `${model.minVramGB}GB+ VRAM recommended. CPU fallback can be very slow.`,
        color: '#ffbd2e',
      };
    }

    if (gpuMemoryGB < model.minVramGB) {
      return {
        level: 'limited',
        label: 'Slow/Borderline',
        detail: `Needs ${model.minVramGB}GB+ VRAM for smooth speed. This GPU reports ${gpuMemoryGB}GB.`,
        color: '#ffbd2e',
      };
    }
  }

  const hasGpuHeadroom = model.type === 'text' || model.minVramGB === 0 || gpuMemoryGB >= model.minVramGB + 2;
  return {
    level: hasGpuHeadroom ? 'excellent' : 'good',
    label: hasGpuHeadroom ? 'Best Fit' : 'Compatible',
    detail: hasGpuHeadroom ? 'Good match for this PC.' : 'Compatible, but keep batch/size modest.',
    color: hasGpuHeadroom ? '#27c93f' : '#10b981',
  };
}


