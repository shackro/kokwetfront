import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink, LoaderCircle, Maximize2, MessageCircle, Mic, Pause, Play, Radio, Send, Smile, Square, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getJson, postForm, postJson, resolveApiUrl } from '../api';
import { realtimeEnabled, supabaseSchema } from '../lib/supabaseConfig';

const REFRESH_MS = 3000;
const REALTIME_REFRESH_MS = 30000;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 120;
const ANDROID_COMPANION_PACKAGE = 'com.kokwet.voicecircle';
const ANDROID_COMPANION_STORE_URL = import.meta.env.VITE_ANDROID_COMPANION_STORE_URL || '';
const ACTIVE_TAGS = ['MentalHealth', 'YouthAction', 'Festival2026'];
const SENDER_COLORS = ['#de7115', '#0a5a1e', '#a64e0c', '#8c410a', '#627a35', '#c17a13', '#75532e'];
const VOICE_WAVEFORM = [35, 54, 75, 43, 88, 62, 38, 70, 95, 55, 78, 42, 64, 90, 48, 73, 34, 58, 84, 45, 68, 96, 51, 76];

function senderColor(name) {
  const hash = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function realtimeMessage(row) {
  if (
    !row
    || typeof row.message_id !== 'string'
    || !['topic', 'public'].includes(row.channel)
    || typeof row.author_name !== 'string'
    || !['text', 'voice', 'tag'].includes(row.message_type)
    || typeof row.message_text !== 'string'
    || typeof row.created_at !== 'string'
    || (row.channel === 'topic' && typeof row.session_id !== 'string')
  ) {
    return null;
  }
  return {
    message_id: row.message_id,
    session_id: row.session_id ?? null,
    channel: row.channel,
    author_name: row.author_name,
    message_text: typeof row.message_text === 'string' ? row.message_text : '',
    message_type: row.message_type,
    tag_name: row.tag_name ?? null,
    audio_url: row.message_type === 'voice'
      ? `/api/v1/live/messages/${encodeURIComponent(row.message_id)}/audio`
      : null,
    created_at: row.created_at,
  };
}

function VoiceMessage({ src, own }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackError, setPlaybackError] = useState('');

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setPlaybackError('');
      void audio.play().catch(() => setPlaybackError('Unable to play this voice note.'));
    }
    else audio.pause();
  }

  return (
    <div className="flex min-w-[150px] items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setPlaybackError('');
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onError={() => setPlaybackError('Unable to load this voice note.')}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        type="button"
        onClick={() => void togglePlayback()}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-white transition hover:bg-orange/85"
      >
        {playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor" className="translate-x-px"/>}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
          {VOICE_WAVEFORM.map((height, index) => {
            const progress = duration ? currentTime / duration : 0;
            const active = index / VOICE_WAVEFORM.length <= progress;
            return (
              <span
                key={index}
                className={`w-[2px] shrink-0 rounded-full ${active ? 'bg-gold' : own ? 'bg-white/55' : 'bg-brown/25'}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] ${own ? 'text-white/60' : 'text-brown/50'}`}>
          {formatAudioTime(playing ? currentTime : duration)}
        </span>
        {playbackError && <span role="status" className={`block text-[9px] ${own ? 'text-red-200' : 'text-red-700'}`}>{playbackError}</span>}
      </div>
    </div>
  );
}

function messageDateLabel(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'TODAY';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).toUpperCase();
}

export default function LiveCompanionPage({ embedded = false }) {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedSessionId = sessionId || searchParams.get('session_id');
  const storyContext = (searchParams.get('story') || '').trim().slice(0, 160);
  const shouldOpenChat = embedded && (searchParams.get('open_chat') === '1' || Boolean(storyContext));
  const [session, setSession] = useState(null);
  const [channel, setChannel] = useState(requestedSessionId ? 'topic' : 'public');
  const [messages, setMessages] = useState([]);
  const [ownMessageIds, setOwnMessageIds] = useState(() => new Set());
  const [authorName, setAuthorName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [focusMode, setFocusMode] = useState('watch');
  const [chatOpen, setChatOpen] = useState(shouldOpenChat);
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(false);
  const [showAndroidCompanion, setShowAndroidCompanion] = useState(
    searchParams.get('companion') === 'not-installed',
  );
  const [canFloatChat, setCanFloatChat] = useState(false);
  const [floatingWindow, setFloatingWindow] = useState(null);
  const [floatingError, setFloatingError] = useState('');
  const endRef = useRef(null);
  const openChatButtonRef = useRef(null);
  const closeChatButtonRef = useRef(null);
  const floatingWindowRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  function rememberOwnMessage(message) {
    if (!message?.message_id) return;
    setOwnMessageIds((current) => new Set(current).add(message.message_id));
  }

  useEffect(() => {
    let active = true;
    async function refreshSession() {
      try {
        const data = requestedSessionId
          ? await getJson(`/v1/live/sessions/${encodeURIComponent(requestedSessionId)}`)
          : await getJson('/v1/live/current');
        if (active) {
          setSession(data.session);
          setLoadError('');
        }
      } catch (error) {
        if (active) {
          setSession(null);
          setLoadError(error instanceof Error ? error.message : 'Unable to load the live room.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void refreshSession();
    const timer = window.setInterval(() => void refreshSession(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [requestedSessionId]);

  useEffect(() => {
    setChannel(requestedSessionId ? 'topic' : 'public');
  }, [requestedSessionId]);

  useEffect(() => {
    if (shouldOpenChat) setChatOpen(true);
  }, [location.key, shouldOpenChat]);

  useEffect(() => {
    setIsAndroidBrowser(/android/i.test(navigator.userAgent));
    setCanFloatChat(
      window.isSecureContext
      && typeof window.documentPictureInPicture?.requestWindow === 'function',
    );
  }, []);

  useEffect(() => {
    if (channel === 'topic' && !session?.session_id) {
      setMessages([]);
      setRealtimeConnected(false);
      return undefined;
    }
    let active = true;
    let timer;
    const realtimeMessages = new Map();
    const removedMessageIds = new Set();

    async function refreshMessages() {
      const query = new URLSearchParams({ channel });
      if (channel === 'topic' && session?.session_id) query.set('session_id', session.session_id);
      try {
        const data = await getJson(`/v1/live/messages?${query.toString()}`);
        if (active) {
          setMessages((current) => {
            const latest = new Map(
              (Array.isArray(data.messages) ? data.messages : [])
                .map((message) => [message.message_id, message]),
            );
            for (const [messageId, message] of realtimeMessages) {
              latest.set(messageId, message);
            }
            for (const messageId of removedMessageIds) {
              latest.delete(messageId);
            }
            return [...latest.values()]
              .sort((left, right) => left.created_at.localeCompare(right.created_at))
              .slice(-50);
          });
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to refresh live messages.');
      }
    }

    function scheduleRefresh(interval) {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => void refreshMessages(), interval);
    }

    function belongsToRoom(message) {
      return message.channel === channel
        && (channel !== 'topic' || message.session_id === session?.session_id);
    }

    function addRealtimeMessage(payload) {
      const message = realtimeMessage(payload.new);
      if (!message || !belongsToRoom(message)) return;
      realtimeMessages.set(message.message_id, message);
      removedMessageIds.delete(message.message_id);
      setMessages((current) => {
        const latest = new Map(current.map((item) => [item.message_id, item]));
        latest.set(message.message_id, message);
        return [...latest.values()]
          .sort((left, right) => left.created_at.localeCompare(right.created_at))
          .slice(-50);
      });
    }

    function removeRealtimeMessage(payload) {
      const oldMessage = payload.old;
      const messageId = oldMessage?.message_id;
      if (typeof messageId !== 'string') return;
      if (oldMessage.channel && !belongsToRoom(oldMessage)) return;
      realtimeMessages.delete(messageId);
      removedMessageIds.add(messageId);
      setMessages((current) => current.filter((message) => message.message_id !== messageId));
    }

    setRealtimeConnected(false);
    void refreshMessages();
    scheduleRefresh(REFRESH_MS);
    let realtimeClient;
    let realtimeChannel;
    if (realtimeEnabled) {
      const roomFilter = channel === 'topic'
        ? `session_id=eq.${session?.session_id}`
        : 'channel=eq.public';
      void import('../lib/supabaseClient')
        .then(({ getSupabaseRealtimeClient }) => {
          if (!active) return;
          realtimeClient = getSupabaseRealtimeClient();
          if (!realtimeClient) return;
          realtimeChannel = realtimeClient
            .channel(`kokwet-live-feed-${channel}-${session?.session_id || 'public'}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: supabaseSchema,
                table: 'live_message_feed',
                filter: roomFilter,
              },
              addRealtimeMessage,
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: supabaseSchema,
                table: 'live_message_feed',
                filter: roomFilter,
              },
              addRealtimeMessage,
            )
            .on(
              'postgres_changes',
              {
                event: 'DELETE',
                schema: supabaseSchema,
                table: 'live_message_feed',
              },
              removeRealtimeMessage,
            )
            .subscribe((status) => {
              if (!active) return;
              const connected = status === 'SUBSCRIBED';
              setRealtimeConnected(connected);
              if (connected) void refreshMessages();
              scheduleRefresh(connected ? REALTIME_REFRESH_MS : REFRESH_MS);
            });
        })
        .catch(() => {
          if (!active) return;
          setRealtimeConnected(false);
          scheduleRefresh(REFRESH_MS);
        });
    }

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (realtimeChannel && realtimeClient) {
        void realtimeClient.removeChannel(realtimeChannel);
      }
    };
  }, [channel, session?.session_id]);

  const latestMessageId = messages[messages.length - 1]?.message_id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [latestMessageId, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeChatButtonRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setChatOpen(false);
        window.requestAnimationFrame(() => openChatButtonRef.current?.focus());
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [chatOpen]);

  useEffect(() => {
    if (!floatingWindow) return undefined;
    function closeFloatingChatOnEscape(event) {
      if (event.key === 'Escape') {
        setChatOpen(false);
        floatingWindow.close();
      }
    }
    floatingWindow.addEventListener('keydown', closeFloatingChatOnEscape);
    return () => floatingWindow.removeEventListener('keydown', closeFloatingChatOnEscape);
  }, [floatingWindow]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    const pipWindow = floatingWindowRef.current;
    floatingWindowRef.current = null;
    if (pipWindow && !pipWindow.closed) pipWindow.close();
  }, []);

  async function sendMessage(event) {
    event.preventDefault();
    if (!authorName.trim() || !messageText.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const result = await postJson('/v1/live/messages', {
        channel,
        session_id: channel === 'topic' ? session?.session_id : null,
        author_name: authorName,
        message_text: messageText,
      });
      rememberOwnMessage(result.message);
      setMessageText('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send the message.');
    } finally {
      setSending(false);
    }
  }

  async function sendTag(tagName) {
    if (!authorName.trim()) {
      setSendError('Add a display name before sharing a topic tag.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const result = await postJson('/v1/live/messages', {
        channel,
        session_id: channel === 'topic' ? session?.session_id : null,
        author_name: authorName,
        tag_name: tagName,
      });
      rememberOwnMessage(result.message);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to share the topic tag.');
    } finally {
      setSending(false);
    }
  }

  async function sendVoiceNote(blob) {
    if (!authorName.trim()) {
      setSendError('Add a display name before recording a voice note.');
      return;
    }
    const formData = new FormData();
    formData.append('channel', channel);
    formData.append('author_name', authorName.trim());
    if (channel === 'topic' && session?.session_id) {
      formData.append('session_id', session.session_id);
    }
    const contentType = blob.type.split(';', 1)[0];
    const extension = contentType === 'audio/mp4'
      ? 'm4a'
      : contentType === 'audio/ogg'
        ? 'ogg'
        : contentType === 'audio/wav' || contentType === 'audio/x-wav'
          ? 'wav'
          : contentType === 'audio/mpeg'
            ? 'mp3'
            : 'webm';
    formData.append('audio_file', blob, `voice-note.${extension}`);
    setSending(true);
    setSendError('');
    try {
      const result = await postForm('/v1/live/messages/voice', formData);
      rememberOwnMessage(result.message);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send the voice note.');
    } finally {
      setSending(false);
    }
  }

  async function openFloatingChat() {
    if (floatingWindowRef.current) {
      floatingWindowRef.current.focus();
      return;
    }

    const pictureInPicture = window.documentPictureInPicture;
    if (!window.isSecureContext || typeof pictureInPicture?.requestWindow !== 'function') {
      setFloatingError('Floating chat is unavailable in this browser. Use a supported desktop browser, or keep the chat open on this device.');
      return;
    }

    try {
      const pipWindow = await pictureInPicture.requestWindow({ width: 400, height: 680 });
      pipWindow.document.title = 'Kokwet Voice Circle';
      pipWindow.document.documentElement.style.height = '100%';
      pipWindow.document.body.style.cssText = 'width:100%;height:100dvh;margin:0;overflow:hidden;background:#fdfcfa;';
      document.querySelectorAll('link[rel="stylesheet"],style').forEach((styleNode) => {
        pipWindow.document.head.append(styleNode.cloneNode(true));
      });
      pipWindow.addEventListener('pagehide', () => {
        floatingWindowRef.current = null;
        setFloatingWindow(null);
      }, { once: true });
      floatingWindowRef.current = pipWindow;
      setFloatingWindow(pipWindow);
      setFloatingError('');
    } catch (error) {
      setFloatingError(error instanceof Error ? error.message : 'The floating chat window could not be opened.');
    }
  }

  function openCompanionWindow() {
    const popup = window.open(
      `${window.location.origin}/culture?open_chat=1#live-lounge`,
      'kokwet-live-chat',
      'popup=yes,width=420,height=720,resizable=yes,scrollbars=yes',
    );
    if (!popup) {
      setFloatingError('The browser blocked the chat window. Allow pop-ups for this site, then try again.');
      return;
    }
    popup.focus();
    setFloatingError('');
  }

  function openAndroidCompanion() {
    const storeUrl = ANDROID_COMPANION_STORE_URL.trim();
    const fallbackUrl = storeUrl || new URL(
      '/culture?open_chat=1&companion=not-installed#live-lounge',
      window.location.origin,
    ).toString();
    const intentUrl = `intent://floating-chat?site_url=${encodeURIComponent(window.location.origin)}#Intent;scheme=kokwet;package=${ANDROID_COMPANION_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
    window.location.href = intentUrl;
  }

  function openChatExperience() {
    if (isAndroidBrowser) {
      setShowAndroidCompanion(true);
      setChatOpen(false);
      return;
    }
    setChatOpen(true);
    if (canFloatChat) {
      void openFloatingChat();
    } else if (window.matchMedia('(min-width: 701px)').matches) {
      openCompanionWindow();
    } else {
      setFloatingError('Open chat before switching apps. Mobile browsers cannot place a website chat over TikTok; that requires a native Android app.');
    }
  }

  async function startRecording() {
    if (!authorName.trim()) {
      setSendError('Add a display name before recording a voice note.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setSendError('Voice recording is not supported in this browser. Try a current browser on HTTPS.');
      return;
    }
    setSendError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const supportedTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = supportedTypes.find((type) => window.MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          window.clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        const type = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
        if (blob.size > MAX_AUDIO_BYTES) {
          setSendError('Voice notes must be 2 MB or smaller. Record a shorter note and try again.');
        } else if (blob.size === 0) {
          setSendError('The recording was empty. Please try recording again.');
        } else {
          void sendVoiceNote(blob);
        }
      };
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setSendError(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow microphone access to record a voice note.'
        : 'Unable to start recording. Check your microphone and try again.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  const topicAvailable = Boolean(session?.session_id && session.is_active);
  const chatFocused = focusMode === 'chat';

  if (embedded) {
    const recentMessages = messages.slice(-8).reverse();
    const roomName = channel === 'topic' && topicAvailable ? session.topic_title : 'Public chat room';
    return (
      <section id="live-lounge" className="scroll-mt-24 bg-brown px-4 py-8 text-white sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold">
                <MessageCircle size={13}/>{topicAvailable ? 'Public room + active topic' : 'Shared public room'}
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Kokwet <span className="text-gold">Voice Circle</span></h2>
              <p className="mt-1 text-xs leading-5 text-white/65">
                {topicAvailable
                  ? `Stories, ideas, and voice notes · Hosted by ${session.creator_name}`
                  : 'Stories, ideas, and voice notes from across the Nine Houses'}
              </p>
            </div>
            {topicAvailable && session.stream_url && (
              <a href={session.stream_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-orange px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-brown">
                Watch live <ExternalLink size={13}/>
              </a>
            )}
          </header>

          <section aria-label={roomName} className="mt-4 overflow-hidden rounded-2xl bg-white text-brown shadow-lg">
            <header className="flex items-center justify-between gap-3 border-b border-brown/10 px-4 py-3 sm:px-5">
              <div>
                <h3 className="font-display text-lg font-bold">{roomName}</h3>
                <p className="mt-0.5 text-[10px] text-brown/50">{channel === 'topic' && topicAvailable ? 'Active moderator topic · messages are separate from the public room' : 'One shared room for everyone · choose the active moderator topic inside'}</p>
              </div>
              <span className="shrink-0 rounded-full bg-green/10 px-2.5 py-1 text-[10px] font-bold text-green">
                {loading ? 'Loading' : `${recentMessages.length} recent`}
              </span>
            </header>

            {loading ? (
              <p role="status" className="flex items-center gap-2 px-4 py-5 text-xs text-brown/55">
                <LoaderCircle size={14} className="animate-spin"/>Joining the conversation…
              </p>
            ) : recentMessages.length === 0 ? (
              <p className="px-4 py-5 text-xs text-brown/55">Be the first to share something useful.</p>
            ) : (
              <div className="divide-y divide-brown/5">
                {recentMessages.map((item) => {
                  const activity = item.message_type === 'voice'
                    ? 'Sent a voice note'
                    : item.message_type === 'tag'
                      ? `Shared #${item.tag_name}`
                      : item.message_text;
                  return (
                    <article key={item.message_id} className="flex min-w-0 items-center gap-3 px-3 py-2 sm:px-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 text-xs font-black uppercase text-green">
                        {item.author_name.trim().charAt(0) || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-xs font-bold">{item.author_name}</strong>
                          <time className="shrink-0 text-[9px] text-brown/40">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </time>
                        </div>
                        <p className="truncate text-xs text-brown/60">{activity || 'Shared a message'}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="border-t border-brown/10 p-3 sm:px-4">
              <button
                ref={openChatButtonRef}
                type="button"
                onClick={openChatExperience}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-xs font-bold text-white transition hover:bg-green/90"
              >
                {canFloatChat ? 'Open chat & float' : 'Open chat'} <ArrowRight size={15}/>
              </button>
              <p className="mt-2 text-center text-[10px] leading-4 text-brown/50">
                {canFloatChat
                  ? 'Start floating chat here before switching to TikTok. The browser keeps it on top while you watch.'
                  : 'Desktop opens a resizable chat window. Mobile browsers cannot overlay TikTok; use split-screen or a native Android app.'}
              </p>
            </div>
            {embedded && isAndroidBrowser && (
              <button
                type="button"
                onClick={() => setShowAndroidCompanion(true)}
                className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-green px-4 py-3 text-xs font-bold text-white shadow-xl"
              >
                <Maximize2 size={15}/>Float chat over apps
              </button>
            )}

            {embedded && showAndroidCompanion && (
              <div className="fixed inset-0 z-[120] grid place-items-center bg-brown/75 p-4 backdrop-blur-sm">
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="android-companion-title"
                  className="w-full max-w-md rounded-2xl bg-offwhite p-6 text-brown shadow-2xl sm:p-8"
                >
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-green/10 text-green"><Maximize2 size={22}/></div>
                  <h2 id="android-companion-title" className="font-display text-2xl font-bold">Keep chat above TikTok</h2>
                  <p className="mt-3 text-sm leading-6 text-brown/65">
                    Android requires the Kokwet companion app and your approval for “Display over other apps.” Start the chat here, then switch to TikTok. You can move, resize, or minimize the floating chat.
                  </p>
                  {!ANDROID_COMPANION_STORE_URL && (
                    <p className="mt-3 rounded-lg bg-orange/10 p-3 text-xs leading-5 text-brown/75">
                      The companion is not published on Google Play yet. If you already installed a test build, you can open it below. Otherwise, keep using chat here until the official app is released.
                    </p>
                  )}
                  {ANDROID_COMPANION_STORE_URL && (
                    <a
                      href={ANDROID_COMPANION_STORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex min-h-11 items-center justify-center rounded-xl border border-green px-4 py-3 text-xs font-bold text-green"
                    >
                      Get the Android companion
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={openAndroidCompanion}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-green px-4 py-3 text-xs font-bold text-white"
                  >
                    Open installed companion
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAndroidCompanion(false);
                      setChatOpen(true);
                    }}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-brown px-4 py-3 text-xs font-bold text-white"
                  >
                    Continue in this browser
                  </button>
                </section>
              </div>
            )}
          </section>
        </div>

        {chatOpen && (() => {
          const dialog = (
          <div className={`fixed inset-0 z-[100] flex items-center justify-center ${floatingWindow ? 'bg-offwhite p-0' : 'bg-brown/65 p-0 backdrop-blur-sm sm:p-5'}`}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="live-chat-dialog-title"
              className={`flex w-full flex-col overflow-hidden bg-offwhite text-brown shadow-2xl ${floatingWindow ? 'h-full max-w-none rounded-none' : 'h-[100dvh] sm:h-[min(90dvh,52rem)] sm:max-w-3xl sm:rounded-2xl'}`}
            >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-brown px-4 py-2 text-white sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-orange/35 bg-green/20 text-gold">
                  <MessageCircle size={18}/>
                  <Mic size={10} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-orange p-0.5 text-white"/>
                </span>
                <div className="min-w-0">
                  <h2 id="live-chat-dialog-title" className="font-display text-base font-bold">
                  Voice Circle
                  </h2>
                <p className="max-w-[42vw] truncate text-[9px] text-white/60">{channel === 'topic' && topicAvailable ? `${session.topic_title} · ${session.creator_name}` : storyContext ? `Public chat · Discussing: ${storyContext}` : 'Public chat · Open to all Nine Houses'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {topicAvailable && <span className="inline-flex items-center gap-1.5 rounded-full border border-green/30 bg-green/20 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-green-100">{session.stream_url ? 'Live' : 'Room open'}</span>}
                {floatingWindow ? (
                  <span className="hidden text-[9px] font-bold text-white/60 sm:inline">Move or resize this window with your browser</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openFloatingChat()}
                    disabled={!canFloatChat}
                    title={canFloatChat ? 'Open a movable chat window' : 'Floating chat requires a supported desktop browser'}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[10px] font-bold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Maximize2 size={13}/>Float chat
                  </button>
                )}
                <button ref={closeChatButtonRef} type="button" onClick={() => {
                  setChatOpen(false);
                  floatingWindowRef.current?.close();
                  window.requestAnimationFrame(() => openChatButtonRef.current?.focus());
                }} aria-label="Close conversation" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:bg-white/10">
                  <X size={18}/>
                </button>
              </div>
            </header>
            {floatingError && (
              <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                <p>{floatingError}</p>
                <button type="button" onClick={openCompanionWindow} className="mt-2 rounded-md bg-brown px-3 py-2 font-bold text-white">
                  Open resizable chat window
                </button>
                <p className="mt-1 text-[10px] text-red-800/75">If the browser blocks it, allow pop-ups for Kokwet. This fallback is a separate window, not always-on-top.</p>
              </div>
            )}
            {!canFloatChat && <p className="shrink-0 border-b border-brown/10 bg-[#f5f0e7] px-4 py-2 text-[10px] leading-4 text-brown/60">Floating chat is supported in compatible desktop browsers. Mobile cross-app overlays need a native Android companion.</p>}

            <nav aria-label="Choose a conversation room" className="flex shrink-0 gap-2 border-b border-brown/10 bg-[#f5f0e7] px-4 py-1.5">
                {topicAvailable && (
                <button type="button" onClick={() => setChannel('topic')} disabled={sending || isRecording} aria-pressed={channel === 'topic'} className={`max-w-[65%] truncate rounded-full border px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${channel === 'topic' ? 'border-orange bg-orange/10 text-orange' : 'border-brown/10 text-brown/55'}`}>
                  {session.topic_title}
                  </button>
                )}
              <button type="button" onClick={() => setChannel('public')} disabled={sending || isRecording} aria-pressed={channel === 'public'} className={`rounded-full border px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${channel === 'public' ? 'border-green bg-green/10 text-green' : 'border-brown/10 text-brown/55'}`}>
                  Public lounge
                </button>
              </nav>
              <p role="status" className="shrink-0 border-b border-brown/10 bg-white px-4 py-1.5 text-[10px] text-brown/55">
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${realtimeConnected ? 'bg-green' : 'bg-orange'}`}/>
                {realtimeConnected
                  ? 'Live updates connected'
                  : realtimeEnabled
                    ? 'Reconnecting; messages refresh automatically'
                    : 'Messages refresh automatically'}
              </p>

            <form onSubmit={sendMessage} className="shrink-0 space-y-1.5 border-b border-brown/10 bg-white px-3 py-2 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <label htmlFor="live-chat-author" className="sr-only">Display name</label>
                <input
                  id="live-chat-author"
                  required
                  minLength={2}
                  maxLength={40}
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                  placeholder="Your display name"
                  className="min-w-[5rem] flex-1 rounded-lg border border-brown/10 bg-offwhite px-2 py-1.5 text-xs text-brown outline-none placeholder:text-brown/40 focus:border-green"
                />
                <div className="flex min-w-0 flex-1 flex-nowrap justify-end gap-1 overflow-x-auto" aria-label="Conversation topics">
                    {ACTIVE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)}
                        onClick={() => void sendTag(tag)}
                        className="shrink-0 rounded-md border border-brown/10 px-1.5 py-0.5 text-[9px] font-bold text-brown/70 transition hover:border-orange hover:text-orange disabled:opacity-40"
                      >
                        #{tag}
                      </button>
                    ))}
                </div>
              </div>
                  <div className="flex items-center gap-2 rounded-full border border-brown/15 bg-offwhite p-1.5 focus-within:border-green focus-within:ring-2 focus-within:ring-green/10">
                  <label htmlFor="live-chat-message" className="sr-only">Write a message</label>
                  <input
                    id="live-chat-message"
                    required
                    maxLength={500}
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)}
                    placeholder={isRecording ? 'Recording voice note…' : storyContext && channel === 'public' ? `Message about ${storyContext}` : 'Type a message'}
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-brown outline-none placeholder:text-brown/45 disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setMessageText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}😊`)} disabled={sending || (channel === 'topic' && !topicAvailable)} aria-label="Add a smile emoji" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-brown/60 hover:text-orange disabled:opacity-40">
                    <Smile size={19}/>
                  </button>
                  <button type="button" onClick={isRecording ? stopRecording : () => void startRecording()} disabled={sending || (channel === 'topic' && !topicAvailable)} aria-label={isRecording ? 'Stop recording' : 'Record a voice note'} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs text-white transition disabled:opacity-50 ${isRecording ? 'animate-pulse bg-red-600 shadow-lg shadow-red-500/30' : 'bg-orange hover:bg-orange/85'}`}>
                    {isRecording ? <Square size={15}/> : <Mic size={16}/>}
                  </button>
                  <button type="submit" disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green text-white disabled:opacity-50">
                    {sending ? <LoaderCircle size={15} className="animate-spin"/> : <Send size={15}/>}
                  </button>
                </div>
                {sendError && <p role="alert" className="px-2 text-xs text-red-700">{sendError}</p>}
                {loadError && session && <p role="status" className="px-2 text-xs text-orange">{loadError}</p>}
              </form>

              <div className="live-chat-wallpaper min-h-0 flex-1 space-y-0 overflow-y-auto px-3 py-2 sm:p-4" aria-live="polite">
                {loading && <p role="status" className="inline-flex items-center gap-2 text-xs text-brown/55"><LoaderCircle size={14} className="animate-spin"/>Joining the conversation…</p>}
                {!loading && messages.length === 0 && (
                  <div className="mx-auto my-4 max-w-md rounded-xl border border-orange/20 bg-white/80 p-4 text-center shadow-sm">
                    <p className="text-sm italic text-brown/80">“Welcome to the circle. Share a story, an idea, or a voice note—every voice has a place here.”</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-orange">— Kokwet Voice Circle</p>
                  </div>
                )}
                {!loading && messages.map((item, index, chronologicalMessages) => {
                  const own = ownMessageIds.has(item.message_id);
                  const previous = chronologicalMessages[index - 1];
                  const isNewSender = !previous || previous.author_name !== item.author_name || ownMessageIds.has(previous.message_id) !== own;
                  const isNewDate = !previous || new Date(previous.created_at).toDateString() !== new Date(item.created_at).toDateString();
                  const color = own ? '#f69b10' : senderColor(item.author_name);
                  return (
                    <div key={item.message_id}>
                      {isNewDate && (
                        <div className="my-2 flex justify-center">
                          <span className="rounded-full bg-brown/10 px-3 py-0.5 text-[9px] font-bold tracking-wider text-brown/65">
                            {messageDateLabel(item.created_at)}
                          </span>
                        </div>
                      )}
                      <article className={`flex items-end ${own ? 'justify-end' : 'justify-start'} ${isNewSender ? 'mt-2' : 'mt-0.5'}`}>
                        {!own && (
                          isNewSender
                            ? <span aria-hidden="true" className="mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange to-gold text-[10px] font-black uppercase text-white">{item.author_name.trim().charAt(0) || '?'}</span>
                            : <span aria-hidden="true" className="mr-1.5 w-7 shrink-0"/>
                        )}
                        <div className={`flex max-w-[84%] flex-col sm:max-w-[70%] ${own ? 'items-end' : 'items-start'}`}>
                          <div className={`min-w-0 rounded-2xl px-2.5 py-1.5 shadow-sm ${own ? 'rounded-tr-sm bg-green text-white' : 'rounded-tl-sm border border-brown/5 bg-white text-brown/90'}`}>
                            <div className="mb-0.5 flex items-center justify-between gap-3">
                              <span className="truncate text-[10px] font-bold" style={{ color: own ? '#ffffff' : color }}>
                                {isNewSender ? own ? 'You' : item.author_name : ''}
                              </span>
                              <time className={`shrink-0 text-[9px] ${own ? 'text-white/65' : 'text-brown/45'}`}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </time>
                            </div>
                            {item.quoted_text && (
                              <div className="mb-1.5 rounded border-l-2 border-orange bg-brown/5 px-2 py-1">
                                <p className="mb-0.5 text-[10px] font-bold text-orange">{item.quoted_author || 'Someone'}</p>
                                <p className="line-clamp-2 text-[10px] text-brown/65">{item.quoted_text}</p>
                              </div>
                            )}
                            {item.message_type === 'voice' && item.audio_url ? (
                              <VoiceMessage src={resolveApiUrl(item.audio_url)} own={own}/>
                            ) : item.message_type === 'tag' ? (
                              <p className="text-[13px] font-bold text-orange">#{item.tag_name || item.message_text.replace(/^#/, '')}</p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">{item.message_text}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
                <div ref={endRef}/>
              </div>
            </section>
          </div>
          );
          return floatingWindow
            ? createPortal(dialog, floatingWindow.document.body)
            : dialog;
        })()}
      </section>
    );
  }

  return (
    <section
      id={embedded ? 'live-lounge' : undefined}
      className={embedded
        ? 'scroll-mt-24 bg-brown px-4 py-8 text-white sm:px-6 sm:py-12'
        : 'min-h-[75vh] bg-offwhite px-4 py-8 text-brown sm:px-6 sm:py-12'}
    >
      <div className="mx-auto max-w-6xl">
        {!embedded && <Link to="/culture#live-lounge" className="inline-flex items-center gap-2 text-sm font-bold text-green"><ArrowLeft size={16}/>Kokwet Voice Circle</Link>}
        <header className={`${embedded ? '' : 'mt-5 bg-brown'} rounded-2xl p-5 sm:p-8`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold"><MessageCircle size={13}/>{topicAvailable ? 'Public room + active topic' : 'Shared public room'}</span>
              <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Kokwet <span className="text-orange">Voice Circle</span></h1>
              <p className="mt-2 text-sm text-white/65">
                One public room for everyone{topicAvailable ? ` · Active topic: ${session.topic_title}` : ' · Open to all Nine Houses'}
              </p>
            </div>
            {topicAvailable && session.stream_url && <a href={session.stream_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-orange px-4 py-3 text-xs font-black uppercase tracking-wider text-brown">Watch on {session.platform}<ExternalLink size={14}/></a>}
          </div>
        </header>

        <div className={`mt-5 grid gap-5 ${chatFocused ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,.65fr)]' : 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'}`}>
          <aside className={`flex flex-col gap-4 rounded-2xl border border-brown/10 bg-white p-5 text-brown sm:p-7 ${chatFocused ? 'hidden lg:flex lg:order-2' : 'lg:order-1'}`} aria-label="Live stream">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Live stream</h2>
              {topicAvailable && <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-green">{session.stream_url ? 'Live' : 'Room open'}</span>}
            </div>
            <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-brown px-5 text-center text-white">
              <MessageCircle size={28} className={topicAvailable ? 'text-gold' : 'text-white/40'}/>
              <p className="mt-3 text-sm font-bold">{topicAvailable ? session.topic_title : 'No active moderator topic'}</p>
              <p className="mt-1 text-xs text-white/60">{topicAvailable ? session.creator_name : 'The public room remains open at all times.'}</p>
            </div>
            {topicAvailable && session.stream_url ? (
              <>
                <p className="text-xs leading-5 text-brown/55">Kokwet keeps the conversation beside the stream. Watch opens the host’s official {session.platform === 'tiktok' ? 'TikTok' : 'Instagram'} page in a new tab so mobile playback is not trapped in an embedded player.</p>
                <a href={session.stream_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange px-4 py-3 text-xs font-black uppercase tracking-wider text-brown">Watch on {session.platform}<ExternalLink size={14}/></a>
              </>
            ) : topicAvailable ? (
              <p className="text-xs leading-5 text-brown/55">This moderator-created topic has its own room alongside the shared public chat.</p>
            ) : (
              <p className="text-xs leading-5 text-brown/55">{loading ? 'Checking for an active topic…' : loadError || 'Moderators can open an active topic room at any time.'}</p>
            )}
            {session && !session.is_active && <p className="rounded-lg bg-orange/10 p-3 text-xs font-semibold text-orange">This live topic has ended. Its chat is closed; the public lounge remains open.</p>}
          </aside>

          <section className={`flex h-[min(96dvh,48rem)] min-h-[26rem] max-h-[48rem] flex-col overflow-hidden rounded-2xl border border-brown/10 bg-white text-brown ${chatFocused ? 'lg:order-1' : 'lg:order-2'}`} aria-label={channel === 'topic' ? 'Live topic chat' : 'Kokwet Voice Circle public chat'}>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-brown/10 px-3 py-2 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2"><MessageCircle size={17} className={channel === 'topic' ? 'text-orange' : 'text-green'}/><h2 className="font-display text-lg font-bold">Voice Circle · {channel === 'topic' ? 'Topic' : 'Public'}</h2></div>
              <div className="flex items-center gap-1 rounded-lg bg-offwhite p-1" aria-label="Choose room layout">
                <button type="button" onClick={() => setFocusMode('watch')} aria-pressed={!chatFocused} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-bold ${!chatFocused ? 'bg-white text-brown shadow-sm' : 'text-brown/55'}`}><Maximize2 size={12}/>Watch first</button>
                <button type="button" onClick={() => setFocusMode('chat')} aria-pressed={chatFocused} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-bold ${chatFocused ? 'bg-white text-brown shadow-sm' : 'text-brown/55'}`}><MessageCircle size={12}/>Chat first</button>
              </div>
            </header>
            <nav aria-label="Live conversation" className="flex gap-2 border-b border-brown/10 px-3 py-2 sm:px-5">
              {topicAvailable && <button type="button" onClick={() => setChannel('topic')} disabled={sending || isRecording} aria-pressed={channel === 'topic'} className={`max-w-[60%] truncate rounded-full border px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${channel === 'topic' ? 'border-orange bg-orange/10 text-orange' : 'border-brown/10 text-brown/55'}`}>{session.topic_title}</button>}
              <button type="button" onClick={() => setChannel('public')} disabled={sending || isRecording} aria-pressed={channel === 'public'} className={`rounded-full border px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${channel === 'public' ? 'border-green bg-green/10 text-green' : 'border-brown/10 text-brown/55'}`}>Public lounge</button>
              <span className="ml-auto self-center text-[9px] font-semibold text-brown/45">Refreshes every few seconds</span>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto bg-offwhite/70 px-3 py-2 sm:p-4" aria-live="polite">
              {loading && <p role="status" className="inline-flex items-center gap-2 text-xs text-brown/55"><LoaderCircle size={14} className="animate-spin"/>Joining the conversation…</p>}
              {!loading && messages.length === 0 && <p className="mx-auto my-6 max-w-md rounded-xl border border-orange/20 bg-offwhite p-4 text-center text-sm italic text-brown/75">“Welcome to the circle. Share a story, an idea, or a voice note—every voice has a place here.”<span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-orange">— Kokwet Voice Circle</span></p>}
              {messages.map((item, index, chronologicalMessages) => {
                const own = ownMessageIds.has(item.message_id);
                const previous = chronologicalMessages[index - 1];
                const isNewSender = !previous
                  || previous.author_name !== item.author_name
                  || ownMessageIds.has(previous.message_id) !== own;
                const isNewDate = !previous
                  || new Date(previous.created_at).toDateString() !== new Date(item.created_at).toDateString();
                const color = own ? '#f69b10' : senderColor(item.author_name);
                return (
                  <div key={item.message_id}>
                    {isNewDate && (
                      <div className="my-2 flex justify-center">
                        <span className="rounded-full bg-brown/10 px-3 py-0.5 text-[9px] font-bold tracking-wider text-brown/65">
                          {messageDateLabel(item.created_at)}
                        </span>
                      </div>
                    )}
                    <article className={`flex items-end ${own ? 'justify-end' : 'justify-start'} ${isNewSender ? 'mt-2' : 'mt-0.5'}`}>
                      {!own && (
                        isNewSender
                          ? <span aria-hidden="true" className="mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green/10 text-[10px] font-black uppercase text-green">{item.author_name.trim().charAt(0) || '?'}</span>
                          : <span aria-hidden="true" className="mr-1.5 w-7 shrink-0"/>
                      )}
                      <div className={`flex max-w-[84%] flex-col sm:max-w-[78%] ${own ? 'items-end' : 'items-start'}`}>
                        <div className={`min-w-0 rounded-2xl px-2.5 py-1.5 shadow-sm ${own ? 'rounded-br-sm bg-orange text-white' : 'rounded-bl-sm border border-brown/5 bg-white'}`}>
                          <div className="mb-0.5 flex items-center justify-between gap-3">
                            <strong className="truncate text-[10px] font-bold" style={{ color: own ? '#ffffff' : color }}>
                              {isNewSender ? own ? 'You' : item.author_name : ''}
                            </strong>
                            <time className={`shrink-0 text-[9px] ${own ? 'text-white/65' : 'text-brown/40'}`}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </time>
                          </div>
                          {item.message_type === 'tag' && <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-bold ${own ? 'bg-white/20 text-white' : 'bg-orange/10 text-orange'}`}>#{item.tag_name}</span>}
                          {item.message_text && <p className={`whitespace-pre-wrap break-words text-[13px] leading-snug ${own ? 'text-white' : 'text-brown/80'}`}>{item.message_text}</p>}
                          {item.message_type === 'voice' && item.audio_url && <div className="mt-0.5"><VoiceMessage src={resolveApiUrl(item.audio_url)} own={own}/></div>}
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
              <div ref={endRef}/>
            </div>
            <div className="space-y-2 border-t border-brown/10 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-brown/45">Topic tags</span>
                {ACTIVE_TAGS.map((tag) => <button key={tag} type="button" disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)} onClick={() => void sendTag(tag)} className="rounded-full border border-brown/10 px-2.5 py-1.5 text-[9px] font-bold text-brown/70 transition hover:border-orange hover:text-orange disabled:opacity-40">#{tag}</button>)}
              </div>
              <form onSubmit={sendMessage} className="space-y-2">
                <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-2 sm:gap-3">
                  <label className="text-[10px] font-bold">Display name
                    <input required minLength={2} maxLength={40} value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Community member" className="mt-1 w-full rounded-lg border border-brown/15 px-3 py-2 text-sm font-normal"/>
                  </label>
                  <label className="text-[10px] font-bold">Message
                    <input required maxLength={500} value={messageText} onChange={(event) => setMessageText(event.target.value)} disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)} placeholder={channel === 'topic' ? 'Comment on the active topic…' : storyContext ? `Discuss: ${storyContext}` : 'Share with the community…'} className="mt-1 w-full rounded-lg border border-brown/15 px-3 py-2 text-sm font-normal disabled:bg-brown/5"/>
                  </label>
                </div>
                {sendError && <p role="alert" className="text-xs text-red-700">{sendError}</p>}
                {loadError && session && <p role="status" className="text-xs text-orange">{loadError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-[9px] leading-4 text-brown/45">No account required. Messages are rate-limited and may be moderated. Voice notes are limited to 2 MB.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={isRecording ? stopRecording : () => void startRecording()} disabled={sending || (channel === 'topic' && !topicAvailable)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${isRecording ? 'border-red-300 bg-red-50 text-red-700' : 'border-brown/15 text-brown'}`}>{isRecording ? <Square size={14} /> : <Mic size={14} />}{isRecording ? 'Stop recording' : 'Voice note'}</button>
                    <button disabled={sending || isRecording || (channel === 'topic' && !topicAvailable)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-green px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send'}<Send size={14}/></button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
        {!embedded && <p className="mt-4 text-center text-xs text-brown/45"><Link to="/culture" className="font-bold text-green">Return to Kokwet Voice Circle</Link></p>}
      </div>
    </section>
  );
}
