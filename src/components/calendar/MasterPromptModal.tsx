import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { MASTER_PROMPT, MASTER_PROMPT_STEPS } from '../../data/masterPrompt';

interface MasterPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string) => void;
}

export const MasterPromptModal: React.FC<MasterPromptModalProps> = ({ isOpen, onClose, showToast }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MASTER_PROMPT);
    setCopied(true);
    showToast?.('Prompt copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
          <div className="flex items-center justify-between mb-2">
            <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest">The Prompt</p>
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg flex items-center gap-1.5 transition-all ${
                copied ? 'bg-[#16a34a] text-white' : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#1b1c1a] bg-white border border-[#e9e9e7] rounded-xl p-4 max-h-80 overflow-y-auto">
            {MASTER_PROMPT}
          </pre>
        </div>
      </div>
    </Modal>
  );
};
