// Uploads a picked video or picture in small pieces (4 MB), with progress.
// Large phone videos over mobile data can take minutes; one big request can be
// cut off, so each piece is its own short request and is retried if the
// connection drops. The server checks the finished file (type, 200 MB limit).

import { Platform } from 'react-native';
import { api, API_URL, ApiError, authHeader } from './api';

export const MAX_UPLOAD_MB = 200;

export interface PickedFile { uri: string; fileName?: string | null; mimeType?: string; fileSize?: number; file?: File }

/** Sends one piece; resolves when the server has stored it. */
function sendPiece(url: string, piece: Blob, onSent: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(authHeader())) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status}).`;
      let code: string | undefined;
      try { const d = JSON.parse(xhr.responseText); msg = d.error ?? msg; code = d.code; } catch { /* not JSON */ }
      reject(new ApiError(xhr.status, msg, code));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'network'));
    xhr.ontimeout = () => reject(new ApiError(0, 'timeout', 'network'));
    xhr.send(piece);
  });
}

/**
 * Uploads the file and returns its web address.
 * onProgress gets 0…1 while the file is sent.
 */
export async function uploadInPieces(file: PickedFile, kind: 'workouts' | 'foods', onProgress?: (share: number) => void): Promise<string> {
  // The whole file as a Blob (on phones this stays in native memory, not in JavaScript).
  const blob: Blob = Platform.OS === 'web' && file.file ? file.file : await (await fetch(file.uri)).blob();
  const size = blob.size || file.fileSize || 0;
  if (size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new ApiError(413, `This file is ${Math.round(size / 1024 / 1024)} MB. The limit is ${MAX_UPLOAD_MB} MB — trim the video, or upload it to YouTube and paste the link.`, 'file_too_large');
  }

  const { uploadId, chunkSize } = await api.post<{ uploadId: string; chunkSize: number }>('/api/uploads/chunked/start', { kind, size });
  onProgress?.(0);
  for (let offset = 0; offset < size; offset += chunkSize) {
    const piece = blob.slice(offset, Math.min(offset + chunkSize, size));
    const url = `${API_URL}/api/uploads/chunked/${uploadId}?offset=${offset}`;
    // Up to 4 tries per piece, waiting a little longer each time (weak signal, switching networks…).
    for (let attempt = 1; ; attempt++) {
      try {
        await sendPiece(url, piece, (sent) => onProgress?.(Math.min(1, (offset + sent) / size)));
        break;
      } catch (e) {
        const network = e instanceof ApiError && e.code === 'network';
        if (!network || attempt >= 4) {
          if (network) {
            throw new ApiError(0, 'The upload stopped because the internet connection dropped. Please try again on a stronger connection (Wi-Fi is best).', 'network');
          }
          throw e;
        }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  onProgress?.(1);
  return (await api.post<{ url: string }>(`/api/uploads/chunked/${uploadId}/finish`)).url;
}
