import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BarChart3, BookOpen, CalendarDays, Check, ChevronRight, CreditCard, History, LogOut, Map, MessageCircle, Mic, Plus, Save, Shield, Ticket, Trash2, Users } from 'lucide-react';
import { getJson, postJson, resolveApiUrl, staffRequest } from '../api';
import SiteContentEditor from './SiteContentEditor';
import LiveControlPanel from './LiveControlPanel';
import CatalogEditor from './CatalogEditor';
import PaymentSettingsPanel from './PaymentSettingsPanel';
import StaffVoiceRecorder from '../components/StaffVoiceRecorder';
import StaffMediaInput from '../components/StaffMediaInput';
import { inspectVoiceFile } from '../audio';

const TicketGatePanel = lazy(() => import('./TicketGatePanel'));

const houses = [
  'Kipsigis', 'Nandi', 'Tugen', 'Keiyo', 'Marakwet',
  'Pokot', 'Sabaot', 'Terik', 'Ogiek & Sengwer',
];
const emptyStory = { title: '', body: '', cover_image_url: '', is_published: true, sort_order: 1000 };
const emptyHouseStory = () => ({ title: '', body: '', cover_image_url: '', audio_data: '', text_only: false, remove_cover_image: false, remove_audio: false, speaker_name: '', dialect: '' });
const emptyAccount = { phone: '', role: 'creator', can_manage_stories: false, can_manage_live: false, can_scan_tickets: false, house_names: [] };
const emptyImpact = {
  hero: { eyebrow: '', title: '', highlight: '', body: '' },
  pathways: [],
  transparency: { title: '', body: '', report_mode: 'unpublished', report_period: '', report_source: '', report_url: '', allocations: [] },
  goals_heading: '',
  goals: [],
};
const emptyRoadmap = {
  eyebrow: '',
  title: '',
  highlight: '',
  introduction: '',
  status_note: '',
  phases: [],
  feedback_title: '',
  feedback_description: '',
  feedback_prompt: '',
};

function contentId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Unable to read that file.'));
    reader.onerror = () => reject(new Error('Unable to read that file.'));
    reader.readAsDataURL(file);
  });
}

function Panel({ title, children, icon: Icon }) {
  return (
    <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-brown/10 pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><Icon size={19}/></span>
        <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StaffAudioPreview({ postId, token }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioError, setAudioError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function loadAudio() {
    setAudioError('');
    setLoading(true);
    try {
      const response = await fetch(resolveApiUrl(`/v1/staff/culture/audio/${postId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Unable to load this private voice recording.');
      setAudioUrl(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'Unable to load this private voice recording.');
    } finally {
      setLoading(false);
    }
  }

  if (!audioUrl) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => void loadAudio()} disabled={loading} className="rounded-lg border border-green/25 px-3 py-2 text-[10px] font-bold text-green disabled:opacity-50">{loading ? 'Loading recording…' : 'Listen to private recording'}</button>
        {audioError && <p role="status" className="mt-2 text-xs text-red-700">{audioError}</p>}
      </div>
    );
  }
  return <audio controls autoPlay preload="none" className="mt-3 h-10 w-full" src={audioUrl}>Your browser does not support audio playback.</audio>;
}

function VoicePreview({ voice, token }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-green">
        {voice.speaker_name || 'Community voice'}
        {voice.house_name ? ` · ${voice.house_name}` : ''}
        {voice.dialect ? ` · ${voice.dialect}` : ''}
      </p>
      {voice.text_message && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-brown/80">{voice.text_message}</p>}
      {voice.audio_clip_url && <StaffAudioPreview postId={voice.post_id} token={token}/>}
    </div>
  );
}

export default function StaffPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem('kokwet-staff-token') || '');
  const [staff, setStaff] = useState(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('stories');
  const [openHearthSection, setOpenHearthSection] = useState('live');
  const [stories, setStories] = useState([]);
  const [storyForm, setStoryForm] = useState(emptyStory);
  const [storyAudioData, setStoryAudioData] = useState('');
  const [storyRemoveAudio, setStoryRemoveAudio] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState('');
  const [posts, setPosts] = useState([]);
  const [dailyCandidates, setDailyCandidates] = useState([]);
  const [dailyVoice, setDailyVoice] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [weeklyHouse, setWeeklyHouse] = useState(houses[0]);
  const [weeklyCandidates, setWeeklyCandidates] = useState([]);
  const [weeklySelection, setWeeklySelection] = useState([]);
  const [houseVoiceSlots, setHouseVoiceSlots] = useState([]);
  const [houseStoryForms, setHouseStoryForms] = useState([emptyHouseStory(), emptyHouseStory(), emptyHouseStory()]);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [rootPassword, setRootPassword] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [impactForm, setImpactForm] = useState(emptyImpact);
  const [roadmapForm, setRoadmapForm] = useState(emptyRoadmap);
  const [busy, setBusy] = useState(false);
  const [mediaUploadCount, setMediaUploadCount] = useState(0);
  const [audioValidating, setAudioValidating] = useState(false);

  const isSuperAdmin = Boolean(staff?.is_super_admin) || staff?.role === 'super_admin';
  const isAdmin = staff?.role === 'admin' || isSuperAdmin;
  const canModerate = isAdmin || staff?.role === 'moderator';
  const canManageTeam = isAdmin;
  const canManageStories = isAdmin || staff?.can_manage_stories;
  const canManageVoices = isAdmin || Boolean(staff?.house_names?.length);
  const canManageLive = isAdmin || Boolean(staff?.can_manage_live);
  const canScanTickets = isAdmin || Boolean(staff?.can_scan_tickets);
  const manageableHouses = isAdmin ? houses : (staff?.house_names || []);
  const visibleOpenHearthSection = canModerate ? openHearthSection : 'live';

  function onMediaUploadStateChange(isUploading) {
    setMediaUploadCount((current) => Math.max(0, current + (isUploading ? 1 : -1)));
  }
  const tabs = useMemo(() => [
    ...(canManageStories ? [{ id: 'stories', label: 'Festival stories', icon: BookOpen }] : []),
    ...(canModerate ? [
    { id: 'impact', label: 'Impact page', icon: BarChart3 },
    ] : []),
    ...(canManageLive || canModerate ? [{ id: 'open-hearth', label: 'Voice Circle control', icon: MessageCircle }] : []),
    ...(canManageVoices ? [{ id: 'voices', label: 'Featured voices', icon: Mic }] : []),
    ...(canManageVoices ? [{ id: 'house-stories', label: 'House voice stories', icon: BookOpen }] : []),
    ...(canScanTickets ? [{ id: 'gate', label: 'Gate scanning', icon: Ticket }] : []),
    ...(canManageTeam ? [
    { id: 'catalog', label: 'Events & tickets', icon: CalendarDays },
    { id: 'site-content', label: 'Pages & media', icon: Shield },
    { id: 'roadmap', label: 'Roadmap', icon: Map },
    { id: 'team', label: 'Staff access', icon: Users },
    ] : []),
    ...(isSuperAdmin ? [{ id: 'payments', label: 'M-Pesa settings', icon: CreditCard }] : []),
    ...(isSuperAdmin ? [{ id: 'audit', label: 'System audit', icon: History }] : []),
  ], [canManageLive, canManageStories, canManageTeam, canManageVoices, canModerate, canScanTickets, isSuperAdmin]);

  useEffect(() => {
    if (staff && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs.some((tab) => tab.id === 'open-hearth')
        ? 'open-hearth'
        : tabs[0]?.id || '');
    }
  }, [activeTab, staff, tabs]);

  useEffect(() => {
    if (staff && !isAdmin && staff.house_names?.length && !staff.house_names.includes(weeklyHouse)) {
      setWeeklyHouse(staff.house_names[0]);
    }
  }, [isAdmin, staff, weeklyHouse]);

  useEffect(() => {
    if (!token) {
      setStaff(null);
      return undefined;
    }
    let active = true;
    staffRequest('/v1/staff/auth/me', token)
      .then((data) => {
        if (active) setStaff(data.staff);
      })
      .catch(() => {
        sessionStorage.removeItem('kokwet-staff-token');
        if (active) {
          setToken('');
          setStaff(null);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !staff) return undefined;
    let active = true;
    async function loadWorkspace() {
      setError('');
      try {
        if (canManageStories) {
          const storyData = await staffRequest('/v1/staff/stories', token);
          if (active) setStories(storyData.stories);
        }
        if (isAdmin || staff.role === 'moderator') {
          const [moderationData, dailyData, statusData, impactData] = await Promise.all([
            staffRequest('/v1/staff/culture/posts', token),
            getJson('/v1/voices/daily'),
            getJson('/v1/voices/status'),
            staffRequest('/v1/staff/impact', token),
          ]);
          const candidatesData = canManageVoices
            ? await staffRequest('/v1/staff/voices/candidates?daily=true', token)
            : { voices: [] };
          if (active) {
            setPosts(moderationData.posts);
            setDailyCandidates(candidatesData.voices);
            setDailyVoice(dailyData.voice);
            setVoiceStatus(statusData);
            setImpactForm(impactData);
          }
        }
        if (isAdmin) {
          const [userData, invitationData, roadmapData] = await Promise.all([
            staffRequest('/v1/staff/users', token),
            staffRequest('/v1/staff/activation-codes', token),
            staffRequest('/v1/staff/roadmap', token),
          ]);
          if (active) {
            setUsers(userData.users);
            setInvitations(invitationData.invitations);
            setRoadmapForm(roadmapData);
          }
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the staff workspace.');
      }
    }
    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [canManageStories, canManageVoices, canModerate, isAdmin, staff, token]);

  useEffect(() => {
    if (!token || !isSuperAdmin || activeTab !== 'audit') return undefined;
    let active = true;
    staffRequest('/v1/staff/super-admin/audit', token)
      .then((data) => {
        if (active) setAuditEvents(data.events);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the system audit trail.');
      });
    return () => {
      active = false;
    };
  }, [activeTab, isSuperAdmin, token]);

  useEffect(() => {
    if (!token || !canManageVoices || activeTab !== 'voices') return undefined;
    let active = true;
    async function loadHouseVoices() {
      try {
        const [candidateData, selectedData] = await Promise.all([
          staffRequest(`/v1/staff/voices/candidates?house_name=${encodeURIComponent(weeklyHouse)}`, token),
          getJson(`/v1/voices/weekly/${encodeURIComponent(weeklyHouse)}`),
        ]);
        if (active) {
          setWeeklyCandidates(candidateData.voices);
          setWeeklySelection(selectedData.voices.map((voice) => voice.post_id));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this house’s voice nominations.');
      }
    }
    void loadHouseVoices();
    return () => {
      active = false;
    };
  }, [activeTab, canManageVoices, token, weeklyHouse]);

  useEffect(() => {
    if (!token || !canManageVoices || activeTab !== 'house-stories') return undefined;
    let active = true;
    staffRequest(`/v1/staff/house-voice-stories/${encodeURIComponent(weeklyHouse)}`, token)
      .then((data) => {
        if (!active) return;
        setHouseVoiceSlots(data.slots);
        setHouseStoryForms(data.slots.map(({ story }) => story
          ? {
            title: story.title,
            body: story.body,
            cover_image_url: story.cover_image_url || '',
            audio_data: '',
            text_only: !story.cover_image_url && !story.audio_clip_url,
            remove_cover_image: false,
            remove_audio: false,
            speaker_name: story.speaker_name || '',
            dialect: story.dialect || '',
          }
          : emptyHouseStory()));
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this house’s voice stories.');
      });
    return () => {
      active = false;
    };
  }, [activeTab, canManageVoices, token, weeklyHouse]);

  async function saveHouseVoiceStory(position) {
    const form = houseStoryForms[position - 1];
    setError('');
    setNotice('');
    if (mediaUploadCount > 0 || audioValidating) {
      setError('Wait for media uploads and audio checks to finish before publishing.');
      return;
    }
    const existingStory = houseVoiceSlots[position - 1]?.story;
    const willHaveAudio = Boolean(form.audio_data)
      || Boolean(existingStory?.audio_clip_url && !form.remove_audio && !form.text_only);
    if (!willHaveAudio && !form.body.trim()) {
      setError('Add a caption or voice recording before publishing this note.');
      return;
    }
    setBusy(true);
    try {
      await staffRequest(
        `/v1/staff/house-voice-stories/${encodeURIComponent(weeklyHouse)}/${position}`,
        token,
        { method: 'PUT', body: form },
      );
      const data = await staffRequest(
        `/v1/staff/house-voice-stories/${encodeURIComponent(weeklyHouse)}`,
        token,
      );
      setHouseVoiceSlots(data.slots);
      setHouseStoryForms(data.slots.map(({ story }) => story
        ? {
          title: story.title,
          body: story.body,
          cover_image_url: story.cover_image_url || '',
          audio_data: '',
          text_only: !story.cover_image_url && !story.audio_clip_url,
          remove_cover_image: false,
          remove_audio: false,
          speaker_name: story.speaker_name || '',
          dialect: story.dialect || '',
        }
        : emptyHouseStory()));
      setNotice(`${weeklyHouse} voice story ${position} published. It will expire in 48 hours.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to publish this house voice story.');
    } finally {
      setBusy(false);
    }
  }

  async function removeHouseVoiceStory(position) {
    try {
      await staffRequest(
        `/v1/staff/house-voice-stories/${encodeURIComponent(weeklyHouse)}/${position}`,
        token,
        { method: 'DELETE' },
      );
      const data = await staffRequest(
        `/v1/staff/house-voice-stories/${encodeURIComponent(weeklyHouse)}`,
        token,
      );
      setHouseVoiceSlots(data.slots);
      setHouseStoryForms(data.slots.map(({ story }) => story
        ? {
          title: story.title,
          body: story.body,
          cover_image_url: story.cover_image_url || '',
          audio_data: '',
          text_only: !story.cover_image_url && !story.audio_clip_url,
          remove_cover_image: false,
          remove_audio: false,
          speaker_name: story.speaker_name || '',
          dialect: story.dialect || '',
        }
        : emptyHouseStory()));
      setNotice(`${weeklyHouse} voice story ${position} removed.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to remove this house voice story.');
    }
  }

  async function selectHouseStoryMedia(position, key, file, allowedTypes, maxBytes, label) {
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setError(`Choose a supported ${label} file.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`${label} files must be ${label === 'cover image' ? '512 KB' : '2 MB'} or smaller.`);
      return;
    }
    if (key === 'audio_data') setAudioValidating(true);
    try {
      if (key === 'audio_data') await inspectVoiceFile(file);
      const dataUrl = await readFileAsDataUrl(file);
      setHouseStoryForms((current) => current.map((form, index) => (
        index === position - 1
          ? {
            ...form,
            [key]: dataUrl,
            text_only: false,
            ...(key === 'cover_image_url' ? { remove_cover_image: false } : { remove_audio: false }),
          }
          : form
      )));
      setError('');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : `Unable to read the ${label}.`);
    } finally {
      if (key === 'audio_data') setAudioValidating(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setLoginError('');
    setBusy(true);
    try {
      const data = await postJson('/v1/staff/auth/login', { identifier: loginIdentifier, password: loginPassword });
      sessionStorage.setItem('kokwet-staff-token', data.token);
      setStaff(data.staff);
      setToken(data.token);
      setActiveTab(data.staff.role === 'admin' || data.staff.is_super_admin || data.staff.can_manage_stories
        ? 'stories'
        : data.staff.role === 'moderator' || data.staff.can_manage_live
          ? 'open-hearth'
        : data.staff.can_scan_tickets
          ? 'gate'
          : 'voices');
      setLoginPassword('');
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setLoginError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      if (token) await staffRequest('/v1/staff/auth/logout', token, { method: 'POST' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The server session could not be revoked.');
    } finally {
      sessionStorage.removeItem('kokwet-staff-token');
      setToken('');
      setStaff(null);
      navigate('/login', { replace: true });
    }
  }

  async function refreshStories() {
    const data = await staffRequest('/v1/staff/stories', token);
    setStories(data.stories);
  }

  async function saveStory(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (mediaUploadCount > 0 || audioValidating) {
      setError('Wait for media uploads and audio checks to finish before publishing.');
      return;
    }
    if (!editingStoryId && (!storyForm.cover_image_url || !storyAudioData)) {
      setError('Homepage stories need both a cover image and a voice recording.');
      return;
    }
    if (editingStoryId && storyRemoveAudio && !storyAudioData && !storyForm.body.trim()) {
      setError('Add a caption before removing the only voice recording.');
      return;
    }
    setBusy(true);
    try {
      const path = editingStoryId ? `/v1/staff/stories/${editingStoryId}` : '/v1/staff/stories';
      await staffRequest(path, token, {
        method: editingStoryId ? 'PATCH' : 'POST',
        body: {
          ...storyForm,
          ...(storyAudioData ? { audio_data: storyAudioData } : {}),
          ...(editingStoryId && storyRemoveAudio ? { remove_audio: true } : {}),
        },
      });
      setStoryForm(emptyStory);
      setStoryAudioData('');
      setStoryRemoveAudio(false);
      setEditingStoryId('');
      await refreshStories();
      setNotice(editingStoryId ? 'Story updated.' : 'Story created.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the story.');
    } finally {
      setBusy(false);
    }
  }

  async function selectStoryAudio(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAudioValidating(true);
    try {
      await inspectVoiceFile(file);
      setStoryAudioData(await readFileAsDataUrl(file));
      setStoryRemoveAudio(false);
      setError('');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Unable to read the voice recording.');
    } finally {
      setAudioValidating(false);
    }
  }

  async function removeStory(storyId) {
    if (!window.confirm('Delete this story permanently?')) return;
    setError('');
    try {
      await staffRequest(`/v1/staff/stories/${storyId}`, token, { method: 'DELETE' });
      await refreshStories();
      setNotice('Story deleted.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete the story.');
    }
  }

  async function moderatePost(postId, isVisible) {
    try {
      await staffRequest(`/v1/staff/culture/posts/${postId}`, token, {
        method: 'PATCH',
        body: { is_visible: isVisible },
      });
      const data = await staffRequest('/v1/staff/culture/posts', token);
      setPosts(data.posts);
      setNotice(isVisible ? 'Post restored to the public feed.' : 'Post hidden from the public feed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to moderate this post.');
    }
  }

  async function featureDailyVoice(postId) {
    try {
      await staffRequest('/v1/staff/voices/daily', token, { method: 'PUT', body: { post_id: postId } });
      const data = await getJson('/v1/voices/daily');
      setDailyVoice(data.voice);
      setNotice('Voice of the Day updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to feature this voice.');
    }
  }

  function toggleWeeklyVoice(postId) {
    setWeeklySelection((current) => current.includes(postId)
      ? current.filter((id) => id !== postId)
      : current.length < 3 ? [...current, postId] : current);
  }

  async function saveWeeklyVoices() {
    setError('');
    if (weeklySelection.length > 3) {
      setError('A house can have no more than three featured voices.');
      return;
    }
    try {
      await staffRequest('/v1/staff/voices/weekly', token, {
        method: 'PUT',
        body: { house_name: weeklyHouse, post_ids: weeklySelection },
      });
      setNotice(`${weeklySelection.length} ${weeklyHouse} voice${weeklySelection.length === 1 ? '' : 's'} featured for this week.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the weekly voices.');
    }
  }

  function updateImpactHero(field, value) {
    setImpactForm(current => ({ ...current, hero: { ...current.hero, [field]: value } }));
  }

  function updateImpactTransparency(field, value) {
    setImpactForm(current => ({
      ...current,
      transparency: { ...current.transparency, [field]: value },
    }));
  }

  function updateImpactPathway(pathwayId, changes) {
    setImpactForm(current => ({
      ...current,
      pathways: current.pathways.map(pathway => pathway.id === pathwayId ? { ...pathway, ...changes } : pathway),
    }));
  }

  function updateImpactGoal(goalId, changes) {
    setImpactForm(current => ({
      ...current,
      goals: current.goals.map(goal => goal.id === goalId ? { ...goal, ...changes } : goal),
    }));
  }

  async function saveImpact(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (mediaUploadCount > 0) {
      setError('Wait for page image uploads to finish before saving.');
      return;
    }
    setBusy(true);
    try {
      const saved = await staffRequest('/v1/staff/impact', token, { method: 'PUT', body: impactForm });
      setImpactForm(saved);
      setNotice('Impact page updated for all visitors.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the impact page.');
    } finally {
      setBusy(false);
    }
  }

  function updateRoadmapPhase(phaseId, changes) {
    setRoadmapForm(current => ({
      ...current,
      phases: current.phases.map(phase => phase.id === phaseId ? { ...phase, ...changes } : phase),
    }));
  }

  function moveRoadmapPhase(index, offset) {
    setRoadmapForm(current => {
      const target = index + offset;
      if (target < 0 || target >= current.phases.length) return current;
      const phases = [...current.phases];
      [phases[index], phases[target]] = [phases[target], phases[index]];
      return { ...current, phases };
    });
  }

  async function saveRoadmap(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (mediaUploadCount > 0) {
      setError('Wait for page image uploads to finish before saving.');
      return;
    }
    setBusy(true);
    try {
      const saved = await staffRequest('/v1/staff/roadmap', token, { method: 'PUT', body: roadmapForm });
      setRoadmapForm(saved);
      setNotice('Roadmap updated for all visitors.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the roadmap.');
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const data = await staffRequest('/v1/staff/users', token, { method: 'POST', body: accountForm });
      setGeneratedInvite(data.activation);
      setAccountForm(emptyAccount);
      const invitationData = await staffRequest('/v1/staff/activation-codes', token);
      setInvitations(invitationData.invitations);
      setNotice('One-time activation code created. Share it privately with the invited staff member.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create the staff invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(activationId) {
    try {
      await staffRequest(`/v1/staff/activation-codes/${activationId}`, token, { method: 'DELETE' });
      const data = await staffRequest('/v1/staff/activation-codes', token);
      setInvitations(data.invitations);
      setNotice('Staff invitation revoked.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to revoke this staff invitation.');
    }
  }

  async function copyActivationCode() {
    if (!generatedInvite) return;
    try {
      await navigator.clipboard.writeText(generatedInvite.code);
      setNotice('Activation code copied. Share it only with the invited person.');
    } catch {
      setError('Could not access the clipboard. Select and copy the code manually.');
    }
  }

  async function updateAccount(staffId, changes) {
    try {
      await staffRequest(`/v1/staff/users/${staffId}`, token, { method: 'PATCH', body: changes });
      const data = await staffRequest('/v1/staff/users', token);
      setUsers(data.users);
      setNotice('Staff access updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update staff access.');
    }
  }

  async function removeAccount(user) {
    if (!window.confirm(`Permanently delete the staff account for ${user.email}?`)) return;
    try {
      await staffRequest(`/v1/staff/users/${user.staff_id}`, token, { method: 'DELETE' });
      setUsers((current) => current.filter((item) => item.staff_id !== user.staff_id));
      setNotice('Staff account deleted.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete the staff account.');
    }
  }

  async function changeRootPassword(event) {
    event.preventDefault();
    const rootAccount = users.find((user) => user.is_super_admin);
    if (!rootAccount) return;
    setError('');
    setNotice('');
    try {
      await staffRequest(`/v1/staff/users/${rootAccount.staff_id}`, token, {
        method: 'PATCH',
        body: { password: rootPassword },
      });
      setRootPassword('');
      sessionStorage.removeItem('kokwet-staff-token');
      setToken('');
      setStaff(null);
      setLoginIdentifier(rootAccount.email);
      setLoginError('Password changed. Sign in again with your new password.');
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to change the Super Admin password.');
    }
  }

  if (!staff) {
    return (
      <section className="min-h-[75vh] bg-offwhite px-5 py-14">
        <div className="mx-auto max-w-md rounded-2xl border border-brown/10 bg-white p-6 shadow-lg sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-green"><Shield size={13}/> Staff-only workspace</span>
          <h1 className="mt-4 font-display text-3xl font-bold text-brown">Kokwet Control Room</h1>
          <p className="mt-2 text-sm leading-6 text-brown/60">One secure workspace for authorized administrators, moderators and storytellers. Your account determines the controls available.</p>
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <label className="block text-xs font-bold">Staff phone or email
              <input autoComplete="username" type="text" required value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
            </label>
            <label className="block text-xs font-bold">Password
              <input autoComplete="current-password" type="password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
            </label>
            {loginError && <p role="alert" className="text-sm font-semibold text-red-700">{loginError}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-brown px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-green disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in securely'}</button>
          </form>
          <p className="mt-5 text-center text-xs text-brown/60">Invited to the team? <Link to="/activate" className="font-bold text-green underline">Activate your account</Link></p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[75vh] bg-offwhite px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-brown p-5 text-white sm:p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-gold">Kokwet Festival · Control Room</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Your workspace</h1>
            <p className="mt-2 text-sm text-white/65">{staff.full_name} <span className="px-1 text-orange">·</span> {isSuperAdmin ? 'Super Admin' : staff.role}</p>
          </div>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"><LogOut size={15}/> Sign out</button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-green/20 bg-green/5 px-4 py-3 text-sm font-semibold text-green">{notice}</p>}

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-2" aria-label="Staff workspace sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setActiveTab(id); setError(''); setNotice(''); }} aria-pressed={activeTab === id} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition ${activeTab === id ? 'bg-orange text-brown' : 'border border-brown/15 bg-white text-brown/70 hover:border-orange/40'}`}>
              <Icon size={15}/>{label}
            </button>
          ))}
        </nav>

        {!tabs.length && <Panel title="No publishing access assigned" icon={Shield}><p className="text-sm leading-6 text-brown/60">Your staff account is active, but an administrator has not assigned any content areas yet.</p></Panel>}

        {activeTab === 'impact' && canModerate && (
          <form onSubmit={saveImpact} className="space-y-5">
            <Panel title="Impact page introduction" icon={BarChart3}>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['eyebrow', 'Small heading', 80],
                  ['title', 'Main heading', 120],
                  ['highlight', 'Highlighted heading', 100],
                ].map(([field, label, maxLength]) => (
                  <label key={field} className="block text-xs font-bold">{label}
                    <input required maxLength={maxLength} value={impactForm.hero[field]} onChange={(event) => updateImpactHero(field, event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"/>
                  </label>
                ))}
                <StaffMediaInput token={token} label="Impact hero image" value={impactForm.hero.image_url} onChange={(value) => updateImpactHero('image_url', value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy}/>
                <label className="block text-xs font-bold sm:col-span-2">Introduction
                  <textarea required minLength={20} maxLength={800} rows={3} value={impactForm.hero.body} onChange={(event) => updateImpactHero('body', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6 outline-none focus:border-green"/>
                </label>
              </div>
            </Panel>

            <Panel title="Ways to contribute" icon={Users}>
              <div className="mb-5 grid gap-4 rounded-xl border border-brown/10 p-4 sm:grid-cols-2">
                <label className="block text-xs font-bold">Section eyebrow
                  <input required minLength={2} maxLength={80} value={impactForm.pathways_eyebrow} onChange={(event) => setImpactForm(current => ({ ...current, pathways_eyebrow: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Heading first part
                  <input required minLength={2} maxLength={100} value={impactForm.pathways_title_first} onChange={(event) => setImpactForm(current => ({ ...current, pathways_title_first: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Highlighted heading
                  <input required minLength={2} maxLength={100} value={impactForm.pathways_title_highlight} onChange={(event) => setImpactForm(current => ({ ...current, pathways_title_highlight: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Section description
                  <textarea required minLength={10} maxLength={500} rows={2} value={impactForm.pathways_copy} onChange={(event) => setImpactForm(current => ({ ...current, pathways_copy: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
              </div>
              <div className="space-y-4">
                {impactForm.pathways.map((pathway) => (
                  <article key={pathway.id} className="rounded-xl border border-brown/10 p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-xs font-bold">Title
                        <input required minLength={2} maxLength={100} value={pathway.title} onChange={(event) => updateImpactPathway(pathway.id, { title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                      </label>
                      <label className="block text-xs font-bold">Button label
                        <input required minLength={2} maxLength={60} value={pathway.cta_label} onChange={(event) => updateImpactPathway(pathway.id, { cta_label: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                      </label>
                      <label className="block text-xs font-bold sm:col-span-2">Description
                        <textarea required minLength={10} maxLength={350} rows={2} value={pathway.description} onChange={(event) => updateImpactPathway(pathway.id, { description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                      </label>
                      <StaffMediaInput token={token} label={`${pathway.title || 'Pathway'} card image`} value={pathway.image_url} onChange={(value) => updateImpactPathway(pathway.id, { image_url: value })} onUploadStateChange={onMediaUploadStateChange} disabled={busy}/>
                      <label className="block text-xs font-bold">Button destination
                        <select value={pathway.destination} onChange={(event) => updateImpactPathway(pathway.id, { destination: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                          <option value="open_hearth">Kokwet Voice Circle</option>
                          <option value="community_services">Community services</option>
                          <option value="festival_marketplace">Festival marketplace</option>
                          <option value="none">No link</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-bold">Suggested actions</p>
                      <div className="mt-2 space-y-2">
                        {pathway.actions.map((action, index) => (
                          <div key={`${pathway.id}-action-${index}`} className="flex gap-2">
                            <input required maxLength={160} value={action} onChange={(event) => updateImpactPathway(pathway.id, { actions: pathway.actions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="min-w-0 flex-1 rounded-lg border border-brown/15 px-3 py-2 text-sm font-normal"/>
                            <button type="button" aria-label="Remove action" disabled={pathway.actions.length <= 1} onClick={() => updateImpactPathway(pathway.id, { actions: pathway.actions.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-lg border border-brown/10 p-2 text-brown/50 disabled:opacity-30"><Trash2 size={15}/></button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <button type="button" disabled={pathway.actions.length >= 5} onClick={() => updateImpactPathway(pathway.id, { actions: [...pathway.actions, ''] })} className="inline-flex items-center gap-1.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={14}/> Add action</button>
                        <button type="button" disabled={impactForm.pathways.length <= 1} onClick={() => setImpactForm(current => ({ ...current, pathways: current.pathways.filter(item => item.id !== pathway.id) }))} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 disabled:opacity-40"><Trash2 size={14}/> Remove pathway</button>
                      </div>
                    </div>
                  </article>
                ))}
                <button type="button" disabled={impactForm.pathways.length >= 8} onClick={() => setImpactForm(current => ({ ...current, pathways: [...current.pathways, { id: contentId('pathway'), title: '', description: '', actions: [''], cta_label: '', destination: 'none', image_url: '' }] }))} className="inline-flex items-center gap-2 rounded-lg border border-green/25 px-4 py-2.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={15}/> Add contribution pathway</button>
              </div>
            </Panel>

            <Panel title="Resource transparency" icon={Shield}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold">Eyebrow label
                  <input required minLength={2} maxLength={80} value={impactForm.accountability_label} onChange={(event) => setImpactForm(current => ({ ...current, accountability_label: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Resource card label
                  <input required minLength={2} maxLength={100} value={impactForm.resource_reporting_label} onChange={(event) => setImpactForm(current => ({ ...current, resource_reporting_label: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Section title
                  <input required minLength={3} maxLength={120} value={impactForm.transparency.title} onChange={(event) => updateImpactTransparency('title', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">What visitors should know
                  <textarea required minLength={20} maxLength={800} rows={3} value={impactForm.transparency.body} onChange={(event) => updateImpactTransparency('body', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
                <label className="block text-xs font-bold">Unpublished report title
                  <input required minLength={3} maxLength={120} value={impactForm.unpublished_report_title} onChange={(event) => setImpactForm(current => ({ ...current, unpublished_report_title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Unpublished report note
                  <textarea required minLength={10} maxLength={300} rows={2} value={impactForm.unpublished_report_body} onChange={(event) => setImpactForm(current => ({ ...current, unpublished_report_body: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
                <label className="block text-xs font-bold">Supporting report link label
                  <input required minLength={2} maxLength={100} value={impactForm.report_link_label} onChange={(event) => setImpactForm(current => ({ ...current, report_link_label: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Empty resource card title
                  <input required minLength={3} maxLength={120} value={impactForm.resource_empty_title} onChange={(event) => setImpactForm(current => ({ ...current, resource_empty_title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Empty resource card description
                  <textarea required minLength={10} maxLength={300} rows={2} value={impactForm.resource_empty_body} onChange={(event) => setImpactForm(current => ({ ...current, resource_empty_body: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
                <label className="block text-xs font-bold">Reporting status
                  <select value={impactForm.transparency.report_mode} onChange={(event) => updateImpactTransparency('report_mode', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="unpublished">No report published</option>
                    <option value="proposed">Proposal (not actual spending)</option>
                    <option value="verified">Verified report</option>
                  </select>
                </label>
                <label className="block text-xs font-bold">Reporting period
                  <input maxLength={100} value={impactForm.transparency.report_period} onChange={(event) => updateImpactTransparency('report_period', event.target.value)} placeholder="e.g. January–June 2026" className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Report source
                  <input maxLength={250} value={impactForm.transparency.report_source} onChange={(event) => updateImpactTransparency('report_source', event.target.value)} placeholder="Name the document or publisher" className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Supporting report link (optional)
                  <input type="url" maxLength={1000} value={impactForm.transparency.report_url} onChange={(event) => updateImpactTransparency('report_url', event.target.value)} placeholder="https://…" className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
              </div>
              {impactForm.transparency.report_mode !== 'unpublished' && (
                <div className="mt-5 rounded-xl border border-brown/10 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div><h3 className="text-sm font-bold text-brown">Allocation breakdown</h3><p className="mt-1 text-xs text-brown/55">Percentages must total 100. Verified figures also require a period and source.</p></div>
                    <button type="button" disabled={impactForm.transparency.allocations.length >= 10} onClick={() => updateImpactTransparency('allocations', [...impactForm.transparency.allocations, { id: contentId('allocation'), label: '', percentage: 0 }])} className="inline-flex items-center gap-1.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={14}/> Add allocation</button>
                  </div>
                  <div className="space-y-2">
                    {impactForm.transparency.allocations.map((allocation, index) => (
                      <div key={allocation.id} className="flex flex-wrap gap-2">
                        <input required minLength={2} maxLength={100} aria-label={`Allocation ${index + 1} label`} value={allocation.label} onChange={(event) => updateImpactTransparency('allocations', impactForm.transparency.allocations.map(item => item.id === allocation.id ? { ...item, label: event.target.value } : item))} className="min-w-0 flex-1 rounded-lg border border-brown/15 px-3 py-2 text-sm font-normal" placeholder="Allocation label"/>
                        <input required type="number" min="0" max="100" aria-label={`Allocation ${index + 1} percentage`} value={allocation.percentage} onChange={(event) => updateImpactTransparency('allocations', impactForm.transparency.allocations.map(item => item.id === allocation.id ? { ...item, percentage: Number(event.target.value) } : item))} className="w-24 rounded-lg border border-brown/15 px-3 py-2 text-sm font-normal" placeholder="%"/>
                        <button type="button" aria-label="Remove allocation" onClick={() => updateImpactTransparency('allocations', impactForm.transparency.allocations.filter(item => item.id !== allocation.id))} className="rounded-lg border border-brown/10 p-2 text-brown/50"><Trash2 size={15}/></button>
                      </div>
                    ))}
                    {!impactForm.transparency.allocations.length && <p className="text-xs text-brown/55">No allocation breakdown added.</p>}
                  </div>
                </div>
              )}

            </Panel>

            <Panel title="Goals and milestones" icon={Check}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold">Section eyebrow
                  <input required minLength={2} maxLength={80} value={impactForm.goals_eyebrow} onChange={(event) => setImpactForm(current => ({ ...current, goals_eyebrow: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Section heading
                  <input required minLength={3} maxLength={120} value={impactForm.goals_heading} onChange={(event) => setImpactForm(current => ({ ...current, goals_heading: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Section description
                  <textarea required minLength={10} maxLength={300} rows={2} value={impactForm.goals_body} onChange={(event) => setImpactForm(current => ({ ...current, goals_body: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
              </div>
              <div className="mt-4 space-y-3">
                {impactForm.goals.map((goal) => (
                  <article key={goal.id} className="grid gap-3 rounded-xl border border-brown/10 p-4 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="block text-xs font-bold">Goal
                      <input required minLength={4} maxLength={180} value={goal.title} onChange={(event) => updateImpactGoal(goal.id, { title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                    </label>
                    <label className="block text-xs font-bold">Description
                      <textarea required minLength={10} maxLength={350} rows={2} value={goal.description} onChange={(event) => updateImpactGoal(goal.id, { description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                    </label>
                    <div className="flex items-end gap-2">
                      <label className="block flex-1 text-xs font-bold">Status
                        <select value={goal.status} onChange={(event) => updateImpactGoal(goal.id, { status: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                          <option value="planned">Planned</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                      <button type="button" aria-label="Remove goal" disabled={impactForm.goals.length <= 1} onClick={() => setImpactForm(current => ({ ...current, goals: current.goals.filter(item => item.id !== goal.id) }))} className="mb-0.5 rounded-lg border border-brown/10 p-2.5 text-brown/50 disabled:opacity-30"><Trash2 size={15}/></button>
                    </div>
                  </article>
                ))}
                <button type="button" disabled={impactForm.goals.length >= 12} onClick={() => setImpactForm(current => ({ ...current, goals: [...current.goals, { id: contentId('goal'), title: '', description: '', status: 'planned' }] }))} className="inline-flex items-center gap-2 rounded-lg border border-green/25 px-4 py-2.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={15}/> Add goal</button>
              </div>
            </Panel>

            <div className="sticky bottom-3 z-10 flex justify-end">
              <button type="submit" disabled={busy || mediaUploadCount > 0} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-60"><Save size={16}/>{busy ? 'Saving…' : mediaUploadCount ? 'Uploading images…' : 'Save impact page'}</button>
            </div>
          </form>
        )}

        {activeTab === 'site-content' && canManageTeam && <SiteContentEditor token={token}/>}
        {activeTab === 'catalog' && canManageTeam && <CatalogEditor token={token}/>}
        {activeTab === 'payments' && isSuperAdmin && <PaymentSettingsPanel token={token}/>}
        {activeTab === 'audit' && isSuperAdmin && (
          <Panel title="Super Admin activity" icon={History}>
            <p className="mb-4 text-sm leading-6 text-brown/60">Successful changes made with the Super Admin session are recorded here. Request bodies, passwords and provider secrets are never included.</p>
            <div className="space-y-2">
              {auditEvents.map((event) => (
                <article key={event.audit_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brown/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-all text-xs font-bold text-brown">{event.method} {event.path}</p>
                    <p className="mt-1 text-[10px] text-brown/55">{event.actor_name} · {new Date(event.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${event.response_status < 400 ? 'bg-green/10 text-green' : 'bg-red-50 text-red-700'}`}>HTTP {event.response_status}</span>
                </article>
              ))}
              {!auditEvents.length && <p className="rounded-lg bg-offwhite px-4 py-5 text-sm text-brown/55">No successful Super Admin changes have been recorded.</p>}
            </div>
          </Panel>
        )}

        {activeTab === 'roadmap' && canManageTeam && (
          <form onSubmit={saveRoadmap} className="space-y-5">
            <Panel title="Roadmap introduction" icon={Map}>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['eyebrow', 'Small heading', 80],
                  ['title', 'Main heading', 120],
                  ['highlight', 'Highlighted heading', 100],
                ].map(([field, label, maxLength]) => (
                  <label key={field} className="block text-xs font-bold">{label}
                    <input required maxLength={maxLength} value={roadmapForm[field]} onChange={event => setRoadmapForm(current => ({ ...current, [field]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                  </label>
                ))}
                <StaffMediaInput token={token} label="Roadmap hero image" value={roadmapForm.hero_image_url} onChange={(value) => setRoadmapForm(current => ({ ...current, hero_image_url: value }))} onUploadStateChange={onMediaUploadStateChange} disabled={busy}/>
                <label className="block text-xs font-bold">Hero button label
                  <input required minLength={2} maxLength={80} value={roadmapForm.hero_cta_label} onChange={event => setRoadmapForm(current => ({ ...current, hero_cta_label: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Introduction
                  <textarea required minLength={20} maxLength={800} rows={3} value={roadmapForm.introduction} onChange={event => setRoadmapForm(current => ({ ...current, introduction: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Roadmap status note
                  <textarea required minLength={10} maxLength={300} rows={2} value={roadmapForm.status_note} onChange={event => setRoadmapForm(current => ({ ...current, status_note: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                  <span className="mt-1 block text-[10px] font-normal text-brown/55">Explain how to interpret phase statuses. Avoid unsupported progress percentages.</span>
                </label>
              </div>
            </Panel>

            <Panel title="Roadmap section components" icon={Map}>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['journey_eyebrow', 'Journey eyebrow', 80],
                  ['journey_title_first', 'Journey heading first part', 80],
                  ['journey_title_highlight', 'Journey heading highlight', 80],
                  ['feedback_eyebrow', 'Feedback eyebrow', 80],
                ].map(([field, label, maxLength]) => (
                  <label key={field} className="block text-xs font-bold">{label}
                    <input required minLength={2} maxLength={maxLength} value={roadmapForm[field]} onChange={event => setRoadmapForm(current => ({ ...current, [field]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                  </label>
                ))}
              </div>
            </Panel>

            <Panel title="Journey phases and milestones" icon={Map}>
              <div className="space-y-4">
                {roadmapForm.phases.map((phase, index) => (
                  <article key={phase.id} className="rounded-xl border border-brown/10 p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-wider text-green">Phase {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Move phase up" disabled={index === 0} onClick={() => moveRoadmapPhase(index, -1)} className="rounded-lg border border-brown/10 p-2 text-brown/60 disabled:opacity-30"><ArrowUp size={15}/></button>
                        <button type="button" aria-label="Move phase down" disabled={index === roadmapForm.phases.length - 1} onClick={() => moveRoadmapPhase(index, 1)} className="rounded-lg border border-brown/10 p-2 text-brown/60 disabled:opacity-30"><ArrowDown size={15}/></button>
                        <button type="button" aria-label="Remove phase" disabled={roadmapForm.phases.length <= 1} onClick={() => setRoadmapForm(current => ({ ...current, phases: current.phases.filter(item => item.id !== phase.id) }))} className="rounded-lg border border-red-200 p-2 text-red-700 disabled:opacity-30"><Trash2 size={15}/></button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-xs font-bold">Phase title
                        <input required minLength={3} maxLength={120} value={phase.title} onChange={event => updateRoadmapPhase(phase.id, { title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                      </label>
                      <label className="block text-xs font-bold">Subtitle
                        <input required minLength={3} maxLength={140} value={phase.subtitle} onChange={event => updateRoadmapPhase(phase.id, { subtitle: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                      </label>
                      <label className="block text-xs font-bold sm:col-span-2">Description
                        <textarea required minLength={20} maxLength={600} rows={3} value={phase.description} onChange={event => updateRoadmapPhase(phase.id, { description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                      </label>
                      <StaffMediaInput token={token} label={`${phase.title || 'Phase'} image`} value={phase.image_url} onChange={(value) => updateRoadmapPhase(phase.id, { image_url: value })} onUploadStateChange={onMediaUploadStateChange} disabled={busy}/>
                      <label className="block text-xs font-bold">Public status
                        <select value={phase.status} onChange={event => updateRoadmapPhase(phase.id, { status: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                          <option value="planned">Planned</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-bold">Milestones and priorities</p>
                      <div className="mt-2 space-y-2">
                        {phase.milestones.map((milestone, milestoneIndex) => (
                          <div key={`${phase.id}-milestone-${milestoneIndex}`} className="flex gap-2">
                            <input required maxLength={180} value={milestone} onChange={event => updateRoadmapPhase(phase.id, { milestones: phase.milestones.map((item, itemIndex) => itemIndex === milestoneIndex ? event.target.value : item) })} className="min-w-0 flex-1 rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                            <button type="button" aria-label="Remove milestone" disabled={phase.milestones.length <= 1} onClick={() => updateRoadmapPhase(phase.id, { milestones: phase.milestones.filter((_, itemIndex) => itemIndex !== milestoneIndex) })} className="rounded-lg border border-brown/10 p-2 text-brown/50 disabled:opacity-30"><Trash2 size={15}/></button>
                          </div>
                        ))}
                      </div>
                      <button type="button" disabled={phase.milestones.length >= 8} onClick={() => updateRoadmapPhase(phase.id, { milestones: [...phase.milestones, ''] })} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={14}/> Add milestone</button>
                    </div>
                  </article>
                ))}
                <button type="button" disabled={roadmapForm.phases.length >= 8} onClick={() => setRoadmapForm(current => ({ ...current, phases: [...current.phases, { id: contentId('phase'), title: '', subtitle: '', description: '', status: 'planned', milestones: [''], image_url: '' }] }))} className="inline-flex items-center gap-2 rounded-lg border border-green/25 px-4 py-2.5 text-xs font-bold text-green disabled:opacity-40"><Plus size={15}/> Add phase</button>
              </div>
            </Panel>

            <Panel title="Community feedback panel" icon={Users}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold">Feedback success message
                  <input required minLength={5} maxLength={160} value={roadmapForm.feedback_success_message} onChange={event => setRoadmapForm(current => ({ ...current, feedback_success_message: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Feedback submit button label
                  <input required minLength={2} maxLength={80} value={roadmapForm.feedback_button_label} onChange={event => setRoadmapForm(current => ({ ...current, feedback_button_label: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Feedback placeholder
                  <input required minLength={2} maxLength={120} value={roadmapForm.feedback_placeholder} onChange={event => setRoadmapForm(current => ({ ...current, feedback_placeholder: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Heading
                  <input required minLength={3} maxLength={100} value={roadmapForm.feedback_title} onChange={event => setRoadmapForm(current => ({ ...current, feedback_title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold">Prompt above the visitor input
                  <input required minLength={5} maxLength={150} value={roadmapForm.feedback_prompt} onChange={event => setRoadmapForm(current => ({ ...current, feedback_prompt: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <label className="block text-xs font-bold sm:col-span-2">Description
                  <textarea required minLength={10} maxLength={300} rows={2} value={roadmapForm.feedback_description} onChange={event => setRoadmapForm(current => ({ ...current, feedback_description: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
              </div>
            </Panel>

            <div className="sticky bottom-3 z-10 flex justify-end">
              <button type="submit" disabled={busy || mediaUploadCount > 0} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-60"><Save size={16}/>{busy ? 'Saving…' : mediaUploadCount ? 'Uploading images…' : 'Save roadmap'}</button>
            </div>
          </form>
        )}

        {activeTab === 'stories' && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Panel title={editingStoryId ? 'Edit festival voice note' : 'Publish a festival voice note'} icon={BookOpen}>
              <p className="mb-4 text-sm leading-6 text-brown/60">These homepage stories are primarily voice notes. Record with your microphone or upload audio; a short caption is optional. Admins and staff with story-publishing permission can manage these notes.</p>
              <form onSubmit={saveStory} className="space-y-4">
                <label className="block text-xs font-bold">Voice note title
                  <input required minLength={3} maxLength={120} value={storyForm.title} onChange={(event) => setStoryForm({ ...storyForm, title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"/>
                </label>
                <label className="block text-xs font-bold">Short caption <span className="font-normal text-brown/50">(optional for voice notes)</span>
                  <textarea maxLength={5000} rows={3} value={storyForm.body} onChange={(event) => setStoryForm({ ...storyForm, body: event.target.value })} className="mt-1.5 w-full resize-y rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6 outline-none focus:border-green"/>
                </label>
                <label className="block text-xs font-bold">Homepage priority (lower numbers appear first)
                  <input type="number" min="0" max="10000" value={storyForm.sort_order} onChange={(event) => setStoryForm({ ...storyForm, sort_order: Number(event.target.value) })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                </label>
                <StaffMediaInput
                  token={token}
                  label="Cover image"
                  value={storyForm.cover_image_url}
                  onChange={(value) => setStoryForm((current) => ({ ...current, cover_image_url: value }))}
                  onUploadStateChange={onMediaUploadStateChange}
                  disabled={busy}
                  required={!editingStoryId}
                  previewClassName="mt-3 h-16 w-16 rounded-full border-2 border-orange object-cover"
                />
                <div>
                  <label htmlFor="story-audio" className="block text-xs font-bold">Voice recording
                    <span className="mt-1.5 block text-[10px] font-normal text-brown/55">Record a voice note with your microphone or upload an MP3, M4A, OGG, WAV or WebM file (up to 2 MB).</span>
                  </label>
                  <input id="story-audio" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/x-wav" disabled={busy || audioValidating} onChange={(event) => void selectStoryAudio(event)} className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-green/10 file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-green disabled:opacity-40"/>
                  <StaffVoiceRecorder disabled={busy || audioValidating} onRecordingComplete={(recording) => { setStoryAudioData(recording); setStoryRemoveAudio(false); setError(''); }}/>
                  {(storyAudioData || (editingStoryId && !storyRemoveAudio && stories.find((story) => story.story_id === editingStoryId)?.audio_clip_url)) && (
                    <audio controls preload="none" className="mt-3 h-10 w-full" src={storyAudioData || resolveApiUrl(stories.find((story) => story.story_id === editingStoryId)?.audio_clip_url)}>Your browser does not support audio playback.</audio>
                  )}
                  {(storyAudioData || (editingStoryId && stories.find((story) => story.story_id === editingStoryId)?.audio_clip_url && !storyRemoveAudio)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const existingAudio = stories.find((story) => story.story_id === editingStoryId)?.audio_clip_url;
                        if (storyAudioData) {
                          setStoryAudioData('');
                          setStoryRemoveAudio(false);
                        } else {
                          setStoryRemoveAudio(Boolean(existingAudio));
                        }
                      }}
                      className="mt-2 text-[10px] font-bold text-red-700"
                    >{storyAudioData && editingStoryId ? 'Discard replacement recording' : 'Remove recording'}</button>
                  )}
                  {storyRemoveAudio && <p className="mt-2 text-[10px] text-orange">The current recording will be removed when you save.</p>}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={storyForm.is_published} onChange={(event) => setStoryForm({ ...storyForm, is_published: event.target.checked })} className="h-4 w-4 accent-green"/>
                  Publish this voice note on the homepage
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || mediaUploadCount > 0 || audioValidating} className="rounded-lg bg-green px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">{busy ? 'Saving…' : mediaUploadCount ? 'Uploading media…' : audioValidating ? 'Checking audio…' : editingStoryId ? 'Save changes' : 'Publish voice note'}</button>
                  {editingStoryId && <button type="button" onClick={() => { setEditingStoryId(''); setStoryForm(emptyStory); setStoryAudioData(''); setStoryRemoveAudio(false); }} className="rounded-lg border border-brown/15 px-4 py-3 text-xs font-bold">Cancel edit</button>}
                </div>
              </form>
            </Panel>
            <Panel title="Published and draft voice notes" icon={BookOpen}>
              {stories.length ? <div className="space-y-3">
                {stories.map((story) => (
                  <article key={story.story_id} className="rounded-xl border border-brown/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${story.is_published ? 'bg-green/10 text-green' : 'bg-orange/10 text-orange'}`}>{story.is_published ? 'Published' : 'Draft'}</span><h3 className="mt-2 font-display text-lg font-bold text-brown">{story.title}</h3><p className="mt-1 text-[10px] text-brown/45">By {story.author_name} · Priority {story.sort_order}</p></div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => { setEditingStoryId(story.story_id); setStoryAudioData(''); setStoryRemoveAudio(false); setStoryForm({ title: story.title, body: story.body, cover_image_url: story.cover_image_url || '', is_published: story.is_published, sort_order: story.sort_order }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg border border-brown/15 px-3 py-2 text-[10px] font-bold">Edit</button>
                        <button type="button" onClick={() => void removeStory(story.story_id)} className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-700">Delete</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div> : <p className="text-sm text-brown/55">No voice notes yet. Publish the first festival voice note.</p>}
            </Panel>
          </div>
        )}

        {activeTab === 'open-hearth' && (canModerate || canManageLive) && (
          <div className="space-y-5">
            <nav aria-label="Voice Circle control areas" className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpenHearthSection('live')} aria-pressed={visibleOpenHearthSection === 'live'} className={`rounded-full px-4 py-2.5 text-xs font-bold ${visibleOpenHearthSection === 'live' ? 'bg-orange text-brown' : 'border border-brown/15 bg-white text-brown/70'}`}>Voice Circle live chat</button>
              {canModerate && <button type="button" onClick={() => setOpenHearthSection('posts')} aria-pressed={visibleOpenHearthSection === 'posts'} className={`rounded-full px-4 py-2.5 text-xs font-bold ${visibleOpenHearthSection === 'posts' ? 'bg-orange text-brown' : 'border border-brown/15 bg-white text-brown/70'}`}>Community posts</button>}
            </nav>
            {visibleOpenHearthSection === 'live' && <LiveControlPanel token={token} canManageSessions={canManageLive} canModerateMessages={canManageLive || canModerate}/>}
            {visibleOpenHearthSection === 'posts' && canModerate && <Panel title="Community post moderation" icon={Shield}>
            <p className="mb-4 text-sm leading-6 text-brown/60">Review community posts and reports. Hiding a post removes it from the public feed and any featured voice selection.</p>
            {posts.length ? <div className="space-y-3">
              {posts.map((post) => (
                <article key={post.post_id} className="rounded-xl border border-brown/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className={post.is_visible ? 'text-green' : 'text-red-700'}>{post.is_visible ? 'Visible' : post.is_voice_submission && !post.is_rejected ? 'Awaiting selection' : 'Hidden'}</span>
                      {post.is_voice_submission && <span className="rounded-full bg-orange/10 px-2 py-1 text-orange">Voice nomination · {post.house_name}</span>}
                      {post.report_count > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">{post.report_count} reports</span>}
                      <time className="text-brown/45">{new Date(post.created_at).toLocaleString()}</time>
                    </div>
                    <button type="button" onClick={() => void moderatePost(post.post_id, !post.is_visible)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${post.is_visible ? 'border border-red-200 text-red-700' : 'bg-green text-white'}`}>{post.is_visible ? 'Hide post' : post.is_voice_submission && !post.is_rejected ? 'Reject nomination' : 'Restore post'}</button>
                  </div>
                  {post.text_message && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-brown/80">{post.text_message}</p>}
                  {post.audio_clip_url && <StaffAudioPreview postId={post.post_id} token={token}/>}
                </article>
              ))}
            </div> : <p className="text-sm text-brown/55">No community posts are waiting for review.</p>}
          </Panel>}
          </div>
        )}

        {activeTab === 'gate' && canScanTickets && (
          <Suspense fallback={<p className="rounded-xl border border-brown/10 bg-white p-5 text-sm text-brown/60" role="status">Loading gate scanner…</p>}>
            <TicketGatePanel token={token} isAdmin={isAdmin}/>
          </Suspense>
        )}

        {activeTab === 'voices' && canManageVoices && (
          <div className="space-y-5">
            {canModerate && <Panel title="Voice of the Day" icon={Mic}>
              <p className="mb-4 text-sm text-brown/60">{voiceStatus ? `${voiceStatus.submitted} of ${voiceStatus.limit} daily nominations received.` : 'Review today’s community nominations.'} Select one voice to publish as today’s Voice Circle feature.</p>
              {dailyVoice && <div className="mb-4 rounded-xl border border-green/20 bg-green/5 p-4"><p className="mb-2 text-[9px] font-black uppercase tracking-wider text-green">Currently featured</p><VoicePreview voice={dailyVoice} token={token}/></div>}
              <div className="space-y-3">
                {dailyCandidates.map((voice) => (
                  <article key={voice.post_id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brown/10 p-4">
                    <VoicePreview voice={voice} token={token}/>
                    <button type="button" onClick={() => void featureDailyVoice(voice.post_id)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white"><Check size={14}/> Feature today</button>
                  </article>
                ))}
                {!dailyCandidates.length && <p className="rounded-lg bg-offwhite px-4 py-5 text-sm text-brown/55">No eligible nominations have arrived today.</p>}
              </div>
            </Panel>}

            <Panel title="House Voices · Nine Houses" icon={Users}>
              <p className="mb-4 text-sm leading-6 text-brown/60">Choose up to three approved nominations for a house. Visitors select a house first, then browse its voices in a status-style viewer.</p>
              <label className="mb-4 block max-w-sm text-xs font-bold">Choose a house
                <select value={weeklyHouse} onChange={(event) => setWeeklyHouse(event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                  {manageableHouses.map((house) => <option key={house}>{house}</option>)}
                </select>
              </label>
              <p className="mb-4 text-sm leading-6 text-brown/60">Choose up to three nominations made for {weeklyHouse}. Selected posts are preserved for seven days and shown only in that house’s weekly feature.</p>
              {weeklyCandidates.length ? (
                <>
                  <div className="space-y-3">
                    {weeklyCandidates.map((voice) => {
                      const selected = weeklySelection.includes(voice.post_id);
                      return (
                        <label key={voice.post_id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selected ? 'border-green bg-green/5' : 'border-brown/10'}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleWeeklyVoice(voice.post_id)} disabled={!selected && weeklySelection.length >= 3} className="mt-1 h-4 w-4 accent-green"/>
                          <VoicePreview voice={voice} token={token}/>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-brown/60">{weeklySelection.length} of 3 selected</span>
                    <button type="button" onClick={() => void saveWeeklyVoices()} disabled={weeklySelection.length > 3} className="rounded-lg bg-green px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40">Publish house voices</button>
                  </div>
                </>
              ) : <p className="rounded-lg bg-offwhite px-4 py-5 text-sm text-brown/55">No visible {weeklyHouse} nominations are available yet.</p>}
            </Panel>
          </div>
        )}

        {activeTab === 'house-stories' && canManageVoices && (
          <div className="space-y-5">
            <Panel title="48-hour house voice stories" icon={BookOpen}>
              <p className="mb-4 max-w-3xl text-sm leading-6 text-brown/60">Publish up to three voice notes for each house, with an optional short caption and cover. Record with your microphone or upload audio. Text-only notes are also supported. Stories expire 48 hours after their latest publish; each slot allows five publishes or updates in a rolling 48-hour window. Only admins and staff assigned to this house can publish here.</p>
              <label className="mb-5 block max-w-sm text-xs font-bold">Choose a house
                <select value={weeklyHouse} onChange={(event) => setWeeklyHouse(event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal">
                  {manageableHouses.map((house) => <option key={house}>{house}</option>)}
                </select>
              </label>
              <div className="grid gap-5 lg:grid-cols-3">
                {[1, 2, 3].map((position) => {
                  const slot = houseVoiceSlots[position - 1];
                  const form = houseStoryForms[position - 1] || emptyHouseStory();
                  const story = slot?.story;
                  const capReached = slot?.publishes_remaining === 0;
                  return (
                    <form key={`${weeklyHouse}-${position}`} onSubmit={(event) => { event.preventDefault(); void saveHouseVoiceStory(position); }} className="space-y-3 rounded-2xl border border-brown/10 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-wider text-orange">Status slot {position}</p>
                          <h3 className="mt-1 font-display text-lg font-bold text-brown">{story ? 'Active voice note' : 'Empty voice note slot'}</h3>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${capReached ? 'bg-red-50 text-red-700' : 'bg-green/10 text-green'}`}>
                          {slot ? `${slot.publishes_remaining}/5 updates left` : '5/5 updates left'}
                        </span>
                      </div>
                      {story && <p className="text-[10px] text-brown/50">Expires {new Date(story.expires_at).toLocaleString()}</p>}
                      <label className="block text-xs font-bold">Voice note title
                        <input required minLength={2} maxLength={100} value={form.title} onChange={(event) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1 ? { ...item, title: event.target.value } : item))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
                      </label>
                      <label className="block text-xs font-bold">Short caption <span className="font-normal text-brown/50">(optional for voice notes)</span>
                        <textarea maxLength={500} rows={3} value={form.body} onChange={(event) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1 ? { ...item, body: event.target.value } : item))} className="mt-1.5 w-full resize-y rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-5"/>
                      </label>
                      <label className="flex items-start gap-2 rounded-lg bg-offwhite p-3 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={form.text_only}
                          onChange={(event) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1
                            ? {
                              ...item,
                              text_only: event.target.checked,
                              cover_image_url: event.target.checked ? '' : item.cover_image_url,
                              audio_data: event.target.checked ? '' : item.audio_data,
                              remove_cover_image: event.target.checked,
                              remove_audio: event.target.checked,
                            }
                            : item))}
                          className="mt-0.5 accent-green"
                        />
                        <span>Text-only note <span className="mt-1 block font-normal text-brown/55">No recording or cover; add a short caption above.</span></span>
                      </label>
                      <StaffMediaInput
                        token={token}
                        label="Optional cover image"
                        value={form.cover_image_url}
                        disabled={busy || form.text_only}
                        onUploadStateChange={onMediaUploadStateChange}
                        onChange={(value) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1
                          ? { ...item, cover_image_url: value, remove_cover_image: !value, text_only: value ? false : item.text_only }
                          : item))}
                      />
                      <label className="block text-xs font-bold">Voice recording <span className="font-normal text-brown/50">(record or upload)</span>
                        <input type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/x-wav" disabled={form.text_only || busy || audioValidating} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void selectHouseStoryMedia(position, 'audio_data', file, ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-wav'], 2 * 1024 * 1024, 'voice recording'); }} className="mt-1.5 block w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-green/10 file:px-2 file:py-1.5 file:font-bold file:text-green disabled:opacity-40"/>
                      </label>
                      <StaffVoiceRecorder
                        disabled={form.text_only || busy || audioValidating}
                        onRecordingComplete={(recording) => {
                          setHouseStoryForms((current) => current.map((item, index) => index === position - 1
                            ? { ...item, audio_data: recording, remove_audio: false, text_only: false }
                            : item));
                          setError('');
                        }}
                      />
                      {!form.text_only && !form.remove_audio && (form.audio_data || story?.audio_clip_url) && <audio controls preload="none" className="h-10 w-full" src={form.audio_data || resolveApiUrl(story.audio_clip_url)}>Your browser does not support audio playback.</audio>}
                      {!form.text_only && !form.remove_audio && (form.audio_data || story?.audio_clip_url) && (
                        <button
                          type="button"
                          onClick={() => setHouseStoryForms((current) => current.map((item, index) => index === position - 1
                            ? {
                              ...item,
                              audio_data: '',
                              remove_audio: Boolean(!item.audio_data && story?.audio_clip_url),
                            }
                            : item))}
                          className="text-[10px] font-bold text-red-700"
                        >{form.audio_data && story?.audio_clip_url ? 'Discard replacement recording' : 'Remove recording'}</button>
                      )}
                      {form.remove_audio && <p className="text-[10px] text-orange">The current recording will be removed when you publish this update.</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[10px] font-bold">Speaker
                          <input maxLength={80} value={form.speaker_name} onChange={(event) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1 ? { ...item, speaker_name: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-brown/15 px-2.5 py-2 text-xs font-normal"/>
                        </label>
                        <label className="block text-[10px] font-bold">Language / dialect
                          <input maxLength={80} value={form.dialect} onChange={(event) => setHouseStoryForms((current) => current.map((item, index) => index === position - 1 ? { ...item, dialect: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-brown/15 px-2.5 py-2 text-xs font-normal"/>
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="submit" disabled={busy || mediaUploadCount > 0 || audioValidating || capReached} className="flex-1 rounded-lg bg-green px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : mediaUploadCount ? 'Uploading media…' : audioValidating ? 'Checking audio…' : story ? 'Publish update' : 'Publish story'}</button>
                        {story && <button type="button" onClick={() => void removeHouseVoiceStory(position)} className="rounded-lg border border-red-200 px-3 py-2.5 text-[10px] font-bold text-red-700">Remove</button>}
                      </div>
                      {capReached && <p className="text-[10px] leading-4 text-red-700">No more updates until older publishes leave the rolling 48-hour limit.</p>}
                    </form>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === 'team' && canManageTeam && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <Panel title={isSuperAdmin ? 'Staff Activation Treasury' : 'Invite a staff member'} icon={isSuperAdmin ? Shield : Users}>
              {isSuperAdmin && (
                <div className="mb-5 rounded-xl bg-brown p-4 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-gold">Secure staff onboarding</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">Issue a one-time six-digit activation PIN. It expires in 24 hours and can only be redeemed once.</p>
                </div>
              )}
              <form onSubmit={createAccount} className="space-y-4">
                <label className="block text-xs font-bold">Staff phone number<input required type="tel" autoComplete="tel" pattern="(?:\+254|254|0)7[0-9]{8}" placeholder="+254712345678" value={accountForm.phone} onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/><span className="mt-1 block text-[10px] font-normal text-brown/50">The invited staff member will use this number to sign in.</span></label>
                <label className="block text-xs font-bold">Role<select value={accountForm.role} onChange={(event) => setAccountForm({ ...accountForm, role: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"><option value="creator">Creator · delegated publishing</option><option value="moderator">Moderator · community review</option><option value="admin">Admin · all site and staff control</option></select></label>
                {accountForm.role !== 'admin' && (
                  <div className="space-y-3 rounded-xl border border-brown/10 p-4">
                    <label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" checked={accountForm.can_manage_stories} onChange={(event) => setAccountForm({ ...accountForm, can_manage_stories: event.target.checked })} className="mt-0.5 h-4 w-4 accent-green"/> May manage festival stories</label>
                    <label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" checked={accountForm.can_manage_live} onChange={(event) => setAccountForm({ ...accountForm, can_manage_live: event.target.checked })} className="mt-0.5 h-4 w-4 accent-green"/> May manage live sessions and chat</label>
                    <label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" checked={accountForm.can_scan_tickets} onChange={(event) => setAccountForm({ ...accountForm, can_scan_tickets: event.target.checked })} className="mt-0.5 h-4 w-4 accent-green"/> May scan and validate paid festival tickets</label>
                    <div>
                      <p className="text-xs font-bold">May curate these house voices</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {houses.map((house) => <label key={house} className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={accountForm.house_names.includes(house)} onChange={(event) => setAccountForm(current => ({ ...current, house_names: event.target.checked ? [...current.house_names, house] : current.house_names.filter(name => name !== house) }))} className="h-3.5 w-3.5 accent-green"/>{house}</label>)}
                      </div>
                    </div>
                  </div>
                )}
                <p className="rounded-lg bg-offwhite p-3 text-[11px] leading-5 text-brown/60">The invite expires in 24 hours. The staff member chooses their own name, email and password when they activate it.</p>
                <button disabled={busy} className="w-full rounded-lg bg-green px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">{busy ? 'Generating secure PIN…' : 'Generate activation PIN'}</button>
              </form>
              {generatedInvite && (
                <div className="mt-5 rounded-xl border-2 border-gold bg-brown p-5 text-center text-white shadow-lg">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">One-time activation PIN</p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                    <code className="text-4xl font-black tracking-[.3em] text-gold">{generatedInvite.code}</code>
                    <button type="button" onClick={() => void copyActivationCode()} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brown hover:bg-gold">Copy PIN</button>
                  </div>
                  <p className="mt-3 text-[10px] text-white/65">For <span className="font-bold text-gold">{generatedInvite.phone}</span> · Expires {new Date(generatedInvite.expires_at).toLocaleString()}.</p>
                  <a
                    href={`https://wa.me/${generatedInvite.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`You are invited to Kokwet staff. Activate your account at ${window.location.origin}/activate with code ${generatedInvite.code}. This code expires in 24 hours.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white"
                  >Open WhatsApp message</a>
                </div>
              )}
              <div className="mt-6 border-t border-brown/10 pt-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-brown/65">Recent invitations</h3>
                <div className="mt-3 space-y-2">
                  {invitations.map((invitation) => (
                    <article key={invitation.activation_id} className="flex items-center justify-between gap-3 rounded-lg bg-offwhite px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{invitation.phone} · {invitation.role}</p>
                        <p className="text-[10px] capitalize text-brown/55">{invitation.status} · expires {new Date(invitation.expires_at).toLocaleString()}</p>
                      </div>
                      {invitation.status === 'pending' && <button type="button" onClick={() => void revokeInvitation(invitation.activation_id)} className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-700">Revoke</button>}
                    </article>
                  ))}
                  {!invitations.length && <p className="text-xs text-brown/50">No staff invitations have been issued.</p>}
                </div>
              </div>
            </Panel>
            <Panel title="Role and account access" icon={Shield}>
              <div className="space-y-3">
                {users.map((user) => (
                  <article key={user.staff_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brown/10 p-4">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-brown">{user.full_name}{user.is_super_admin ? ' · Protected root account' : ''}</p><p className="truncate text-xs text-brown/55">{user.phone || 'No phone on record'} · {user.email}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${user.is_active ? 'bg-green/10 text-green' : 'bg-red-50 text-red-700'}`}>{user.is_active ? 'Active' : 'Disabled'}</span></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label={`Role for ${user.email}`} value={user.is_super_admin ? 'super_admin' : user.role} disabled={user.is_super_admin} onChange={(event) => void updateAccount(user.staff_id, { role: event.target.value })} className="rounded-lg border border-brown/15 bg-white px-2.5 py-2 text-xs disabled:bg-offwhite">{user.is_super_admin && <option value="super_admin">Super Admin</option>}<option value="admin">Admin</option><option value="moderator">Moderator</option><option value="creator">Creator</option></select>
                      <button type="button" disabled={user.is_super_admin} onClick={() => void updateAccount(user.staff_id, { is_active: !user.is_active })} className="rounded-lg border border-brown/15 px-3 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40">{user.is_active ? 'Disable' : 'Enable'}</button>
                      <button type="button" disabled={user.is_super_admin} onClick={() => void removeAccount(user)} className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
                    </div>
                    {!user.is_super_admin && user.role !== 'admin' && <details className="w-full border-t border-brown/10 pt-3">
                      <summary className="cursor-pointer text-xs font-bold text-green">Delegated access</summary>
                      <div className="mt-3 space-y-3">
                        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={user.can_manage_stories} onChange={(event) => void updateAccount(user.staff_id, { can_manage_stories: event.target.checked })} className="h-4 w-4 accent-green"/>Manage festival stories</label>
                        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={user.can_manage_live} onChange={(event) => void updateAccount(user.staff_id, { can_manage_live: event.target.checked })} className="h-4 w-4 accent-green"/>Manage live sessions and chat</label>
                        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={user.can_scan_tickets} onChange={(event) => void updateAccount(user.staff_id, { can_scan_tickets: event.target.checked })} className="h-4 w-4 accent-green"/>Scan and validate paid festival tickets</label>
                        <div>
                          <p className="text-xs font-bold">House voices</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {houses.map((house) => <label key={house} className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={user.house_names.includes(house)} onChange={(event) => void updateAccount(user.staff_id, { house_names: event.target.checked ? [...user.house_names, house] : user.house_names.filter(name => name !== house) })} className="h-3.5 w-3.5 accent-green"/>{house}</label>)}
                          </div>
                        </div>
                      </div>
                    </details>}
                    {user.is_super_admin && isSuperAdmin && (
                      <form onSubmit={changeRootPassword} className="flex w-full flex-wrap gap-2 border-t border-brown/10 pt-3">
                        <label className="sr-only" htmlFor="root-password">New Super Admin password</label>
                        <input id="root-password" type="password" autoComplete="new-password" minLength={16} maxLength={256} required value={rootPassword} onChange={(event) => setRootPassword(event.target.value)} placeholder="New password (at least 16 characters)" className="min-w-[220px] flex-1 rounded-lg border border-brown/15 px-3 py-2 text-xs"/>
                        <button type="submit" className="rounded-lg bg-brown px-4 py-2 text-[10px] font-bold text-white">Change password</button>
                      </form>
                    )}
                  </article>
                ))}
                {!users.length && <p className="text-sm text-brown/55">No staff accounts have been provisioned.</p>}
              </div>
            </Panel>
          </div>
        )}

        <p className="mt-5 flex items-center gap-2 text-[10px] text-brown/45"><ChevronRight size={13}/> Changes are saved to the Kokwet database and visible according to each staff member’s role.</p>
      </div>
    </section>
  );
}
