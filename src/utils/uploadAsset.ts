import { supabase } from '../lib/supabase';

export const ASSET_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_TYPES = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^application\/vnd\.ms-/,
  /^text\/plain$/,
];

export class AssetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetUploadError';
  }
}

export function humanFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function safeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  return `${stem || 'file'}${ext}`;
}

export async function uploadAsset(
  file: File,
  folder: 'assets' | 'logos'
): Promise<{ url: string; storagePath: string; size: string; contentType: string }> {
  if (!ALLOWED_TYPES.some((re) => re.test(file.type))) {
    throw new AssetUploadError(`"${file.name}" is a ${file.type || 'unknown'} file — upload an image, PDF, or document.`);
  }
  if (file.size > ASSET_UPLOAD_MAX_BYTES) {
    throw new AssetUploadError(`"${file.name}" is ${humanFileSize(file.size)} — the limit is 50 MB.`);
  }
  if (!supabase) throw new AssetUploadError('Supabase is not configured.');

  const storagePath = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: false });
  if (error) throw new AssetUploadError(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from('brand-assets').getPublicUrl(storagePath);
  return { url: data.publicUrl, storagePath, size: humanFileSize(file.size), contentType: file.type };
}
