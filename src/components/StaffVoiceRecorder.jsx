import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

const MAX_RECORDING_BYTES = 2 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 120;
const RECORDING_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'];

function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function blobAsDataUrl(blob, contentType) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result.replace(/^data:[^;]+/, `data:${contentType}`))
      : reject(new Error('Unable to read the voice recording.'));
    reader.onerror = () => reject(new Error('Unable to read the voice recording.'));
    reader.readAsDataURL(blob);
  });
}

export default function StaffVoiceRecorder({ onRecordingComplete, disabled = false }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const durationTimerRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const exceededSizeRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearInterval(durationTimerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    setError('');
    setDuration(0);
    elapsedSecondsRef.current = 0;
    chunksRef.current = [];
    exceededSizeRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser. You can upload an audio file instead.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setError('This browser cannot record a supported audio format. Upload an audio file instead.');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        const totalBytes = chunksRef.current.reduce((total, chunk) => total + chunk.size, 0) + event.data.size;
        if (totalBytes > MAX_RECORDING_BYTES) {
          exceededSizeRef.current = true;
          setError('Recordings must be 2 MB or smaller. Please record a shorter voice note.');
          if (recorder.state === 'recording') recorder.stop();
          return;
        }
        chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        window.clearInterval(durationTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (mountedRef.current) setRecording(false);
        if (exceededSizeRef.current || !chunksRef.current.length) return;

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const recordingData = await blobAsDataUrl(blob, mimeType);
          if (mountedRef.current) onRecordingComplete(recordingData);
        } catch (recordingError) {
          if (mountedRef.current) {
            setError(recordingError instanceof Error ? recordingError.message : 'Unable to prepare the voice recording.');
          }
        }
      };
      recorder.start(1000);
      setRecording(true);
      durationTimerRef.current = window.setInterval(() => {
        elapsedSecondsRef.current += 1;
        setDuration(elapsedSecondsRef.current);
        if (elapsedSecondsRef.current >= MAX_RECORDING_SECONDS && recorder.state === 'recording') recorder.stop();
      }, 1000);
    } catch (recordingError) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(recordingError instanceof Error && recordingError.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow microphone access or upload an audio file.'
        : 'Unable to start recording. Check that a microphone is available, or upload an audio file.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => (recording ? stopRecording() : void startRecording())}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${recording ? 'bg-red-50 text-red-700' : 'border border-green/25 text-green hover:bg-green/5'}`}
      >
        {recording ? <><Square size={13} fill="currentColor"/> Stop recording · {formatDuration(duration)}</> : <><Mic size={14}/> Record voice note</>}
      </button>
      {error && <p role="status" className="mt-2 text-[10px] leading-4 text-red-700">{error}</p>}
      {recording && <p className="mt-1 text-[10px] text-brown/50">Maximum 2 minutes and 2 MB. Keep this page open while recording.</p>}
    </div>
  );
}
