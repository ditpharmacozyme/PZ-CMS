import React, { useState, useMemo } from 'react';
import { BrandId, BrandConfig, ContentBankItem } from '../types';
import { useBrands } from '../context/BrandsContext';
import { todayStr } from '../utils/date';
import { voiceRulesReducer } from '../utils/voiceRules';
import { uploadAsset } from '../utils/uploadAsset';
import { logAuditEvent, buildAuditEvent } from '../utils/audit';

type ShowToast = (
  message: string,
  action?: undefined,
  durationMs?: number,
  variant?: 'success' | 'error'
) => void;

/** Plain, JSON-safe snapshot of a brand for the audit trail's before/after values. */
const brandSnapshot = (b: BrandConfig): Record<string, unknown> => ({
  name: b.name,
  shortCode: b.shortCode,
  tagline: b.tagline,
  description: b.description,
  primaryColor: b.primaryColor,
  secondaryColor: b.secondaryColor,
  accentColor: b.accentColor,
  surfaceColor: b.surfaceColor,
  icon: b.icon,
  logoUrl: b.logoUrl ?? null,
  voiceRules: [...b.voiceRules],
  fonts: { ...b.fonts },
});

const COLOR_FIELDS: { key: 'primaryColor' | 'secondaryColor' | 'accentColor' | 'surfaceColor'; label: string }[] = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'surfaceColor', label: 'Surface' },
];

const FONT_FIELDS: (keyof BrandConfig['fonts'])[] = ['display', 'headline', 'code', 'body'];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const inputCls =
  'w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#4f46e5] focus:outline-none';
const fieldLabelCls = 'font-label-caps text-[10px] text-[#5f5f5b] font-bold block mb-1.5';

interface BrandControlCenterProps {
  selectedBrandFilter: BrandId | 'all';
  onSelectBrandFilter: (brand: BrandId | 'all') => void;
  /** Persist a tuned prompt into the Content Bank (source 'AI Prompt') so it
   *  survives the next tweak -- the section otherwise only offered Copy. */
  onSaveToLibrary?: (item: ContentBankItem) => void;
  /** Toast callback from App. Optional so the panel degrades gracefully when
   *  rendered in isolation (tests, Storybook). */
  showToast?: ShowToast;
}

type PromptGoal = 'carousel' | 'quiz' | 'flashcard' | 'clinical-breakdown' | 'weekly-digest' | 'patient-guide';
type PromptTone = 'clinical-rigor' | 'engaging-educational' | 'urgent-diagnostic' | 'patient-reassuring' | 'operational';

export const BrandControlCenter: React.FC<BrandControlCenterProps> = ({
  selectedBrandFilter,
  onSelectBrandFilter,
  onSaveToLibrary,
  showToast
}) => {
  const { brands, updateBrand } = useBrands();
  const [activeBrandId, setActiveBrandId] = useState<BrandId>(
    selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter
  );
  const [specGridActive, setSpecGridActive] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // ── AI Prompt Generator State ────────────────────────────────────────────────
  const [selectedGoal, setSelectedGoal] = useState<PromptGoal>('carousel');
  const [selectedTone, setSelectedTone] = useState<PromptTone>('engaging-educational');
  const [customTopic, setCustomTopic] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const brand = brands[activeBrandId];

  // ── Brand kit edit panel state ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<BrandConfig | null>(null);

  const startEdit = () => {
    setDraft({ ...brand, voiceRules: [...brand.voiceRules], fonts: { ...brand.fonts } });
    setIsEditing(true);
  };
  const cancelEdit = () => {
    setDraft(null);
    setIsEditing(false);
  };
  const patch = (p: Partial<BrandConfig>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchVoiceRules = (action: Parameters<typeof voiceRulesReducer>[1]) =>
    setDraft((d) => (d ? { ...d, voiceRules: voiceRulesReducer(d.voiceRules, action) } : d));

  const saveEdit = async () => {
    if (!draft) return;
    logAuditEvent(
      buildAuditEvent({
        actorId: 'brand-kit',
        actorName: 'Brand Kit',
        actionType: 'brand_edited',
        entityType: 'brand',
        entityId: draft.id,
        entityTitle: draft.name,
        beforeValue: brandSnapshot(brand),
        afterValue: brandSnapshot(draft),
      })
    );
    await updateBrand(draft.id, draft);
    // Panel stays open so the saved values remain visible for further tweaks;
    // the visible refresh comes from updateBrand updating context. Cancel is the
    // way out (and discards).
    showToast?.(`${draft.name} brand kit updated.`, undefined, 3000, 'success');
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Clear the input so re-selecting the same file (e.g. after a failed
    // upload) still fires a change event — matches AssetLibrary's upload zone.
    e.target.value = '';
    if (!f) return;
    try {
      const { url } = await uploadAsset(f, 'logos');
      patch({ logoUrl: url });
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : 'Upload failed', undefined, 4000, 'error');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSavePrompt = (text: string, kind: string, tags: string[]) => {
    if (!onSaveToLibrary) return;
    onSaveToLibrary({
      id: `bank-${Date.now()}`,
      text,
      tags: Array.from(new Set(['prompt', kind, ...tags])),
      source: 'AI Prompt',
      savedDate: todayStr(),
      brandId: activeBrandId,
    });
    setCopiedText(`Saved "${kind}" to Content Bank`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // ── Master System Persona Prompt ─────────────────────────────────────────────
  const masterSystemPrompt = useMemo(() => {
    return `You are the Lead Content Strategist & Medical Copywriter for "${brand.name}".
Tagline: "${brand.tagline}"
Brand Overview: ${brand.description}

### BRAND IDENTITY & COLOR PALETTE:
- Primary Color: ${brand.primaryColor}
- Secondary Color: ${brand.secondaryColor}
- Accent Color: ${brand.accentColor}
- Background Surface: ${brand.surfaceColor}

### EDITORIAL VOICE & GUARDRAILS:
${brand.voiceRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### COMPLIANCE & ACCURACY:
- Ensure all claims are scientifically grounded and authoritative.
- Never use generic marketing fluff or unsubstantiated wellness hype.
- Use clear structure, scannable bullet points, and accurate medical/molecular nomenclature.

When generating content for this brand, always embody this tone, adhere strictly to these rules, and provide ready-to-publish scripts with visual suggestions.`;
  }, [brand]);

  // ── Dynamic Post Prompt Builder ──────────────────────────────────────────────
  const generatedPostPrompt = useMemo(() => {
    const topic = customTopic.trim() || 'Key molecular mechanism and clinical application';

    const goalDescriptions: Record<PromptGoal, string> = {
      carousel: 'A multi-slide educational Instagram carousel (5-7 slides) with hook slide, step-by-step breakdown, and call-to-action.',
      quiz: 'A high-yield clinical quiz post with question, 4 options (A-D), followed by a detailed molecular explanation.',
      flashcard: 'A high-impact flashcard teaser card highlighting a key medical fact, clinical pearl, or diagnostic mnemonic.',
      'clinical-breakdown': 'A deep-dive clinical protocol summary detailing dosage, mechanism of action, and patient monitoring.',
      'weekly-digest': 'A weekly roundup summarizing 3 breakthrough research developments in metabolic/enzymatic therapeutics.',
      'patient-guide': 'A clear, compassionate patient compliance guide explaining how this therapy works in simple terms.'
    };

    const toneDescriptions: Record<PromptTone, string> = {
      'clinical-rigor': 'High academic rigor, precise terminology, suited for physicians and specialists.',
      'engaging-educational': 'Engaging, clear, and structured for medical students, researchers, and healthcare professionals.',
      'urgent-diagnostic': 'Direct, diagnostic-first, protocol-focused with bold action points.',
      'patient-reassuring': 'Clear, reassuring, patient-centric, avoiding excessive jargon while maintaining accuracy.',
      'operational': 'Technical, system-level, highlighting precision metrics and protocols.'
    };

    let prompt = `Act as the official copywriter for ${brand.name} (${brand.tagline}).

TASK: Write a ${goalDescriptions[selectedGoal]}
TOPIC: ${topic}
TONE: ${toneDescriptions[selectedTone]}

EDITORIAL VOICE RULES TO FOLLOW:
${brand.voiceRules.map((r, i) => `- ${r}`).join('\n')}

OUTPUT FORMAT:
1. Post Title (Engaging & Clear)
2. Slide-by-Slide Content (or Body Copy) with Visual Suggestions for each section
3. Instagram Caption (Hook line + value body + CTA)
4. Recommended Hashtags (3-5 focused hashtags)
5. Designer Notes (Recommended visual palette: ${brand.primaryColor} and ${brand.secondaryColor})`;

    if (additionalNotes.trim()) {
      prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${additionalNotes.trim()}`;
    }

    return prompt;
  }, [brand, selectedGoal, selectedTone, customTopic, additionalNotes]);

  // ── AI Image Generation Prompt ───────────────────────────────────────────────
  const imageGenerationPrompt = useMemo(() => {
    return `Professional medical visual for ${brand.name}: 3D high-precision scientific render of ${customTopic.trim() || 'molecular enzyme structure'}, studio lighting, cinematic volumetric glow with brand colors (${brand.primaryColor} accents against sleek dark scientific background), hyper-realistic micro-detail, medical illustration, 8k resolution, clean minimal composition --ar 4:5 --v 6.0`;
  }, [brand, customTopic]);

  // ── Suggested Brand Hashtags ─────────────────────────────────────────────────
  const brandHashtags = useMemo(() => {
    const base = [`#${brand.name.replace(/\s+/g, '')}`, '#MedicalScience', '#HealthcareInnovation'];
    if (activeBrandId === 'pharmacozyme') base.push('#EnzymeTherapeutics', '#MetabolicHealth', '#BiotechResearch');
    if (activeBrandId === 'pz-academy') base.push('#MedEd', '#ClinicalResearch', '#MolecularBiology', '#USMLE');
    if (activeBrandId === 'med-q') base.push('#DiagnosticQuiz', '#OncologyProtocols', '#ClinicalMedicine');
    if (activeBrandId === 'pillz') base.push('#MedicationAdherence', '#PatientCare', '#DosageAccuracy');
    if (activeBrandId === 'prescriptionz') base.push('#RxOperations', '#PharmacySystems', '#HealthTech');
    return base.join(' ');
  }, [brand, activeBrandId]);

  return (
    <div className={`p-4 md:p-8 space-y-8 max-w-7xl mx-auto ${specGridActive ? 'spec-grid' : ''}`}>
      {/* Header & Brand Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#efefed] bg-white p-5 rounded-xl shadow-xs">
        <div>
          <span className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">
            Brand Intelligence & AI Center
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Brand Kit & AI Studio
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {copiedText && (
            <span className="font-label-caps text-xs font-bold text-[#4f46e5] bg-[#eef2ff] px-3 py-1.5 rounded-lg border border-[#4f46e5]/30 animate-pulse">
              ✓ Copied {copiedText}!
            </span>
          )}
          <button
            onClick={() => setSpecGridActive(!specGridActive)}
            className={`px-3 py-1.5 font-label-caps text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
              specGridActive
                ? 'bg-[#4f46e5] text-white border-[#4f46e5] font-bold shadow-xs'
                : 'bg-white text-[#5f5f5b] border-[#e9e9e7] hover:bg-[#f1f1f0]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">grid_3x3</span>
            <span>Spec Grid: {specGridActive ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={isEditing ? cancelEdit : startEdit}
            aria-label={isEditing ? 'Close editor' : 'Edit brand kit'}
            className={`px-3 py-1.5 font-label-caps text-xs rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
              isEditing
                ? 'bg-white text-[#5f5f5b] border-[#e9e9e7] hover:bg-[#f1f1f0]'
                : 'bg-[#1b1c1a] text-white border-[#1b1c1a] hover:bg-[#4f46e5] shadow-xs'
            }`}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">{isEditing ? 'close' : 'tune'}</span>
            <span>{isEditing ? 'Close editor' : 'Edit brand kit'}</span>
          </button>
        </div>
      </div>

      {/* Brand Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Object.values(brands).map((b) => {
          const isActive = activeBrandId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => {
                // Close the editor on brand switch — otherwise the panel keeps
                // binding (and Save keeps targeting) the brand we navigated away from.
                if (isEditing) cancelEdit();
                setActiveBrandId(b.id);
                onSelectBrandFilter(b.id);
              }}
              style={{
                borderColor: isActive ? b.primaryColor : '#efefed',
                color: isActive ? b.primaryColor : '#57574f'
              }}
              className={`px-4 py-2.5 font-label-caps text-xs rounded-xl border font-bold transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                isActive ? 'bg-white shadow-xs scale-102 ring-1 ring-inset' : 'bg-[#f4f4f3] hover:bg-white'
              }`}
            >
              {b.logoUrl ? (
                <div className="w-5 h-5 rounded bg-white p-0.5 border border-[#e9e9e7]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={b.logoUrl} alt={b.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <span className="material-symbols-outlined text-base" style={{ color: b.primaryColor }}>
                  {b.icon}
                </span>
              )}
              <span>{b.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── Edit brand kit panel ── */}
      {isEditing && draft && (
        <div className="bg-white border border-[#4f46e5]/30 rounded-xl shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#efefed]">
            <div>
              <h3 className="font-display-xl text-xl font-bold text-[#1b1c1a]">
                Edit {brand.name} Brand Kit
              </h3>
              <p className="text-xs text-[#5f5f5b]">
                Changes persist for this session and sync to Supabase when available.
              </p>
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-4">
            <h4 className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">Identity</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={fieldLabelCls} htmlFor="brand-name">Name</label>
                <input id="brand-name" type="text" className={inputCls} value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabelCls} htmlFor="brand-shortcode">Short code</label>
                <input id="brand-shortcode" type="text" className={inputCls} value={draft.shortCode}
                  onChange={(e) => patch({ shortCode: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabelCls} htmlFor="brand-tagline">Tagline</label>
                <input id="brand-tagline" type="text" className={inputCls} value={draft.tagline}
                  onChange={(e) => patch({ tagline: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={fieldLabelCls} htmlFor="brand-description">Description</label>
              <textarea id="brand-description" rows={2} className={`${inputCls} resize-none`} value={draft.description}
                onChange={(e) => patch({ description: e.target.value })} />
            </div>
          </div>

          {/* Colours */}
          <div className="space-y-4">
            <h4 className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">Colours</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLOR_FIELDS.map(({ key, label }) => {
                const val = draft[key];
                return (
                  <div key={key} className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg space-y-2">
                    <span className={fieldLabelCls}>{label}</span>
                    <div
                      className="h-10 w-full rounded-md border border-[#e9e9e7]/60"
                      style={{ backgroundColor: HEX_RE.test(val) ? val : 'transparent' }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${label} colour picker`}
                        className="h-8 w-9 flex-shrink-0 rounded border border-[#e9e9e7] bg-white cursor-pointer"
                        value={HEX_RE.test(val) ? val.toLowerCase() : '#000000'}
                        onChange={(e) => patch({ [key]: e.target.value } as Partial<BrandConfig>)}
                      />
                      <input
                        type="text"
                        aria-label={`${label} colour hex`}
                        className={`${inputCls} font-code-sm`}
                        value={val}
                        onChange={(e) => patch({ [key]: e.target.value } as Partial<BrandConfig>)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-4">
            <h4 className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">Logo</h4>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-white p-1.5 border border-[#e9e9e7] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {draft.logoUrl
                  ? <img src={draft.logoUrl} alt={`${draft.name} logo`} className="w-full h-full object-contain" />
                  : <span className="material-symbols-outlined text-[#5f5f5b]">image</span>}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Upload logo image"
                  onChange={onLogoFile}
                  className="block w-full text-xs text-[#5f5f5b] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#e9e9e7] file:bg-white file:text-[#4f46e5] file:font-bold file:text-xs"
                />
                <input
                  type="text"
                  aria-label="Logo URL"
                  placeholder="…or paste a logo URL"
                  className={inputCls}
                  value={draft.logoUrl ?? ''}
                  onChange={(e) => patch({ logoUrl: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Voice rules */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">Voice rules</h4>
              <button
                onClick={() => patchVoiceRules({ type: 'add' })}
                className="px-3 py-1.5 bg-white border border-[#e9e9e7] hover:bg-[#eef2ff] text-[#4f46e5] font-label-caps text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Add rule</span>
              </button>
            </div>
            <div className="space-y-2">
              {draft.voiceRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Voice rule ${i + 1} text`}
                    className={inputCls}
                    value={rule}
                    onChange={(e) => patchVoiceRules({ type: 'edit', index: i, text: e.target.value })}
                  />
                  <button
                    aria-label={`Move voice rule ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => patchVoiceRules({ type: 'move', from: i, to: i - 1 })}
                    className="p-1.5 text-[#5f5f5b] hover:text-[#4f46e5] hover:bg-[#eef2ff] rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  </button>
                  <button
                    aria-label={`Move voice rule ${i + 1} down`}
                    disabled={i === draft.voiceRules.length - 1}
                    onClick={() => patchVoiceRules({ type: 'move', from: i, to: i + 1 })}
                    className="p-1.5 text-[#5f5f5b] hover:text-[#4f46e5] hover:bg-[#eef2ff] rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  </button>
                  <button
                    aria-label={`Remove voice rule ${i + 1}`}
                    onClick={() => patchVoiceRules({ type: 'remove', index: i })}
                    className="p-1.5 text-[#dc2626] hover:bg-[#dc2626]/10 rounded-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div className="space-y-4">
            <h4 className="font-label-caps text-xs text-[#4338ca] font-bold tracking-widest">Fonts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FONT_FIELDS.map((fk) => (
                <div key={fk}>
                  <label className={fieldLabelCls} htmlFor={`brand-font-${fk}`}>{fk}</label>
                  <input
                    id={`brand-font-${fk}`}
                    type="text"
                    aria-label={`${fk} font label`}
                    className={inputCls}
                    value={draft.fonts[fk]}
                    onChange={(e) => patch({ fonts: { ...draft.fonts, [fk]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#5f5f5b] italic">
              Reference labels for the team — these do not re-skin the app.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#efefed]">
            <button
              onClick={cancelEdit}
              aria-label="Cancel"
              className="px-4 py-2 bg-white border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#5f5f5b] font-label-caps text-xs font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              aria-label="Save"
              className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">save</span>
              <span>Save</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Section 1: AI Prompting Hub (Hero Feature) ── */}
      <div className="bg-white border border-[#efefed] rounded-xl shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#efefed]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl">smart_toy</span>
            </div>
            <div>
              <h3 className="font-display-xl text-xl font-bold text-[#1b1c1a]">
                AI Prompts & Persona Generator
              </h3>
              <p className="text-xs text-[#5f5f5b]">
                Generate structured, brand-accurate prompts for ChatGPT, Claude, Gemini, or Midjourney.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSaveToLibrary && (
              <button
                onClick={() => handleSavePrompt(masterSystemPrompt, 'System Persona Prompt', ['persona'])}
                className="px-3 py-2 bg-white border border-[#e9e9e7] hover:bg-[#eef2ff] text-[#4f46e5] font-label-caps text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Save this prompt to the Content Bank"
              >
                <span className="material-symbols-outlined text-sm">bookmark_add</span>
                <span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button
              onClick={() => handleCopy(masterSystemPrompt, 'System Persona Prompt')}
              className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#4f46e5] text-white font-label-caps text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              <span>Copy Master System Prompt</span>
            </button>
          </div>
        </div>

        {/* Interactive Prompt Builder Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold block mb-1.5">
                1. Content Goal
              </label>
              <select
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value as PromptGoal)}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#4f46e5] focus:outline-none"
              >
                <option value="carousel">Instagram Educational Carousel (5-7 Slides)</option>
                <option value="quiz">High-Yield Clinical Quiz & Answer</option>
                <option value="flashcard">Medical Flashcard / Clinical Pearl</option>
                <option value="clinical-breakdown">Deep-Dive Clinical Protocol Breakdown</option>
                <option value="weekly-digest">Weekly Research & News Digest</option>
                <option value="patient-guide">Patient Compliance & Education Guide</option>
              </select>
            </div>

            <div>
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold block mb-1.5">
                2. Tone & Depth
              </label>
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as PromptTone)}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#4f46e5] focus:outline-none"
              >
                <option value="engaging-educational">Engaging & Educational (Med students / Clinicians)</option>
                <option value="clinical-rigor">High Academic Rigor (Physicians / Specialists)</option>
                <option value="urgent-diagnostic">Direct & Diagnostic Protocol (Unit Teams)</option>
                <option value="patient-reassuring">Clear & Compassionate (Patient-Facing)</option>
                <option value="operational">Operational & Telemetry (System Level)</option>
              </select>
            </div>

            <div>
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold block mb-1.5">
                3. Topic / Keyword Focus
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Lipase enzyme activation in acute pancreatitis"
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#4f46e5] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold block mb-1.5">
                4. Additional Custom Instructions (Optional)
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g. Include reference to recent 2025 guidelines; make slide 3 a diagram suggestion"
                rows={2}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#4f46e5] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Generated Live Output */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-[#1b1c1a] text-white p-5 rounded-xl space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                <span className="font-label-caps text-[10px] text-[#86efac] font-bold tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
                  Ready to paste into ChatGPT / Claude
                </span>
                <span className="text-[10px] text-white/50">{brand.name} Prompt</span>
              </div>
              <pre className="font-code-sm text-xs text-white/90 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/5">
                {generatedPostPrompt}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => handleCopy(generatedPostPrompt, 'Post Prompt')}
                className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy Post Prompt</span>
              </button>

              {onSaveToLibrary && (
                <button
                  onClick={() => handleSavePrompt(generatedPostPrompt, 'Post Prompt', [selectedGoal, selectedTone])}
                  className="bg-white/10 hover:bg-white/20 text-white font-label-caps text-xs font-bold py-2.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Save this prompt to the Content Bank"
                >
                  <span className="material-symbols-outlined text-sm">bookmark_add</span>
                  <span>Save</span>
                </button>
              )}

              <button
                onClick={() => handleCopy(imageGenerationPrompt, 'Midjourney Image Prompt')}
                className="bg-white/10 hover:bg-white/20 text-white font-label-caps text-xs font-bold py-2.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copy AI image generation prompt for Midjourney / DALL-E"
              >
                <span className="material-symbols-outlined text-sm">image</span>
                <span>Image Prompt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Visual Specs, Colors & Typography ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colors */}
        <div className="lg:col-span-6 bg-white border border-[#efefed] p-6 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#efefed]">
            <h4 className="font-display-xl text-lg font-bold text-[#1b1c1a]">
              Brand Color Palette
            </h4>
            <span className="text-xs text-[#5f5f5b]">Click swatch to copy hex</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Primary Brand', hex: brand.primaryColor },
              { label: 'Secondary Tint', hex: brand.secondaryColor },
              { label: 'Deep Accent', hex: brand.accentColor },
              { label: 'Surface Warm', hex: brand.surfaceColor }
            ].map((col, i) => (
              <div
                key={i}
                onClick={() => handleCopy(col.hex, `Hex ${col.hex}`)}
                className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg cursor-pointer hover:border-[#4f46e5] transition-all group"
              >
                <div
                  className="h-12 w-full rounded-md border border-[#e9e9e7]/60 mb-2 shadow-inner group-hover:scale-102 transition-transform"
                  style={{ backgroundColor: col.hex }}
                />
                <span className="font-label-caps text-[9px] text-[#5f5f5b] block">
                  {col.label}
                </span>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="font-code-sm text-xs font-bold text-[#1b1c1a]">{col.hex}</span>
                  <span className="material-symbols-outlined text-xs text-[#5f5f5b] group-hover:text-[#4f46e5]">
                    content_copy
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Snippets & Hashtags */}
        <div className="lg:col-span-6 bg-white border border-[#efefed] p-6 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#efefed]">
            <h4 className="font-display-xl text-lg font-bold text-[#1b1c1a]">
              Quick Copy Assets & Snippets
            </h4>
            <span className="text-xs text-[#5f5f5b]">1-Click Copy</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block">Tagline</span>
                <p className="text-xs font-semibold text-[#1b1c1a] truncate">{brand.tagline}</p>
              </div>
              <button
                onClick={() => handleCopy(brand.tagline, 'Tagline')}
                className="p-1.5 text-[#4f46e5] hover:bg-[#eef2ff] rounded-md transition-colors"
                title="Copy tagline"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>

            <div className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block">Recommended Hashtags</span>
                <p className="font-code-sm text-xs text-[#4338ca] truncate">{brandHashtags}</p>
              </div>
              <button
                onClick={() => handleCopy(brandHashtags, 'Hashtags')}
                className="p-1.5 text-[#4f46e5] hover:bg-[#eef2ff] rounded-md transition-colors"
                title="Copy hashtags"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>

            <div className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block">Brand Bio</span>
                <p className="text-xs text-[#57574f] line-clamp-1">{brand.description}</p>
              </div>
              <button
                onClick={() => handleCopy(brand.description, 'Brand Bio')}
                className="p-1.5 text-[#4f46e5] hover:bg-[#eef2ff] rounded-md transition-colors"
                title="Copy bio description"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Typography Specimen & Voice Rules ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Specimen Scale */}
        <div className="lg:col-span-6 bg-white border border-[#efefed] p-6 rounded-xl shadow-xs space-y-4">
          <h4 className="font-display-xl text-lg font-bold text-[#1b1c1a] pb-3 border-b border-[#efefed]">
            Typography Specimen Scale
          </h4>

          <div className="space-y-4 bg-[#f4f4f3] p-4 rounded-lg border border-[#efefed]">
            <div>
              <span className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                Display Font Specimen ({brand.fonts.display})
              </span>
              <p className="font-specimen-display text-2xl font-bold text-[#1b1c1a]">
                {brand.name}: {brand.tagline}
              </p>
            </div>

            <div>
              <span className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                Headline Specimen ({brand.fonts.headline})
              </span>
              <p className="font-specimen-headline text-lg font-bold text-[#4338ca]">
                Precision Medical Synthesis Protocol
              </p>
            </div>

            <div>
              <span className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                Body Copy Specimen ({brand.fonts.body})
              </span>
              <p className="font-specimen-body text-xs text-[#57574f] leading-relaxed">
                {brand.description}
              </p>
            </div>
          </div>
        </div>

        {/* Voice Rules */}
        <div className="lg:col-span-6 bg-white border border-[#efefed] p-6 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#efefed]">
            <h4 className="font-display-xl text-lg font-bold text-[#1b1c1a]">
              Editorial Voice Guardrails
            </h4>
            <button
              onClick={() => handleCopy(brand.voiceRules.join('\n'), 'Voice Rules')}
              className="text-xs text-[#4f46e5] font-label-caps font-bold hover:underline"
            >
              Copy Rules
            </button>
          </div>

          <div className="space-y-2.5">
            {brand.voiceRules.map((rule, idx) => (
              <div key={idx} className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-lg">
                <span className="font-label-caps text-[9px] text-[#4f46e5] font-bold block mb-0.5">
                  GUARDRAIL 0{idx + 1}
                </span>
                <p className="text-xs text-[#1b1c1a] leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
