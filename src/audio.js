export const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
]);
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 120;

export function inspectVoiceFile(file) {
  if (!SUPPORTED_AUDIO_TYPES.has(file.type)) {
    return Promise.reject(new Error('Choose an MP3, M4A, OGG, WAV or WebM voice note.'));
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return Promise.reject(new Error('Voice notes must be 2 MB or smaller.'));
  }

  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    let settled = false;

    function finish(error, duration) {
      if (settled) return;
      settled = true;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(duration);
    }

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (!Number.isFinite(audio.duration)) {
        finish(new Error('Unable to read the voice note duration.'));
      } else if (audio.duration > MAX_AUDIO_SECONDS) {
        finish(new Error('Voice notes must be 2 minutes or shorter.'));
      } else {
        finish(null, Math.floor(audio.duration));
      }
    };
    audio.onerror = () => finish(new Error('This audio file could not be opened. Try another recording.'));
    audio.src = url;
  });
}
