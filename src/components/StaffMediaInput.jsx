import { useId, useState } from 'react';
import { resolveMediaUrl, staffUploadMedia } from '../api';

const MEDIA_OPTIONS = {
  image: {
    accept: 'image/jpeg,image/png,image/webp',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 MB',
  },
  video: {
    accept: 'video/mp4,video/webm',
    maxBytes: 30 * 1024 * 1024,
    maxLabel: '30 MB',
  },
  audio: {
    accept: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/x-wav',
    maxBytes: 2 * 1024 * 1024,
    maxLabel: '2 MB',
  },
};

function mediaPreviewUrl(value) {
  if (value.startsWith('/api/media/')) return resolveMediaUrl(value);
  return new URL(value, window.location.origin).toString();
}

export default function StaffMediaInput({
  token,
  label,
  value = '',
  onChange,
  mediaKind = 'image',
  expectedContentType,
  required = false,
  disabled = false,
  onUploadStateChange,
  previewClassName = 'mt-3 max-h-40 w-full rounded-lg object-cover',
}) {
  const inputId = useId();
  const options = MEDIA_OPTIONS[mediaKind];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > options.maxBytes) {
      setError(`${mediaKind[0].toUpperCase()}${mediaKind.slice(1)} files must be ${options.maxLabel} or smaller.`);
      return;
    }
    if (expectedContentType && file.type !== expectedContentType) {
      setError(`Choose a ${expectedContentType} file for this field.`);
      return;
    }

    setError('');
    setUploading(true);
    onUploadStateChange?.(true);
    try {
      const uploaded = await staffUploadMedia(file, mediaKind, token, expectedContentType);
      onChange(uploaded.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload this file.');
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  }

  const previewUrl = value ? mediaPreviewUrl(value) : '';

  return (
    <div className="block min-w-0 text-xs font-bold">
      <label htmlFor={`${inputId}-url`}>{label}</label>
      <p className="mt-1 text-[10px] font-normal leading-4 text-brown/55">
        Paste an HTTPS URL or upload a file ({mediaKind === 'image' ? 'JPG, PNG or WebP' : mediaKind === 'video' ? 'MP4 or WebM' : 'MP3, M4A, OGG, WAV or WebM'}; up to {options.maxLabel}).
      </p>
      <input
        id={`${inputId}-file`}
        type="file"
        accept={expectedContentType || options.accept}
        disabled={disabled || uploading}
        onChange={(event) => void uploadFile(event)}
        className="mt-2 block w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-green/10 file:px-2 file:py-1.5 file:font-bold file:text-green disabled:opacity-40"
      />
      <label htmlFor={`${inputId}-url`} className="sr-only">{label} URL</label>
      <input
        id={`${inputId}-url`}
        type="text"
        inputMode="url"
        autoComplete="url"
        value={value}
        onChange={(event) => {
          setError('');
          onChange(event.target.value);
        }}
        placeholder="https://example.com/media"
        maxLength={1000}
        required={required}
        disabled={disabled || uploading}
        className="mt-2 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-xs font-normal outline-none focus:border-green disabled:opacity-50"
      />
      {uploading && <p role="status" className="mt-2 text-[10px] font-normal text-green">Uploading media…</p>}
      {error && <p role="alert" className="mt-2 text-[10px] font-normal text-red-700">{error}</p>}
      {previewUrl && (
        <div className="mt-2 space-y-2">
          {mediaKind === 'image' && <img src={previewUrl} alt={`${label} preview`} className={previewClassName}/>}
          {mediaKind === 'video' && <video controls preload="metadata" className={previewClassName} src={previewUrl}>Your browser does not support video playback.</video>}
          {mediaKind === 'audio' && <audio controls preload="metadata" className="mt-1 h-10 w-full" src={previewUrl}>Your browser does not support audio playback.</audio>}
          <button type="button" disabled={disabled || uploading} onClick={() => { setError(''); onChange(''); }} className="text-[10px] font-bold text-red-700 disabled:opacity-40">Remove media</button>
        </div>
      )}
    </div>
  );
}
