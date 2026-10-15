import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { BrandConfig } from '../../types';
import {
  fetchRemoteSetting,
  upsertRemoteSetting,
  deleteRemoteSetting,
  subscribeRemoteSetting
} from '../../utils/storage';

interface BrandMasterPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: BrandConfig;
  defaultPrompt: string;
  showToast?: (message: string) => void;
  onCustomPromptSaved?: (customPrompt: string | null) => void;
}

export const BrandMasterPromptModal: React.FC<BrandMasterPromptModalProps> = ({
  isOpen,
  onClose,
  brand,
  defaultPrompt,
  showToast,
  onCustomPromptSaved,
}) => {
  const settingKey = `master_system_prompt_${brand.id}`;

  const [prompt, setPrompt] = useState<string>(() => {
    try {
      const cached = localStorage.getItem(settingKey);
      return cached || defaultPrompt;
    } catch {
      return defaultPrompt;
    }
  });

  const [isCustom, setIsCustom] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(settingKey));
    } catch {
      return false;
    }
  });

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Load custom prompt for the active brand
  useEffect(() => {
    let cancelled = false;

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(settingKey);
      if (cached) {
        setPrompt(cached);
        setIsCustom(true);
      } else {
        setPrompt(defaultPrompt);
        setIsCustom(false);
      }
    } catch {
      setPrompt(defaultPrompt);
      setIsCustom(false);
    }

    // Then check remote Supabase settings
    fetchRemoteSetting(settingKey).then((value) => {
      if (cancelled) return;
      if (value !== null && value.trim()) {
        setPrompt(value);
        setIsCustom(true);
        try { localStorage.setItem(settingKey, value); } catch {}
      } else {
        setPrompt(defaultPrompt);
        setIsCustom(false);
        try { localStorage.removeItem(settingKey); } catch {}
      }
    });

    const unsubscribe = subscribeRemoteSetting(settingKey, (value) => {
      if (value !== null && value.trim()) {
        setPrompt(value);
        setIsCustom(true);
        try { localStorage.setItem(settingKey, value); } catch {}
        onCustomPromptSaved?.(value);
      } else {
        setPrompt(defaultPrompt);
        setIsCustom(false);
        try { localStorage.removeItem(settingKey); } catch {}
        onCustomPromptSaved?.(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [brand.id, defaultPrompt, settingKey, onCustomPromptSaved]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    showToast?.(`Copied Master System Prompt for ${brand.name}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    setDraft(prompt);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === defaultPrompt.trim()) {
      // If blank or matches default, treat as reset to default
      await handleReset();
      setIsEditing(false);
      return;
    }

    try {
      localStorage.setItem(settingKey, trimmed);
    } catch {}

    await upsertRemoteSetting(settingKey, trimmed);
    setPrompt(trimmed);
    setIsCustom(true);
    setIsEditing(false);
    onCustomPromptSaved?.(trimmed);
    showToast?.(`Master prompt updated for ${brand.name}`);
  };

  const handleReset = async () => {
    try {
      localStorage.removeItem(settingKey);
    } catch {}

    await deleteRemoteSetting(settingKey);
    setPrompt(defaultPrompt);
    setIsCustom(false);
    setIsEditing(false);
    onCustomPromptSaved?.(null);
    showToast?.(`Master prompt reset to brand default for ${brand.name}`);
  };

  const handleLoadDefaultIntoDraft = () => {
    setDraft(defaultPrompt);
    showToast?.('Loaded current Brand Kit values into editor');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false);
        onClose();
      }}
      title={`Master System Prompt — ${brand.name}`}
      description="The master system persona prompt used by AI models (ChatGPT, Claude, Gemini) to embody this brand's tone, guardrails, and identity."
      icon={
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: brand.primaryColor }}
        >
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="w-5 h-5 object-contain" />
          ) : (
            <span className="material-symbols-outlined text-sm">{brand.icon || 'smart_toy'}</span>
          )}
        </div>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Info & Status Banner */}
        <div className="bg-[#f4f4f3] border border-[#e9e9e7] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-label-caps ${
                isCustom
                  ? 'bg-[#eef2ff] text-[#4f46e5] border border-[#4f46e5]/30'
                  : 'bg-[#e6f4ea] text-[#15803d] border border-[#15803d]/30'
              }`}
            >
              {isCustom ? 'Customized for this brand' : 'Auto-generated from Brand Kit'}
            </span>
          </div>
          <p className="font-body-md text-xs text-[#5f5f5b]">
            {isCustom
              ? 'Using your team’s custom override.'
              : 'Dynamically compiled from identity, voice rules, and colors.'}
          </p>
        </div>

        {/* Header Actions */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest">
              Prompt Content
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isEditing && (
                <>
                  {isCustom && (
                    <button
                      onClick={handleReset}
                      aria-label="Reset to brand default"
                      className="px-2.5 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] transition-all cursor-pointer"
                    >
                      Reset to Brand Default
                    </button>
                  )}
                  <button
                    onClick={startEditing}
                    aria-label="Edit prompt"
                    className="px-2.5 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy prompt"
                    className={`px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      copied ? 'bg-[#16a34a] text-white' : 'bg-[#1b1c1a] hover:bg-[#4f46e5] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={handleLoadDefaultIntoDraft}
                    className="px-2.5 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] transition-all cursor-pointer hidden sm:inline-flex"
                    title="Insert the auto-generated template based on current brand kit settings"
                  >
                    Load Default Template
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    aria-label="Cancel editing"
                    className="px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    aria-label="Save prompt"
                    className="px-3.5 py-1.5 text-xs font-bold font-label-caps rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white transition-all cursor-pointer"
                  >
                    Save
                  </button>
                </>
              )}
            </div>
          </div>

          {/* View or Edit Area */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={16}
                aria-label="Edit Master System Prompt"
                className="w-full font-mono text-[11px] leading-relaxed text-[#1b1c1a] bg-white border border-[#4f46e5] rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-[#4f46e5] shadow-inner"
              />
              <p className="text-[11px] text-[#5f5f5b]">
                Tip: You can customize directives, add regulatory constraints, or paste custom system instructions for {brand.name}.
              </p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#1b1c1a] bg-white border border-[#e9e9e7] rounded-xl p-4 max-h-80 overflow-y-auto select-all">
              {prompt}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
};
