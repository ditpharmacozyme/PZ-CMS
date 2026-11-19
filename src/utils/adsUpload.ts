import type { AdFile } from '../types';
import { createUploadSession, finalizeFile } from './adsDrive';

const UPLOAD_ERROR = 'Upload failed — check your connection and try again';

function putFile(
  url: string,
  file: File,
  mimeType: string,
  onProgress?: (fraction: number) => void,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    const fail = () => reject(new Error(UPLOAD_ERROR));
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return fail();
      // The body may be unreadable (CORS) or empty; treat that as "no id".
      let id: string | null = null;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed && typeof parsed.id === 'string' && parsed.id) id = parsed.id;
      } catch {
        id = null;
      }
      resolve(id);
    };
    xhr.send(file);
  });
}

export async function uploadToDrive(
  file: File,
  folderId: string,
  onProgress?: (fraction: number) => void,
): Promise<AdFile> {
  const mimeType = file.type || 'application/octet-stream';
  const sessionUrl = await createUploadSession({ folderId, fileName: file.name, mimeType });
  const fileId = await putFile(sessionUrl, file, mimeType, onProgress);
  return finalizeFile(fileId ? { folderId, fileName: file.name, fileId } : { folderId, fileName: file.name });
}
