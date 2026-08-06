import React, { useState, useEffect } from 'react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/googleAppsScript';
import { Post } from '../types';

interface GoogleAppsScriptHubProps {
  posts: Post[];
  onUploadComplete?: (newUrl: string) => void;
}

export const GoogleAppsScriptHub: React.FC<GoogleAppsScriptHubProps> = ({
  posts,
  onUploadComplete
}) => {
  const [activeTab, setActiveTab] = useState<'script' | 'tester' | 'guide' | 'backend'>('script');
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<any>(null);
  
  // File Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Sync Sheets State
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Express Health State
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('appscript_url');
    if (savedUrl) setScriptUrl(savedUrl);

    checkBackendHealth();
  }, []);

  const handleSaveScriptUrl = (url: string) => {
    setScriptUrl(url);
    localStorage.setItem('appscript_url', url);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const checkBackendHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setServerHealth(data);
    } catch (err: any) {
      setServerHealth({ status: 'error', message: err.message });
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleTestPing = async () => {
    if (!scriptUrl) {
      alert('Please enter your deployed Google Apps Script Web App URL first.');
      return;
    }

    setTestingPing(true);
    setPingResult(null);

    try {
      // Use proxy backend route
      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl,
          payload: { action: 'health' }
        })
      });
      const data = await res.json();
      setPingResult(data);
    } catch (err: any) {
      setPingResult({ status: 'error', error: err.message });
    } finally {
      setTestingPing(false);
    }
  };

  const handleTestFileUpload = async () => {
    if (!uploadFile) {
      alert('Please select an image or file to upload.');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        if (scriptUrl) {
          // Upload via Google Apps Script Web App (Proxy)
          const res = await fetch('/api/appscript/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scriptUrl,
              payload: {
                action: 'upload',
                fileName: uploadFile.name,
                mimeType: uploadFile.type,
                base64Data
              }
            })
          });
          const data = await res.json();
          setUploadResult(data);
          if (data?.data?.url && onUploadComplete) {
            onUploadComplete(data.data.url);
          }
        } else {
          // Fallback upload directly to Express Node Server
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: uploadFile.name,
              mimeType: uploadFile.type,
              base64Data
            })
          });
          const data = await res.json();
          setUploadResult({ status: 'success', data });
          if (data?.url && onUploadComplete) {
            onUploadComplete(data.url);
          }
        }
        setUploading(false);
      };
      reader.readAsDataURL(uploadFile);
    } catch (err: any) {
      setUploadResult({ status: 'error', error: err.message });
      setUploading(false);
    }
  };

  const handleSyncToSheets = async () => {
    if (!scriptUrl) {
      alert('Please enter your deployed Google Apps Script Web App URL first.');
      return;
    }

    setSyncingSheets(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl,
          payload: {
            action: 'syncAllPosts',
            posts
          }
        })
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (err: any) {
      setSyncResult({ status: 'error', error: err.message });
    } finally {
      setSyncingSheets(false);
    }
  };

  return (
    <div className="flex-1 bg-[#FAF9F5] p-3 sm:p-6 overflow-y-auto space-y-6 min-h-screen">
      {/* Header Banner */}
      <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#296c00] text-3xl">terminal</span>
            <div>
              <span className="font-label-caps text-xs font-bold text-[#296951] uppercase tracking-wider">
                Storage & Automation
              </span>
              <h1 className="font-display-xl text-xl sm:text-2xl md:text-3xl text-[#1b1c1a] font-bold">
                Integrations
              </h1>
            </div>
          </div>
          <p className="font-body-md text-xs sm:text-sm text-[#707a67] mt-2 max-w-3xl">
            Connect Google Apps Script to upload images to Drive, send email reminders, and optionally export a Sheets snapshot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={checkBackendHealth}
            disabled={checkingHealth}
            className="px-3 py-2 bg-[#efeeea] border border-[#bfcab4] rounded font-label-caps text-xs text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-all flex items-center gap-1.5 min-h-[40px]"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>{checkingHealth ? 'Checking Server...' : 'Server Health'}</span>
          </button>
          
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 bg-[#296c00] text-white rounded font-label-caps text-xs font-bold hover:bg-[#1f5700] active:scale-95 transition-all flex items-center gap-1.5 shadow-xs min-h-[40px]"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check_circle' : 'content_copy'}
            </span>
            <span>{copied ? 'Code.gs Copied!' : 'Copy Code.gs Script'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#bfcab4] gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('script')}
          className={`px-4 py-2.5 font-label-caps text-xs font-bold transition-all border-b-2 whitespace-nowrap min-h-[42px] ${
            activeTab === 'script'
              ? 'border-[#296c00] text-[#296c00] bg-white'
              : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
          }`}
        >
          Script code
        </button>
        <button
          onClick={() => setActiveTab('tester')}
          className={`px-4 py-2.5 font-label-caps text-xs font-bold transition-all border-b-2 whitespace-nowrap min-h-[42px] ${
            activeTab === 'tester'
              ? 'border-[#296c00] text-[#296c00] bg-white'
              : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
          }`}
        >
          Connection & upload test
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2.5 font-label-caps text-xs font-bold transition-all border-b-2 whitespace-nowrap min-h-[42px] ${
            activeTab === 'guide'
              ? 'border-[#296c00] text-[#296c00] bg-white'
              : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
          }`}
        >
          Setup guide
        </button>
        <button
          onClick={() => setActiveTab('backend')}
          className={`px-4 py-2.5 font-label-caps text-xs font-bold transition-all border-b-2 whitespace-nowrap min-h-[42px] ${
            activeTab === 'backend'
              ? 'border-[#296c00] text-[#296c00] bg-white'
              : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
          }`}
        >
          Server info
        </button>
      </div>

      {/* TAB 1: APPS SCRIPT CODE */}
      {activeTab === 'script' && (
        <div className="space-y-4">
          {/* Syntax Error Prevention Banner */}
          <div className="bg-[#fff8f6] border border-[#ffb4ab] p-4 rounded-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-[#ba1a1a] text-xl mt-0.5 flex-shrink-0">
              warning
            </span>
            <div className="space-y-1 text-xs text-[#410002]">
              <h4 className="font-bold font-headline-md text-sm text-[#ba1a1a]">
                Fixing "SyntaxError: Unexpected token 'export' line: 6 file: Code.gs"
              </h4>
              <p className="font-body-md text-xs leading-relaxed">
                Google Apps Script (in Google Drive) is pure JavaScript and <strong>does NOT support TypeScript <code className="bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">export</code> keywords</strong>. If you copy the React component file (<code className="bg-[#ffdad6] px-1 py-0.5 rounded">googleAppsScript.ts</code>), line 6 contains <code className="bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">export const GOOGLE_APPS_SCRIPT_CODE...</code> which causes this exact error in Google Apps Script!
              </p>
              <p className="font-body-md text-xs font-bold text-[#ba1a1a] mt-1">
                👉 Click the green <strong>"Copy Clean Code.gs"</strong> button below. It automatically strips all React/TypeScript wrappers and copies clean, pure Apps Script code (<code className="bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">doGet</code>, <code className="bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">doPost</code>, <code className="bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">handleFileUpload</code>).
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#bfcab4] p-4 rounded-lg shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                Pure Google Apps Script Source Code (<code className="text-[#296c00]">Code.gs</code>)
              </h3>
              <p className="font-body-md text-xs text-[#707a67]">
                Click below to copy clean code, then replace all text in your Google Apps Script editor at{' '}
                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#296c00] font-bold underline"
                >
                  script.google.com
                </a>
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700] transition-all min-h-[40px] whitespace-nowrap shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? 'check_circle' : 'content_copy'}
              </span>
              <span>{copied ? '✓ Clean Code.gs Copied!' : 'Copy Clean Code.gs'}</span>
            </button>
          </div>

          <div className="relative bg-[#1e231b] text-[#aceecf] p-4 sm:p-6 rounded-lg font-mono text-xs overflow-x-auto shadow-inner border border-[#404a39] max-h-[550px]">
            <pre className="whitespace-pre">{GOOGLE_APPS_SCRIPT_CODE}</pre>
          </div>
        </div>
      )}

      {/* TAB 2: TESTER & WEB APP CONFIG */}
      {activeTab === 'tester' && (
        <div className="space-y-6">
          {/* Deployed Web App URL Configuration */}
          <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#296c00]">link</span>
              <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                Deployed Web App URL Configuration
              </h3>
            </div>
            <p className="font-body-md text-xs text-[#707a67]">
              Enter the Web App URL generated after deploying your Google Apps Script as a Web App (with "Anyone" access):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => handleSaveScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="flex-1 bg-[#faf9f5] border border-[#bfcab4] px-3 py-2.5 font-code-sm text-xs text-[#1b1c1a] focus:bg-white focus:border-[#296c00] focus:outline-none rounded min-h-[44px]"
              />
              <button
                onClick={handleTestPing}
                disabled={testingPing || !scriptUrl}
                className="px-5 py-2.5 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700] disabled:opacity-50 transition-all min-h-[44px]"
              >
                {testingPing ? 'Pinging...' : 'Test Connection'}
              </button>
            </div>

            {pingResult && (
              <div
                className={`p-4 rounded-lg border text-xs font-code-sm overflow-x-auto ${
                  pingResult.data?.status === 'success' || pingResult.status === 'success' && !pingResult.data?.error
                    ? 'bg-[#aceecf]/20 border-[#296c00] text-[#07513b]'
                    : 'bg-[#fff8f6] border-[#ffb4ab] text-[#410002]'
                }`}
              >
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-current/20">
                  <span className="font-bold font-label-caps uppercase">
                    Status: {pingResult.data?.status?.toUpperCase() || pingResult.status?.toUpperCase()} (HTTP {pingResult.proxyStatus || 200})
                  </span>
                  {pingResult.data?.status === 'success' && (
                    <span className="font-bold text-[#296c00] flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Web App Online & Ready
                    </span>
                  )}
                </div>
                
                <pre className="text-[11px] font-mono leading-relaxed">{JSON.stringify(pingResult.data || pingResult, null, 2)}</pre>

                {pingResult.data?.error?.includes('Unknown action requested') && (
                  <div className="mt-3 pt-3 border-t border-[#ffb4ab] text-xs font-body-md space-y-1">
                    <p className="font-bold text-[#ba1a1a]">
                      💡 Quick Fix to update your Apps Script Web App:
                    </p>
                    <p className="text-[#410002]">
                      Your Google Apps Script Web App is connected and responding! However, your deployed script in Google Drive is running a previous version of <code className="bg-[#ffdad6] px-1 rounded font-mono font-bold">Code.gs</code>.
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-[#410002] font-semibold mt-1">
                      <li>Go to Tab 1 (<strong>📄 Google Apps Script Code</strong>) and click <strong>Copy Clean Code.gs</strong></li>
                      <li>In <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-[#ba1a1a]">script.google.com</a>, replace all contents of <code className="bg-[#ffdad6] px-1 rounded font-mono">Code.gs</code> and click 💾 Save</li>
                      <li>Click <strong>Deploy → Manage deployments → Edit ✏️ → New version</strong>, then click <strong>Deploy</strong></li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Upload Tester */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drive Media File Upload Tool */}
            <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#296c00]">cloud_upload</span>
                <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                  Upload Media File (Drive / Server)
                </h3>
              </div>
              <p className="font-body-md text-xs text-[#707a67]">
                Upload an image or asset file to verify Google Drive folder creation or Express local storage:
              </p>

              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.svg,.gif"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#404a39] file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-label-caps file:font-bold file:bg-[#efeeea] file:text-[#296c00] hover:file:bg-[#296c00] hover:file:text-white file:transition-all cursor-pointer"
                />

                {uploadFile && (
                  <div className="text-xs font-label-caps text-[#404a39] bg-[#faf9f5] p-2 border border-[#bfcab4] rounded flex justify-between">
                    <span className="truncate">{uploadFile.name}</span>
                    <span>{(uploadFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}

                <button
                  onClick={handleTestFileUpload}
                  disabled={uploading || !uploadFile}
                  className="w-full bg-[#296c00] text-white font-label-caps text-xs font-bold py-3 rounded shadow-xs hover:bg-[#1f5700] disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {uploading
                    ? 'Uploading File to Drive...'
                    : scriptUrl
                    ? 'Upload Directly to Google Drive'
                    : 'Upload to Express Node Server'}
                </button>
              </div>

              {uploadResult && (
                <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded text-xs space-y-2">
                  <p className="font-label-caps text-[10px] font-bold text-[#296c00]">
                    UPLOAD RESULT
                  </p>
                  <pre className="font-code-sm text-[11px] overflow-x-auto text-[#1b1c1a]">
                    {JSON.stringify(uploadResult, null, 2)}
                  </pre>
                  {(uploadResult?.data?.url || uploadResult?.url) && (
                    <div className="pt-2 border-t border-[#bfcab4]">
                      <a
                        href={uploadResult?.data?.url || uploadResult?.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#296c00] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open Uploaded Asset</span>
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export Posts to Google Sheets Tool — manual snapshot only, never auto-synced */}
            <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#296c00]">table_view</span>
                <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                  Export snapshot to Google Sheets
                </h3>
              </div>
              <p className="font-body-md text-xs text-[#707a67]">
                One-way backup. Writes the current {posts.length} posts to a Sheet titled "Pharmacozyme Content Schedule" —
                it does not run automatically, and edits made in the Sheet are never read back into this app.
              </p>

              <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded text-xs space-y-1">
                <div className="flex justify-between font-label-caps">
                  <span className="text-[#707a67]">Total posts:</span>
                  <span className="font-bold text-[#1b1c1a]">{posts.length}</span>
                </div>
                <div className="flex justify-between font-label-caps">
                  <span className="text-[#707a67]">Approved:</span>
                  <span className="font-bold text-[#296c00]">
                    {posts.filter((p) => p.approved).length}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSyncToSheets}
                disabled={syncingSheets || !scriptUrl}
                className="w-full bg-[#296c00] text-white font-label-caps text-xs font-bold py-3 rounded shadow-xs hover:bg-[#1f5700] disabled:opacity-50 transition-all min-h-[44px]"
              >
                {syncingSheets ? 'Exporting…' : 'Export snapshot now'}
              </button>

              {syncResult && (
                <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded text-xs space-y-2">
                  <p className="font-label-caps text-[10px] font-bold text-[#296c00]">
                    EXPORT RESULT
                  </p>
                  <pre className="font-code-sm text-[11px] overflow-x-auto text-[#1b1c1a]">
                    {JSON.stringify(syncResult, null, 2)}
                  </pre>
                  {syncResult?.data?.spreadsheetUrl && (
                    <a
                      href={syncResult.data.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#296c00] font-bold hover:underline inline-flex items-center gap-1 mt-1 block"
                    >
                      <span>Open Google Sheets Spreadsheet</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GUIDE */}
      {activeTab === 'guide' && (
        <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs space-y-6">
          <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a] border-b border-[#bfcab4] pb-2">
            Step-by-Step Google Apps Script Deployment Guide
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded-lg space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#296c00] text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h4 className="font-headline-md text-sm font-bold text-[#1b1c1a]">
                Open Apps Script
              </h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Navigate to{' '}
                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#296c00] underline font-bold"
                >
                  script.google.com
                </a>{' '}
                and click <strong>+ New Project</strong>.
              </p>
            </div>

            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded-lg space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#296c00] text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h4 className="font-headline-md text-sm font-bold text-[#1b1c1a]">
                Paste Script Code
              </h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Copy the contents of <code className="text-[#296c00]">Code.gs</code> using the button in Tab 1 and paste it over the editor content. Save with Ctrl+S.
              </p>
            </div>

            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded-lg space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#296c00] text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h4 className="font-headline-md text-sm font-bold text-[#1b1c1a]">
                Authorize & Deploy
              </h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Select <code className="text-[#296c00]">doGet</code> in top dropdown, click <strong>Run</strong> and click <strong>Review permissions → Allow</strong>. Then click <strong>Deploy → New deployment</strong> (Web app, Execute as: <em>Me</em>, Who has access: <em>Anyone</em>).
              </p>
            </div>

            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded-lg space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#296c00] text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <h4 className="font-headline-md text-sm font-bold text-[#1b1c1a]">
                Connect & Test
              </h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Copy your Web App URL into Tab 2 ("Live Web App & Upload Tester") to verify connection, test Drive uploads, and send real Email Reminders!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BACKEND */}
      {activeTab === 'backend' && (
        <div className="bg-white border border-[#bfcab4] p-4 sm:p-6 rounded-lg shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#bfcab4] pb-3">
            <div>
              <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
                Express Node.js Full-Stack Backend Details
              </h2>
              <p className="font-body-md text-xs text-[#707a67]">
                Running server-side proxy API routes on Port 3000
              </p>
            </div>
            <span className="px-3 py-1 bg-[#aceecf] text-[#07513b] font-label-caps text-xs font-bold rounded">
              ● Active on Port 3000
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
              <span className="font-label-caps text-[10px] text-[#296c00] font-bold">ENDPOINT</span>
              <h4 className="font-code-sm text-xs font-bold text-[#1b1c1a]">GET /api/health</h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Verifies server uptime, status, and system timestamps.
              </p>
            </div>

            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
              <span className="font-label-caps text-[10px] text-[#296c00] font-bold">ENDPOINT</span>
              <h4 className="font-code-sm text-xs font-bold text-[#1b1c1a]">POST /api/upload</h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Receives base64 asset payloads and returns server file object URL.
              </p>
            </div>

            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
              <span className="font-label-caps text-[10px] text-[#296c00] font-bold">ENDPOINT</span>
              <h4 className="font-code-sm text-xs font-bold text-[#1b1c1a]">POST /api/appscript/proxy</h4>
              <p className="font-body-md text-xs text-[#707a67]">
                Relays POST uploads to Google Apps Script Web App without CORS errors.
              </p>
            </div>
          </div>

          {serverHealth && (
            <div className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
              <span className="font-label-caps text-[10px] font-bold text-[#296c00]">
                SERVER HEALTH PAYLOAD
              </span>
              <pre className="font-code-sm text-xs text-[#1b1c1a] overflow-x-auto">
                {JSON.stringify(serverHealth, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
