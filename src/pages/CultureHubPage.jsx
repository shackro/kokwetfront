import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, FileText, Flag, LoaderCircle, MessageCircle, Mic, Radio, Send, ShieldCheck, Square, Users, X } from 'lucide-react';
import { getJson, postForm, postJson, resolveApiUrl, resolveMediaUrl } from '../api';
import KokwetText from '../components/KokwetText';
import DailyVoiceStatus from '../components/DailyVoiceStatus';
import { inspectVoiceFile, SUPPORTED_AUDIO_TYPES } from '../audio';
import LiveCompanionPage from './LiveCompanionPage';

const MAX_RECORDING_SECONDS = 120;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatPostDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CultureHubPage() {
  const [text, setText] = useState('');
  const [posts, setPosts] = useState([]);
  const [houses, setHouses] = useState([]);
  const [activeHouseName, setActiveHouseName] = useState('');
  const [housesError, setHousesError] = useState('');
  const [weeklyVoices, setWeeklyVoices] = useState([]);
  const [activeWeeklyVoiceIndex, setActiveWeeklyVoiceIndex] = useState(0);
  const [weeklyVoicesError, setWeeklyVoicesError] = useState('');
  const [houseVoiceStories, setHouseVoiceStories] = useState([]);
  const [houseVoiceStoriesError, setHouseVoiceStoriesError] = useState('');
  const [selectedHouseStory, setSelectedHouseStory] = useState(null);
  const [readHouseStoryKeys, setReadHouseStoryKeys] = useState(() => new Set());
  const [dailyVoice, setDailyVoice] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [voiceFeatureError, setVoiceFeatureError] = useState('');
  const [voiceSubmission, setVoiceSubmission] = useState(false);
  const [speakerName, setSpeakerName] = useState('');
  const [dialect, setDialect] = useState('');
  const [nominationHouse, setNominationHouse] = useState('');
  const [feedError, setFeedError] = useState('');
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioError, setAudioError] = useState('');
  const [isInspectingAudio, setIsInspectingAudio] = useState(false);
  const [extendLifespan, setExtendLifespan] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [reportingPostId, setReportingPostId] = useState('');
  const [reportedPostIds, setReportedPostIds] = useState(() => new Set());
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [reportMessage, setReportMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const messageFieldRef = useRef(null);

  useEffect(() => {
    if (!selectedHouseStory) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedHouseStory(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedHouseStory]);

  useEffect(() => {
    const savedReadStories = houseVoiceStories
      .filter((story) => window.localStorage.getItem(`kokwet-house-story-read:${story.story_id}:${story.published_at}`) === 'true')
      .map((story) => `${story.story_id}:${story.published_at}`);
    setReadHouseStoryKeys((current) => new Set([...current, ...savedReadStories]));
  }, [houseVoiceStories]);

  useEffect(() => {
    let active = true;
    async function refreshFeed() {
      try {
        const data = await getJson('/v1/culture/feed');
        if (active) {
          setPosts(data.posts);
          setFeedError('');
        }
      } catch (error) {
        if (active) setFeedError(error instanceof Error ? error.message : 'Unable to load community voices');
      } finally {
        if (active) setIsLoadingFeed(false);
      }
    }

    void refreshFeed();
    const interval = window.setInterval(() => void refreshFeed(), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshVoices() {
      try {
        const [statusData, dailyData] = await Promise.all([
          getJson('/v1/voices/status'),
          getJson('/v1/voices/daily'),
        ]);
        if (active) {
          setVoiceStatus(statusData);
          setDailyVoice(dailyData.voice);
          setVoiceFeatureError('');
        }
      } catch (error) {
        if (active) setVoiceFeatureError(error instanceof Error ? error.message : 'Unable to load featured voices');
      }
    }
    void refreshVoices();
    const interval = window.setInterval(() => void refreshVoices(), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!activeHouseName) return undefined;
    let active = true;
    setWeeklyVoices([]);
    setHouseVoiceStories([]);
    setActiveWeeklyVoiceIndex(0);
    async function refreshHouseStories() {
      try {
        const data = await getJson(`/v1/house-voice-stories/${encodeURIComponent(activeHouseName)}`);
        if (active) {
          setHouseVoiceStories(data.stories);
          setHouseVoiceStoriesError('');
        }
      } catch (error) {
        if (active) setHouseVoiceStoriesError(error instanceof Error ? error.message : 'Unable to load this house’s voice stories');
      }
    }
    Promise.all([
      getJson(`/v1/voices/weekly/${encodeURIComponent(activeHouseName)}`),
      refreshHouseStories(),
    ])
      .then(([weeklyData]) => {
        if (active) {
          setWeeklyVoices(weeklyData.voices);
          setWeeklyVoicesError('');
        }
      })
      .catch((error) => {
        if (active) setWeeklyVoicesError(error instanceof Error ? error.message : 'Unable to load this week’s house voices');
      });
    const refreshTimer = window.setInterval(() => void refreshHouseStories(), 30000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [activeHouseName]);

  useEffect(() => {
    let active = true;
    getJson('/houses')
      .then((items) => {
        if (!active) return;
        setHouses(items);
        setActiveHouseName(items[0]?.name ?? '');
      })
      .catch((error) => {
        if (active) setHousesError(error instanceof Error ? error.message : 'Unable to load the Nine Houses');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (targetId === 'nine-houses' || targetId === 'live-lounge') {
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView());
    }
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => {
    const messageField = messageFieldRef.current;
    if (!messageField) return undefined;

    function resizeMessageField() {
      const maxHeight = Math.max(160, window.innerHeight - 112);
      messageField.style.height = 'auto';
      messageField.style.height = `${Math.min(messageField.scrollHeight, maxHeight)}px`;
      messageField.style.overflowY = messageField.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    resizeMessageField();
    window.addEventListener('resize', resizeMessageField);
    return () => window.removeEventListener('resize', resizeMessageField);
  }, [text]);

  function stopRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
  }

  async function startRecording() {
    setAudioError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setAudioError('Voice recording is not supported in this browser.');
      return;
    }

    async function selectAudioFile(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setIsInspectingAudio(true);
      try {
        const duration = await inspectVoiceFile(file);
        setAudioBlob(file);
        setRecordingDuration(duration);
        setAudioError('');
      } catch (error) {
        setAudioError(error instanceof Error ? error.message : 'Unable to use this voice note.');
      } finally {
        setIsInspectingAudio(false);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      const baseType = recorder.mimeType.split(';', 1)[0].toLowerCase();
      if (!SUPPORTED_AUDIO_TYPES.has(baseType)) {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        throw new Error('This browser does not support an audio format accepted by the server.');
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || baseType });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        if (blob.size > MAX_AUDIO_BYTES) {
          setAudioBlob(null);
          setAudioError('That voice note is larger than 2 MB. Record a shorter note and try again.');
        } else if (blob.size > 0) {
          setAudioBlob(blob);
          setAudioError('');
        } else {
          setAudioError('No audio was captured. Please try recording again.');
        }
      };
      recorder.onerror = () => setAudioError('The recording stopped unexpectedly. Please try again.');

      mediaRecorderRef.current = recorder;
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setRecordingDuration(0);
      setAudioBlob(null);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingDuration(Math.min(elapsed, MAX_RECORDING_SECONDS));
        if (elapsed >= MAX_RECORDING_SECONDS) stopRecording();
      }, 250);
    } catch (error) {
      setAudioError(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow microphone access to record a voice note.'
        : error instanceof Error ? error.message : 'Unable to start recording.');
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
    }
  }

  async function submitPost(event) {
    event.preventDefault();
    setSubmitError('');
    setSubmitMessage('');
    setPaymentError('');
    setPaymentMessage('');
    if (isInspectingAudio) {
      setSubmitError('Wait for the voice note check to finish before broadcasting.');
      return;
    }
    const message = text.trim();
    if (!message && !audioBlob) {
      setSubmitError('Add a message or record a voice note before broadcasting.');
      return;
    }
    if (voiceSubmission && !nominationHouse) {
      setSubmitError('Choose a house before nominating your voice.');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    if (message) formData.append('text_message', message);
    if (voiceSubmission) {
      formData.append('voice_submission', 'true');
      formData.append('speaker_name', speakerName.trim());
      formData.append('dialect', dialect.trim());
      formData.append('house_name', nominationHouse);
    }
    if (audioBlob) {
      const extension = audioBlob.type.split(';', 1)[0].split('/')[1] || 'webm';
      formData.append('audio_file', audioBlob, `voice-note.${extension}`);
    }

    try {
      const created = await postForm('/v1/culture/post', formData);
      setText('');
      setAudioBlob(null);
      setRecordingDuration(0);
      setExtendLifespan(false);
      setVoiceSubmission(false);
      setSpeakerName('');
      setDialect('');
      setNominationHouse('');
      setSubmitMessage(created.message || 'Your voice is live in the Kokwet Voice Circle for 24 hours.');

      if (extendLifespan) {
        try {
          const payment = await postJson('/v1/culture/extend', {
            post_id: created.post_id,
            phone_number: phoneNumber,
            amount: 30,
          });
          setPaymentMessage(payment.message);
        } catch (error) {
          setPaymentError(error instanceof Error ? error.message : 'Could not start the M-Pesa payment.');
        }
      }

      try {
        const data = await getJson('/v1/culture/feed');
        setPosts(data.posts);
        setFeedError('');
        const [statusData, dailyData] = await Promise.all([
          getJson('/v1/voices/status'),
          getJson('/v1/voices/daily'),
        ]);
        setVoiceStatus(statusData);
        setDailyVoice(dailyData.voice);
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : 'Your post is live, but the feed could not refresh.');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Your post could not be broadcast.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reportPost(postId) {
    setReportingPostId(postId);
    setReportMessage('');
    try {
      const result = await postJson(`/v1/culture/post/${postId}/flag`, {});
      setReportedPostIds((previous) => new Set(previous).add(postId));
      setReportMessage(result.message);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not report this post.');
    } finally {
      setReportingPostId('');
    }
  }

  function toggleExpandedPost(postId) {
    setExpandedPostIds((previous) => {
      const next = new Set(previous);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  const activeHouse = houses.find((house) => house.name === activeHouseName);

  return (
    <div className="min-h-screen bg-offwhite text-brown">
      <div className="open-hearth-screen">
      <section className="open-hearth-top">
        <div className="mx-auto max-w-4xl">
          <div className="open-hearth-heading">
            <span className="inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-green">
              <Users size={13}/> No account needed
            </span>
            <h1 className="mt-4 flex items-center justify-center gap-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-orange/30 bg-green/10 text-green sm:h-14 sm:w-14">
                <MessageCircle size={25} className="sm:h-7 sm:w-7"/>
                <Mic size={12} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-orange p-0.5 text-white sm:h-4 sm:w-4"/>
              </span>
              <span><KokwetText className="text-brown"/> <span className="text-orange">Voice Circle</span></span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-brown/60 sm:text-base">
              A shared space for the Nine Houses to exchange stories, ideas, and voice notes.
            </p>
            <nav aria-label="Kokwet Voice Circle spaces" className="mt-6 flex flex-wrap justify-center gap-2">
              <a href="#culture-composer" className="rounded-full bg-brown px-4 py-2.5 text-xs font-bold text-white transition hover:bg-green">Share a voice</a>
              <Link to="/live" className="inline-flex items-center gap-2 rounded-full bg-orange px-4 py-2.5 text-xs font-bold text-brown transition hover:bg-gold"><Radio size={14}/>Open public chat</Link>
              <a href="#community-voices" className="rounded-full border border-brown/15 bg-white px-4 py-2.5 text-xs font-bold text-brown/75 transition hover:border-orange/50">Browse community stories</a>
            </nav>
          </div>

          <section aria-label="Kokwet Voice Circle status" className="open-hearth-daily-status">
            {voiceFeatureError ? (
              <p role="status" className="text-sm text-white/70">{voiceFeatureError}</p>
            ) : (
              <DailyVoiceStatus voice={dailyVoice} remaining={voiceStatus?.remaining} large/>
            )}
          </section>

          <form id="culture-composer" onSubmit={submitPost} className="open-hearth-composer scroll-mt-24">
            <div className="border-b border-brown/5 pb-3">
              <h2 className="font-display text-lg font-bold text-brown">Share a community story</h2>
              <p className="mt-1 text-xs leading-5 text-brown/55">Post a short-lived story or voice note. For live back-and-forth, join the public chat below.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-brown/45">
              <span>{text.length}/1,000 characters</span>
              <span className="inline-flex items-center gap-1"><Clock3 size={13}/> Posts expire after 24 hours</span>
            </div>

            <div className="flex flex-col gap-4 border-t border-brown/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitting || isInspectingAudio}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition ${
                    isRecording ? 'animate-pulse bg-red-600 text-white' : 'bg-orange/10 text-orange hover:bg-orange/20'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isRecording ? <Square size={15}/> : <Mic size={16}/>}
                  {isRecording ? `Stop · ${formatTime(recordingDuration)} / 2:00` : audioBlob ? `Voice note · ${formatTime(recordingDuration)}` : 'Record voice note'}
                </button>
                {audioBlob && (
                  <button type="button" onClick={() => { setAudioBlob(null); setRecordingDuration(0); }} className="text-xs font-semibold text-red-600 hover:underline">
                    Remove audio
                  </button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brown/15 px-4 py-2.5 text-xs font-bold text-brown/70 hover:border-orange/50">
                  Upload voice note
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/x-wav"
                    disabled={isSubmitting || isRecording}
                    onChange={(event) => void selectAudioFile(event)}
                    className="sr-only"
                  />
                </label>
              </div>
              {audioPreviewUrl && <audio controls preload="metadata" src={audioPreviewUrl} className="h-10 w-full" onLoadedMetadata={(event) => {
                if (event.currentTarget.duration > MAX_RECORDING_SECONDS) {
                  setAudioBlob(null);
                  setAudioError('Voice notes must be 2 minutes or shorter.');
                }
              }}>Your browser does not support audio playback.</audio>}

              <div className="flex flex-col gap-3 sm:items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={extendLifespan}
                    onChange={(event) => setExtendLifespan(event.target.checked)}
                    disabled={isSubmitting || voiceSubmission}
                    className="h-4 w-4 accent-green"
                  />
                  Preserve for 7 days · KSh 30
                </label>
                {voiceSubmission && <p className="text-[10px] leading-4 text-brown/45">Nominated voices are held privately until selected; preservation is unavailable while nominating.</p>}
                {extendLifespan && (
                  <label className="w-full text-xs font-semibold sm:w-56">
                    M-Pesa number
                    <input
                      type="tel"
                      required
                      pattern="(?:\+254|254|0)(?:7|1)\d{8}"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="0712345678"
                      className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-green/15 bg-green/5 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-xs font-bold leading-5 text-brown">
                <input
                  type="checkbox"
                  checked={voiceSubmission}
                  onChange={(event) => {
                    setVoiceSubmission(event.target.checked);
                    if (event.target.checked) setExtendLifespan(false);
                  }}
                  disabled={isSubmitting || voiceStatus?.remaining === 0}
                  className="mt-0.5 h-4 w-4 accent-green"
                />
                <span>Nominate this post for Voice of the Day / Voices of the Week. If selected, I agree that its text or recording and the name below may be shared publicly.</span>
              </label>
              {voiceSubmission && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-[11px] font-bold">
                    House
                    <select required value={nominationHouse} onChange={(event) => setNominationHouse(event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                      <option value="">Choose a house</option>
                      {houses.map((house) => <option key={house.name} value={house.name}>{house.name}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-bold">
                    Name or alias (optional)
                    <input maxLength={60} value={speakerName} onChange={(event) => setSpeakerName(event.target.value)} placeholder="Community voice" className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"/>
                  </label>
                  <label className="text-[11px] font-bold">
                    Dialect or language (optional)
                    <input maxLength={60} value={dialect} onChange={(event) => setDialect(event.target.value)} placeholder="For example, Kipsigis" className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"/>
                  </label>
                </div>
              )}
              {voiceStatus?.remaining === 0 && <p className="mt-3 text-xs font-semibold text-red-700">Today’s 100 featured-voice nominations have been received. You can still post to the Voice Circle.</p>}
            </div>

            {(audioError || submitError || paymentError) && (
              <div role="status" aria-live="polite" className="space-y-1 text-sm font-medium text-red-700">
                {audioError && <p>{audioError}</p>}
                {submitError && <p>{submitError}</p>}
                {paymentError && <p>Post created; payment was not started: {paymentError}</p>}
              </div>
            )}
            {reportMessage && <p role="status" aria-live="polite" className="text-sm font-medium text-green">{reportMessage}</p>}
            {(submitMessage || paymentMessage) && (
              <div role="status" aria-live="polite" className="space-y-1 text-sm font-semibold text-green">
                {submitMessage && <p className="inline-flex items-center gap-2"><CheckCircle2 size={16}/>{submitMessage}</p>}
                {paymentMessage && <p>{paymentMessage}</p>}
              </div>
            )}
            <label htmlFor="culture-message" className="sr-only">Your community message</label>
            <textarea
              ref={messageFieldRef}
              id="culture-message"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={1000}
              rows={4}
              disabled={isSubmitting || isRecording || isInspectingAudio}
              placeholder="Share an insight, riddle, memory or community update..."
              className="w-full resize-y rounded-xl border border-brown/10 bg-offwhite p-4 text-sm leading-6 outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSubmitting || isRecording || isInspectingAudio || (!text.trim() && !audioBlob)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brown px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-orange disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? <><LoaderCircle size={16} className="animate-spin"/> Broadcasting...</> : <><Send size={15}/>{extendLifespan ? 'Pay & broadcast' : 'Broadcast'}</>}
            </button>
            <p className="text-[11px] leading-5 text-brown/45">
              Anonymous posts are limited to 3 per day per network address. Voice nominations are limited to the first 100 each day and one per network address; nominated content is public only if selected. Voice notes are limited to 2 MB and 2 minutes.
            </p>
          </form>
        </div>
      </section>

      <section id="community-voices" className="open-hearth-feed-section scroll-mt-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-center justify-between border-b border-brown/10 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-brown/55">Community stories</h2>
              <p className="mt-1 text-[10px] text-brown/45">Broadcast posts and voice notes · chat together in the public room below</p>
            </div>
            <span className="rounded-full bg-green/10 px-3 py-1 text-[10px] font-bold text-green">Refreshes every 30s</span>
          </div>
          {isLoadingFeed ? (
            <p className="py-10 text-center text-sm text-brown/50">Loading community stories...</p>
          ) : feedError ? (
            <p role="status" className="rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center text-sm text-red-700">{feedError}</p>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brown/15 bg-white px-5 py-10 text-center text-sm text-brown/55">
              No active stories yet. Share a community story above or join the public chat below.
            </p>
          ) : (
            <div className="open-hearth-feed-list">
              {posts.map((post) => {
                const isPreserved = post.retention_lifespan === '7_DAYS';
                const hasReported = reportedPostIds.has(post.post_id);
                return (
                  <article key={post.post_id} className={`open-hearth-post border-l-4 ${isPreserved ? 'border-l-green' : 'border-l-orange/50'}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold">Community story</span>
                        {post.audio_clip_url && <span className="rounded bg-orange/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-orange">Voice note</span>}
                        {isPreserved && <span className="rounded bg-green/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green"><ShieldCheck size={11} className="mr-1 inline"/>Preserved · 7 days</span>}
                      </div>
                      <time className="text-[10px] text-brown/45" dateTime={post.created_at}>{formatPostDate(post.created_at)}</time>
                    </div>
                    {post.text_message && (
                      <>
                        <p
                          id={`community-message-${post.post_id}`}
                          className={`open-hearth-post-message whitespace-pre-wrap break-words text-sm leading-6 text-brown/85 ${expandedPostIds.has(post.post_id) ? 'is-expanded' : ''}`}
                        >
                          {post.text_message}
                        </p>
                        {post.text_message.length > 280 && (
                          <button
                            type="button"
                            aria-expanded={expandedPostIds.has(post.post_id)}
                            aria-controls={`community-message-${post.post_id}`}
                            onClick={() => toggleExpandedPost(post.post_id)}
                            className="open-hearth-read-more"
                          >
                            {expandedPostIds.has(post.post_id) ? 'Show less' : 'Read full message'}
                          </button>
                        )}
                      </>
                    )}
                    {post.audio_clip_url && (
                      <audio controls preload="none" className="mt-3 h-10 w-full" src={resolveApiUrl(post.audio_clip_url)}>
                        Your browser does not support audio playback.
                      </audio>
                    )}
                    <div className="mt-4 flex items-center justify-end border-t border-brown/5 pt-3">
                      <div className="flex items-center gap-4">
                        <Link
                          to={`/culture?story=${encodeURIComponent(post.text_message?.slice(0, 120) || 'Community voice note')}&open_chat=1#live-lounge`}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green transition hover:text-orange"
                        >
                          <MessageCircle size={13}/>Continue in chat
                        </Link>
                        <button
                          type="button"
                          onClick={() => void reportPost(post.post_id)}
                          disabled={hasReported || reportingPostId === post.post_id}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brown/45 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Flag size={13}/>
                          {reportingPostId === post.post_id ? 'Sending...' : hasReported ? 'Reported' : 'Report'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      </div>

      <LiveCompanionPage embedded/>

      <section id="nine-houses" className="scroll-mt-24 px-5 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          {housesError ? (
            <p role="status" className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">{housesError}</p>
          ) : houses.length === 0 ? (
            <p className="py-8 text-center text-sm text-brown/50">Loading the Nine Houses...</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Select a house">
                {houses.map((house) => (
                  <button
                    key={house.name}
                    type="button"
                    onClick={() => {
                      setActiveHouseName(house.name);
                      setSelectedHouseStory(null);
                    }}
                    aria-pressed={activeHouseName === house.name}
                    className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition sm:px-5 sm:text-sm ${
                      activeHouseName === house.name
                        ? 'bg-orange text-brown shadow-sm'
                        : 'border border-brown/15 bg-white text-brown/75 hover:border-orange/50'
                    }`}
                  >
                    {house.name}
                  </button>
                ))}
              </div>

              <div className="mb-7 text-center">
                <span className="inline-block rounded-full bg-green/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.2em] text-green">Explore the community</span>
                <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Meet the <span className="text-orange">Nine Houses</span></h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-brown/60">
                  Choose a house to explore its voice stories, heritage and modern achievements—then join the shared conversation above.
                </p>
              </div>

              {activeHouse && (
                <div className="grid min-w-0 overflow-hidden rounded-3xl bg-brown text-white shadow-xl md:grid-cols-2">
                  <div className="pattern min-w-0 p-6 sm:p-9 md:p-12">
                    <span className="text-xs font-bold uppercase tracking-widest text-gold">The {activeHouse.name} house</span>
                    <h3 className="mt-4 break-words font-display text-3xl font-bold sm:text-4xl">{activeHouse.tagline}</h3>
                    <p className="mt-5 text-sm leading-7 text-white/70">{activeHouse.summary}</p>
                    <div className="mt-8 rounded-2xl border border-white/15 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gold">House voice</p>
                      <p className="mt-2 text-sm text-white/80">{activeHouse.dialect}</p>
                    </div>
                  </div>
                  <div className="grid min-w-0 content-center gap-7 bg-white p-6 text-brown sm:p-9 md:p-12">
                    <div>
                      {(houseVoiceStoriesError || houseVoiceStories.length > 0) && (
                        <div className="mb-5">
                          {houseVoiceStoriesError ? (
                            <p role="status" className="text-xs text-red-700">{houseVoiceStoriesError}</p>
                          ) : (
                            <div className="flex flex-wrap gap-x-3 gap-y-2" aria-label={`${activeHouse.name} voice stories`}>
                            {houseVoiceStories.map((story) => (
                              (() => {
                                const storyReadKey = `${story.story_id}:${story.published_at}`;
                                const isRead = readHouseStoryKeys.has(storyReadKey);
                                return (
                                  <button
                                    key={story.story_id}
                                    type="button"
                                    onClick={() => setSelectedHouseStory(story)}
                                    aria-label={`Open voice story: ${story.title}${isRead ? ', read' : ', unread'}`}
                                    className="group flex w-14 shrink-0 flex-col items-center gap-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                  >
                                    <span className={`grid h-12 w-12 place-items-center rounded-full border-2 p-[2px] transition group-hover:border-orange ${isRead ? 'border-brown/30 bg-brown/5' : 'border-green bg-green/5'}`}>
                                      {story.cover_image_url
                                        ? <img src={resolveMediaUrl(story.cover_image_url)} alt="" loading="lazy" className="h-full w-full rounded-full object-cover"/>
                                        : <FileText size={17} className={isRead ? 'text-brown/50' : 'text-green'}/>}
                                    </span>
                                    <span className="w-full truncate text-[9px] font-semibold leading-3 text-brown/75">{story.title}</span>
                                    {isRead && <span className="-mt-0.5 text-[8px] font-bold leading-3 text-green">Read</span>}
                                  </button>
                                );
                              })()
                            ))}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs font-bold uppercase tracking-widest text-green">History & heritage</p>
                      <p className="mt-3 text-sm leading-7 text-brown/65">{activeHouse.history}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-green">Modern achievement</p>
                      <p className="mt-3 text-sm leading-7 text-brown/65">{activeHouse.achievement}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="px-5 py-8 sm:py-10" aria-labelledby="weekly-voices-title">
        <div className="mx-auto max-w-6xl rounded-2xl border border-brown/10 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-orange">Selected by the Kokwet team</p>
              <h2 id="weekly-voices-title" className="mt-1 font-display text-2xl font-bold text-brown">Voices of the Week <span className="text-green">· {activeHouseName}</span></h2>
            </div>
            <span className="rounded-full bg-green/10 px-3 py-1 text-[10px] font-bold text-green">Up to three featured voices</span>
          </div>
          {weeklyVoicesError ? (
            <p role="status" className="mt-4 text-sm text-red-700">{weeklyVoicesError}</p>
          ) : weeklyVoices.length ? (
            <div className="mx-auto mt-5 max-w-xl overflow-hidden rounded-2xl border border-brown/10 bg-brown text-white shadow-lg">
              <div className="flex gap-1.5 px-4 pt-4" aria-label={`Voice ${activeWeeklyVoiceIndex + 1} of ${weeklyVoices.length}`}>
                {weeklyVoices.map((voice, index) => <span key={voice.post_id} className={`h-1 flex-1 rounded-full ${index === activeWeeklyVoiceIndex ? 'bg-gold' : 'bg-white/25'}`}/>)}
              </div>
              <article className="p-5 sm:p-7">
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-gold">House voice · {activeHouseName}</p>
                <h4 className="mt-2 font-display text-xl font-bold">{weeklyVoices[activeWeeklyVoiceIndex]?.speaker_name || 'Community voice'}</h4>
                {weeklyVoices[activeWeeklyVoiceIndex]?.dialect && <p className="mt-1 text-xs text-white/55">{weeklyVoices[activeWeeklyVoiceIndex].dialect}</p>}
                {weeklyVoices[activeWeeklyVoiceIndex]?.text_message && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/85">{weeklyVoices[activeWeeklyVoiceIndex].text_message}</p>}
                {weeklyVoices[activeWeeklyVoiceIndex]?.audio_clip_url && <audio controls preload="none" className="mt-4 h-10 w-full" src={resolveApiUrl(weeklyVoices[activeWeeklyVoiceIndex].audio_clip_url)}>Your browser does not support audio playback.</audio>}
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <button type="button" onClick={() => setActiveWeeklyVoiceIndex((index) => (index - 1 + weeklyVoices.length) % weeklyVoices.length)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold hover:border-gold">Previous</button>
                  <span className="text-[10px] font-semibold text-white/50">{activeWeeklyVoiceIndex + 1} / {weeklyVoices.length}</span>
                  <button type="button" onClick={() => setActiveWeeklyVoiceIndex((index) => (index + 1) % weeklyVoices.length)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold hover:border-gold">Next</button>
                </div>
              </article>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-brown/60">The team is collecting this house’s selected voices for the week. Nominated posts are reviewed before they appear here.</p>
          )}
        </div>
      </section>

      {selectedHouseStory && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedHouseStory(null);
          }}
        >
          <article role="dialog" aria-modal="true" aria-labelledby="house-story-dialog-title" className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white text-brown shadow-2xl">
            <button type="button" onClick={() => setSelectedHouseStory(null)} aria-label="Close voice story" className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75">
              <X size={18}/>
            </button>
            {selectedHouseStory.cover_image_url
              ? <img src={resolveMediaUrl(selectedHouseStory.cover_image_url)} alt="" className="h-48 w-full object-cover"/>
              : <div className="flex h-24 items-center justify-center bg-green/5 text-green"><FileText size={30}/></div>}
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-green">
                {selectedHouseStory.speaker_name || activeHouse?.name}{selectedHouseStory.dialect ? ` · ${selectedHouseStory.dialect}` : ''}
              </p>
              <h2 id="house-story-dialog-title" className="mt-1 font-display text-2xl font-bold">{selectedHouseStory.title}</h2>
              {selectedHouseStory.audio_clip_url && (
                <audio controls autoPlay preload="none" className="mt-4 h-10 w-full" src={resolveApiUrl(selectedHouseStory.audio_clip_url)}>
                  Your browser does not support audio playback.
                </audio>
              )}
              {selectedHouseStory.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-brown/70">{selectedHouseStory.body}</p>}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-brown/10 pt-4">
                <p className="text-[10px] text-brown/45">Available until {new Date(selectedHouseStory.expires_at).toLocaleString()}</p>
                {readHouseStoryKeys.has(`${selectedHouseStory.story_id}:${selectedHouseStory.published_at}`) ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green/10 px-3 py-2 text-xs font-bold text-green">
                    <CheckCircle2 size={15}/> Read
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const storyReadKey = `${selectedHouseStory.story_id}:${selectedHouseStory.published_at}`;
                      window.localStorage.setItem(`kokwet-house-story-read:${storyReadKey}`, 'true');
                      setReadHouseStoryKeys((current) => new Set(current).add(storyReadKey));
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green px-3 py-2 text-xs font-bold text-white transition hover:bg-green/90"
                  >
                    <CheckCircle2 size={15}/> Mark as read
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>
      )}

      <section className="relative mt-2 overflow-hidden bg-brown px-5 py-10 text-white sm:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-5 [background-size:20px_20px] [background-image:radial-gradient(#F69B10_1px,transparent_1px)]"/>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-block rounded-full bg-gold/15 px-3 py-1 text-[9px] font-black uppercase tracking-[.2em] text-gold">The roots of our shared voice</span>
              <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Nine Houses, <span className="text-orange">One <KokwetText tone="light"/></span></h2>
            </div>
            <p className="max-w-sm text-xs leading-5 text-white/60 sm:text-right">
              After the conversation, meet the distinct histories and homelands that come together in this shared Hearth.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((house, index) => (
              <article key={house.name} className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 transition hover:border-gold/30 hover:bg-white/10">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-bold">{house.name}</h3>
                  <span className="text-[9px] font-bold text-white/30">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-orange">{house.anchor}</p>
                <p className="mt-1.5 text-[10px] leading-4 text-white/60">{house.blueprint}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
