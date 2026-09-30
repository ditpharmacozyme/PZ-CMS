import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { MASTER_PROMPT, MASTER_PROMPT_STEPS, MASTER_PROMPT_SETTING_KEY } from '../../data/masterPrompt';
import { fetchRemoteSetting, upsertRemoteSetting, deleteRemoteSetting, subscribeRemoteSetting } from '../../utils/storage';

interface MasterPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string) => void;
}

export const MasterPromptModal: React.FC<MasterPromptModalProps> = ({ isOpen, onClose, showToast }) => {
  const [prompt, setPrompt] = useState(MASTER_PROMPT);
  const [isCustom, setIsCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchRemoteSetting(MASTER_PROMPT_SETTING_KEY).then((value) => {
      if (cancelled) return;
      setPrompt(value ?? MASTER_PROMPT);
      setIsCustom(value !== null);
    });
    const unsubscribe = subscribeRemoteSetting(MASTER_PROMPT_SETTING_KEY, (value) => {
      setPrompt(value ?? MASTER_PROMPT);
      setIsCustom(value !== null);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    showToast?.('Prompt copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    setDraft(prompt);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim() ? draft : MASTER_PROMPT;
    await upsertRemoteSetting(MASTER_PROMPT_SETTING_KEY, trimmed);
    setPrompt(trimmed);
    setIsCustom(true);
    setIsEditing(false);
    showToast?.('Master prompt updated for the team');
  };

  const handleReset = async () => {
    await deleteRemoteSetting(MASTER_PROMPT_SETTING_KEY);
    setPrompt(MASTER_PROMPT);
    setIsCustom(false);
    showToast?.('Master prompt reset to default');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Calendar Prompt"
      description="Generate a batch of posts with your own AI, then import the result here."
      icon={<span className="material-symbols-outlined text-xl text-[#4f46e5]">auto_awesome</span>}
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-[#f1f1f0] border border-[#e9e9e7] rounded-xl p-4">
          <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest mb-2">How to use this</p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {MASTER_PROMPT_STEPS.map((step) => (
              <li key={step} className="font-body-md text-xs text-[#1b1c1a]">{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest">
              The Prompt{isCustom && !isEditing && <span className="ml-1.5 normal-case font-body-md text-[#4f46e5]">(team-customized)</span>}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isEditing && (
                <>
                  {isCustom && (
                    <button
                      onClick={handleReset}
                      className="px-2.5 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] transition-all"
                    >
                      Reset to Default
                    </button>
                  )}
                  <button
                    onClick={startEditing}
                    className="px-2.5 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg flex items-center gap-1.5 transition-all ${
                      copied ? 'bg-[#16a34a] text-white' : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white transition-all"
                  >
                    Save
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="w-full font-mono text-[11px] leading-relaxed text-[#1b1c1a] bg-white border border-[#4f46e5] rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#1b1c1a] bg-white border border-[#e9e9e7] rounded-xl p-4 max-h-80 overflow-y-auto">
              {prompt}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
};
