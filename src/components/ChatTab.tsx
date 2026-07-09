import { useMemo, useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sliders, Trash2, Cpu, ShieldCheck, ShieldOff, FileDown } from 'lucide-react';
import { startTextEngine, stopTextEngine, chatCompletion, exportChat } from '../ipc';
import { buildInstalledModelCatalog } from '../modelsData';
import { checkPromptSafety, SAFETY_SYSTEM_PROMPT } from '../safety';
import CustomDropdown from './CustomDropdown';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface ChatTabProps {
  downloadedModels: string[];
  localModelFiles: string[];
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  safetyEnabled: boolean;
  setSafetyEnabled: (enabled: boolean) => void;
}

export default function ChatTab({
  downloadedModels,
  localModelFiles,
  activeModelId,
  setActiveModelId,
  safetyEnabled,
  setSafetyEnabled,
}: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Choose an installed model, launch it, and start a private local conversation.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [topP, setTopP] = useState(0.9);
  const [repPenalty, setRepPenalty] = useState(1.1);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, respectful, and honest assistant.');
  const [engineStatus, setEngineStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [errorMessage, setErrorMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const availableTextModels = useMemo(
    () => buildInstalledModelCatalog(downloadedModels, localModelFiles, 'text'),
    [downloadedModels, localModelFiles],
  );

  const activeModel = availableTextModels.find(model => model.id === activeModelId);

  useEffect(() => {
    if (availableTextModels.length > 0) {
      const isCurrentAvailable = availableTextModels.some(model => model.id === activeModelId);
      if (!isCurrentAvailable) setActiveModelId(availableTextModels[0].id);
    } else {
      setActiveModelId('');
    }
  }, [activeModelId, availableTextModels, setActiveModelId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (engineStatus === 'running') stopTextEngine();
    };
  }, [engineStatus]);

  const effectiveSystemPrompt = safetyEnabled
    ? `${systemPrompt}\n\n${SAFETY_SYSTEM_PROMPT}`
    : systemPrompt;

  const launchModel = async (modelId: string) => {
    const modelMeta = availableTextModels.find(model => model.id === modelId);
    if (!modelMeta) return;

    setEngineStatus('starting');
    setErrorMessage('');

    const res = await startTextEngine(modelMeta.filename, effectiveSystemPrompt);
    if (res.success) {
      setEngineStatus('running');
    } else {
      setEngineStatus('error');
      setErrorMessage(res.message || 'Failed to start engine.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;

    const safety = checkPromptSafety(inputText, safetyEnabled);
    if (!safety.allowed) {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: safety.reason || 'Prompt blocked by local safety rules.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      return;
    }

    const userMessage: Message = {
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);

    try {
      const conversation = [...messages, userMessage].map(message => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        content: message.text,
      }));
      const result = await chatCompletion(
        conversation,
        temperature,
        maxTokens,
        effectiveSystemPrompt,
        topP,
        repPenalty,
      );

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: result.success && result.content
          ? result.content
          : `Error: ${result.error || 'Unknown error occurred'}. Make sure the model is loaded.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: `Error: ${error.message}. Please verify the model is loaded properly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        sender: 'ai',
        text: 'Chat cleared. How can I help you next?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleModelChange = async (modelId: string) => {
    setActiveModelId(modelId);
    if (engineStatus === 'running') await stopTextEngine();
    setEngineStatus('stopped');
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div style={{
          height: '60px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Model:</span>
            <CustomDropdown
              value={activeModelId}
              onChange={handleModelChange}
              options={availableTextModels.map(model => ({ value: model.id, label: model.name }))}
              placeholder="No models downloaded"
              width="260px"
            />
            {activeModel?.custom && (
              <span style={{ fontSize: '0.7rem', color: '#ffbd2e' }}>Imported</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="icon-button"
              onClick={() => exportChat(messages)}
              disabled={messages.length <= 1}
              title="Export chat"
              style={{ opacity: messages.length <= 1 ? 0.45 : 1 }}
            >
              <FileDown size={15} />
            </button>
            {engineStatus === 'stopped' && (
              <button
                className="btn-accent"
                onClick={() => launchModel(activeModelId)}
                disabled={!activeModelId}
                style={{ padding: '6px 16px', fontSize: '0.8rem' }}
              >
                Launch Model
              </button>
            )}
            {engineStatus === 'starting' && (
              <span style={{ fontSize: '0.8rem', color: '#ffbd2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="glow-active" style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#ffbd2e', borderRadius: '50%' }} />
                Initializing...
              </span>
            )}
            {engineStatus === 'running' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: '#27c93f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#27c93f', borderRadius: '50%' }} />
                  Loaded
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    stopTextEngine();
                    setEngineStatus('stopped');
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  Unload
                </button>
              </div>
            )}
            {engineStatus === 'error' && (
              <span style={{ fontSize: '0.8rem', color: '#ff5f56' }} title={errorMessage}>
                Launch Error
              </span>
            )}
          </div>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {messages.map((msg, i) => (
            <div
              key={`${msg.timestamp}-${i}`}
              style={{
                display: 'flex',
                gap: '16px',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                maxWidth: '80%',
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: msg.sender === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-light)',
                flexShrink: 0,
              }}>
                {msg.sender === 'user' ? <User size={18} style={{ color: '#000' }} /> : <Bot size={18} style={{ color: 'var(--accent)' }} />}
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.07)' : 'var(--bg-panel)',
                  border: msg.sender === 'user' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-light)',
                  padding: '12px 18px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 0px 16px' : '16px 16px 16px 0px',
                  color: '#f3f4f6',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  userSelect: 'text',
                }}>
                  {msg.text}
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div style={{ display: 'flex', gap: '16px', alignSelf: 'flex-start' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-light)',
              }}>
                <Bot size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                padding: '12px 18px',
                borderRadius: '16px 16px 16px 0px',
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
                height: '42px',
              }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1s infinite 0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-light)',
          background: 'rgba(7, 8, 10, 0.4)',
          display: 'flex',
          gap: '12px',
        }}>
          <button
            type="button"
            onClick={handleClearChat}
            className="btn-secondary"
            title="Clear Chat"
            style={{ width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={18} />
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={engineStatus === 'running' ? 'Type a prompt to chat offline...' : 'Please launch a model first to start chatting...'}
            disabled={engineStatus !== 'running'}
            style={{
              flex: 1,
              height: '44px',
              minHeight: '44px',
              maxHeight: '96px',
              resize: 'vertical',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.95rem',
            }}
          />

          <button
            type="submit"
            disabled={engineStatus !== 'running' || !inputText.trim() || isGenerating}
            className="btn-accent"
            style={{
              height: '44px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>

      <div style={{
        width: '280px',
        borderLeft: '1px solid var(--border-light)',
        background: 'rgba(13, 15, 19, 0.4)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem' }}>
          <Sliders size={18} style={{ color: 'var(--accent)' }} />
          <span>Model Parameters</span>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Temperature (Creativity)</span>
            <span>{temperature}</span>
          </div>
          <input type="range" min="0.1" max="1.5" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>Deterministic</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Top-P (Nucleus Sampling)</span>
            <span>{topP}</span>
          </div>
          <input type="range" min="0.1" max="1.0" step="0.05" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Repetition Penalty</span>
            <span>{repPenalty}</span>
          </div>
          <input type="range" min="1.0" max="2.0" step="0.05" value={repPenalty} onChange={(e) => setRepPenalty(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Max Response Length</span>
            <span>{maxTokens} tokens</span>
          </div>
          <input type="range" min="128" max="2048" step="128" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>System Persona Instructions</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="E.g. You are a helpful assistant..."
            style={{
              width: '100%',
              height: '100px',
              resize: 'none',
              fontSize: '0.8rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {safetyEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
              18+ Safety
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Local prompt guard
            </span>
          </div>
          <input type="checkbox" checked={safetyEnabled} onChange={(e) => setSafetyEnabled(e.target.checked)} />
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '16px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent)' }}>
            <Cpu size={14} />
            <span>Local Processing</span>
          </div>
          <p style={{ lineHeight: '1.4' }}>
            Your chats are processed locally on your hardware. No data ever leaves your device.
          </p>
        </div>
      </div>
    </div>
  );
}
