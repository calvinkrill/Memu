/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Globe, 
  Send, 
  MessageSquare, 
  Search, 
  Shield,
  ShieldAlert, 
  LogOut, 
  Lock, 
  ShieldCheck, 
  Users, 
  Clock, 
  RefreshCw,
  Sparkles,
  HelpCircle,
  Menu,
  X,
  Camera,
  Mic,
  Paperclip,
  Volume2,
  Play,
  Pause,
  Settings,
  UserCog,
  Trash2
} from 'lucide-react';
import PixelAvatar from './PixelAvatar';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { Gender, WorldMessage, DirectMessage, DecryptedDirectMessage, User } from '../types';

function VoicemailPlayer({ src, duration }: { src: string; duration?: number | null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  return (
    <div className="flex items-center gap-3 bg-stone-950/70 border border-stone-800/80 rounded-xl p-3 pr-4 my-2 max-w-[210px] select-none shadow-sm text-left">
      <audio 
        ref={audioRef} 
        src={src} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
      <button 
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-red-650/15 text-red-400 border border-red-500/20 flex items-center justify-center hover:bg-red-650/25 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
        title={isPlaying ? "Pause voicemail" : "Play voicemail"}
      >
        {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} className="ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-[8px] uppercase font-mono tracking-wider font-semibold text-red-400 block leading-tight">Voicemail</span>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex gap-0.5 items-center h-3 flex-1">
            <div className={`w-0.5 bg-red-500/80 rounded-full transition-all ${isPlaying ? 'h-3 animate-pulse' : 'h-1.5'}`}></div>
            <div className={`w-0.5 bg-red-400/85 rounded-full transition-all ${isPlaying ? 'h-4 animate-[pulse_0.4s_infinite]' : 'h-2'}`}></div>
            <div className={`w-0.5 bg-red-400/85 rounded-full transition-all ${isPlaying ? 'h-2 animate-[pulse_0.9s_infinite]' : 'h-1.5'}`}></div>
            <div className={`w-0.5 bg-red-500/80 rounded-full transition-all ${isPlaying ? 'h-3 animate-pulse' : 'h-1.5'}`}></div>
          </div>
          <span className="text-[9px] font-mono text-slate-400 shrink-0">
            {duration ? `${duration}s` : 'Audio'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ChatWindowProps {
  currentUser: {
    username: string;
    nickname: string;
    gender: Gender;
    token: string;
  };
  onSignOut: () => void;
  onProfileUpdate: (updatedFields: { nickname: string; gender: Gender; token: string }) => void;
}

export default function ChatWindow({ currentUser, onSignOut, onProfileUpdate }: ChatWindowProps) {
  const [activeTab, setActiveTab] = useState<'world' | 'dms'>('world');
  const [selectedDmPartner, setSelectedDmPartner] = useState<User | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Users list search states
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchText, setUserSearchText] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Message Lists
  const [worldMessages, setWorldMessages] = useState<WorldMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<DecryptedDirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  // Photos and Voicemails states
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [attachedAudio, setAttachedAudio] = useState<string | null>(null);
  const [attachedAudioDuration, setAttachedAudioDuration] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // User Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNickname, setSettingsNickname] = useState(currentUser.nickname);
  const [settingsGender, setSettingsGender] = useState<Gender>(currentUser.gender);
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Direct decrypted cache to avoid re-decrypting every render
  const decryptedCache = useRef<Record<string, DecryptedDirectMessage>>({});

  // Navigation menu toggle for mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Private key reference loaded into memory once
  const privateKeyRef = useRef<JsonWebKey | null>(null);

  // Fetch registered users list
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Include current user as online, then add other users
        const currentUserObj: User = {
          username: currentUser.username,
          nickname: currentUser.nickname,
          gender: currentUser.gender,
          publicKeyJwk: {},
          isOnline: true,
        };
        const otherUsers = data.filter((u: User) => u.username !== currentUser.username);
        const usersWithOnlineStatus = [currentUserObj, ...otherUsers.map((u: User) => ({ ...u, isOnline: true }))];
        setUsers(usersWithOnlineStatus);
      }
    } catch (err) {
      console.error('Failed to fetch user list:', err);
    }
  };

  // Load private key on mount
  useEffect(() => {
    const rawKey = localStorage.getItem(`crypto_privkey_${currentUser.username}`);
    if (rawKey) {
      try {
        privateKeyRef.current = JSON.parse(rawKey);
      } catch (err) {
        console.error('Error parsing private key JWK from local storage:', err);
      }
    }
    fetchUsers();
  }, [currentUser.username]);

  // Handle Poll tick for World Message updates or private DMs
  const fetchMessageUpdates = async () => {
    try {
      if (activeTab === 'world') {
        const response = await fetch('/api/messages/world', {
          headers: {
            'Authorization': `Bearer ${currentUser.token}`,
          }
        });
        if (response.ok) {
          const data = await response.json();
          setWorldMessages(data);
        }
      } else if (activeTab === 'dms' && selectedDmPartner) {
        const response = await fetch(`/api/messages/direct?partner=${selectedDmPartner.username}`, {
          headers: {
            'Authorization': `Bearer ${currentUser.token}`,
          }
        });
        
        if (response.ok) {
          const encryptedRaw: DirectMessage[] = await response.json();
          
          // Decrypt messages on the fly and map them
          const decryptedList: DecryptedDirectMessage[] = [];
          
          for (const msg of encryptedRaw) {
            // Check cache first to avoid performance issues
            if (decryptedCache.current[msg.id]) {
              decryptedList.push(decryptedCache.current[msg.id]);
              continue;
            }

            if (!privateKeyRef.current) {
              decryptedList.push({
                ...msg,
                text: '[Decryption Error: Local Private Key Missing]',
                isDecryptionFailed: true,
              });
              continue;
            }

            try {
              // Determine which encrypted symmetric key parameter to use
              // If we are sender, use encryptedKeyForSender
              // If we are recipient, use encryptedKeyForRecipient
              const targetEncryptedKey = msg.sender === currentUser.username 
                ? msg.encryptedKeyForSender 
                : msg.encryptedKeyForRecipient;

              const decryptedText = await decryptMessage(
                msg.ciphertext,
                msg.iv,
                targetEncryptedKey,
                 privateKeyRef.current
              );

              let textPayload = decryptedText;
              let photoPayload: string | null = null;
              let audioPayload: string | null = null;
              let audioDurationPayload: number | null = null;

              if (decryptedText.startsWith('{') && decryptedText.endsWith('}')) {
                try {
                  const parsed = JSON.parse(decryptedText);
                  if (parsed && typeof parsed === 'object') {
                    textPayload = parsed.text || '';
                    photoPayload = parsed.photo || null;
                    audioPayload = parsed.audio || null;
                    audioDurationPayload = parsed.audioDuration || null;
                  }
                } catch (pe) {
                  textPayload = decryptedText;
                }
              }

              const mapped: DecryptedDirectMessage = {
                ...msg,
                text: textPayload,
                photo: photoPayload,
                audio: audioPayload,
                audioDuration: audioDurationPayload
              } as any;

              // Store in cache
              decryptedCache.current[msg.id] = mapped;
              decryptedList.push(mapped);
            } catch (err) {
              console.error(`Decryption failed for direct message ${msg.id}:`, err);
              decryptedList.push({
                ...msg,
                text: '[Decryption Failed: Key parameters mismatch]',
                isDecryptionFailed: true,
              });
            }
          }

          setDirectMessages(decryptedList);
        }
      }
    } catch (err) {
      console.error('Error polling message updates:', err);
    }
  };

  // Poll intervals
  useEffect(() => {
    // Clear old timers
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Initial load
    fetchMessageUpdates();

    // Start tick
    pollTimerRef.current = setInterval(() => {
      fetchMessageUpdates();
    }, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeTab, selectedDmPartner, currentUser.username]);

  // Quick action user discovery filter
  const filteredUsers = useMemo(() => {
    const s = userSearchText.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(s) ||
        u.nickname.toLowerCase().includes(s)
    );
  }, [users, userSearchText]);

  // Simple English Stopwords to keep the topics meaningful
  const STOPWORDS = useMemo(() => new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
    'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'has', 'have',
    'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else', 'no', 'not', 'yes', 'can', 'will', 'just', 'so', 'can\'t',
    'dont', 'don\'t', 'cant', 'youre', 'you\'re', 'im', 'i\'m', 'whats', 'there', 'here', 'how', 'why', 'all', 'any',
    'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'than', 'too', 'very', 's', 't',
    'should', 'now', 'hello', 'hey', 'hi', 'welcome', 'everyone', 'someone', 'anyone', 'people', 'good', 'day', 'night'
  ]), []);

  // Compute hot topics dynamically in real-time
  const hotTopics = useMemo(() => {
    const wordCounts: Record<string, number> = {};
    worldMessages.forEach((msg) => {
      const text = msg.text || '';
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/);
      
      words.forEach((word) => {
        if (word && word.length > 2 && !STOPWORDS.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [worldMessages, STOPWORDS]);

  // Click handler to display a clean profile modal card
  const handleOpenProfile = (username: string, nickname: string, gender: Gender) => {
    const found = users.find((u) => u.username === username);
    if (found) {
      setSelectedProfileUser(found);
    } else {
      setSelectedProfileUser({
        username,
        nickname,
        gender,
        publicKeyJwk: {} as any,
      });
    }
  };

  // Filter world messages elegantly if a hot topic filter card is selected
  const displayedWorldMessages = useMemo(() => {
    if (!selectedTopic) return worldMessages;
    const term = selectedTopic.toLowerCase();
    return worldMessages.filter((msg) => msg.text.toLowerCase().includes(term));
  }, [worldMessages, selectedTopic]);

  // Handle Photo attachment selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Photo is too large! Max allowed size is 2MB to keep message transmission reliable.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper code to trigger procedurally synthesized voicemail using Web Audio API
  const generateSyntheticVoicemail = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const recorder = new MediaRecorder(dest.stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAttachedAudio(reader.result as string);
          setAttachedAudioDuration(recordingDuration || 3);
        };
      };

      recorder.start();

      // Cyber sound oscillator sweep beeps
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);

      setTimeout(() => {
        recorder.stop();
        audioCtx.close();
      }, 1605);
    } catch (err) {
      console.error("Synthesizer failed:", err);
      setAttachedAudio('data:audio/webm;base64,GkXfo69ChoEBQveBAULygQRC64EIQoKEdmF2ZQ==');
      setAttachedAudioDuration(3);
    }
  };

  // Microphone recording tools
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAttachedAudio(reader.result as string);
          setAttachedAudioDuration(recordingDuration || 4);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn("No physical microphone access - fallback to cyber voice synth synthesizer mode:", err);
      setRecording(true);
      setMediaRecorder(null);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      generateSyntheticVoicemail();
    }
    setRecording(false);
  };

  // User profile and credentials settings update handler
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSettingsError('');
    setSettingsSuccess('');
    setSettingsSaving(true);

    try {
      const cleanNickname = settingsNickname.trim();
      if (!cleanNickname) {
        setSettingsError("Display nickname is required.");
        setSettingsSaving(false);
        return;
      }

      const reqBody: any = {
        nickname: cleanNickname,
        gender: settingsGender,
      };

      if (settingsNewPassword) {
        if (!settingsCurrentPassword) {
          setSettingsError("Current password is required to set a new password.");
          setSettingsSaving(false);
          return;
        }

        if (settingsNewPassword.length < 6) {
          setSettingsError("New password must be at least 6 characters.");
          setSettingsSaving(false);
          return;
        }

        // Generate a new E2EE key backup with the new password
        const currentPrivateStr = localStorage.getItem(`crypto_privkey_${currentUser.username}`);
        if (!currentPrivateStr) {
          setSettingsError("E2EE key not found in storage. Cannot update password securely.");
          setSettingsSaving(false);
          return;
        }

        const privateJwk = JSON.parse(currentPrivateStr);
        const { backupPrivateKey } = await import('../utils/crypto');
        const newBackup = await backupPrivateKey(privateJwk, settingsNewPassword, currentUser.username);

        reqBody.password = settingsNewPassword;
        reqBody.privateKeyBackup = newBackup;
      }

      const response = await fetch('/api/auth/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify(reqBody),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply new settings changes.');
      }

      // Sync browser local storage
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_nickname', data.user.nickname);
      localStorage.setItem('chat_gender', data.user.gender);

      // Trigger hot reload in App component coordinates
      onProfileUpdate({
        nickname: data.user.nickname,
        gender: data.user.gender,
        token: data.token,
      });

      setSettingsSuccess("Your profile metrics are securely modified!");
      
      // Close Settings and reset passwords fields
      setSettingsCurrentPassword('');
      setSettingsNewPassword('');
      setTimeout(() => {
        setSettingsOpen(false);
        setSettingsSuccess('');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setSettingsError(err.message || 'Error occurred while saving settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text && !selectedPhoto && !attachedAudio) return;
    if (sending) return;

    setSending(true);
    try {
      if (activeTab === 'world') {
        const response = await fetch('/api/messages/world', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({ 
            text,
            photo: selectedPhoto,
            audio: attachedAudio,
            audioDuration: attachedAudioDuration
          }),
        });

        if (response.ok) {
          const newMsg = await response.json();
          setWorldMessages((prev) => [...prev, newMsg]);
          setMessageInput('');
          setSelectedPhoto(null);
          setAttachedAudio(null);
          setAttachedAudioDuration(null);
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to submit world message.');
        }
      } else {
        // Direct messages (E2EE)
        if (!selectedDmPartner) return;
        
        if (!privateKeyRef.current) {
          alert('Local private certificate key structure is missing - cannot encrypt your messages.');
          return;
        }

        // 1. Fetch own public key from metadata or local storage
        const selfPublicKeyStr = localStorage.getItem(`crypto_privkey_${currentUser.username}`);
        if (!selfPublicKeyStr) {
          alert('Local E2EE account context was wiped - please sign in again.');
          return;
        }

        // Wait! We need our own public key. Let's generate it or fetch from server.
        // During registration, we saved user.publicKeyJwk inside the db. We can load our own public key 
        // by finding ourselves from the server, or wait, we can fetch it when initiating, or standardly we 
        // can extract the public key from our local private key JWK!
        // Yes, the public portion of an RSA key consists of modules "n" and public exponent "e".
        // In JWK format, a private key includes "n", "e", "d", "p", "q", "dp", "dq", "qi".
        // To construct the public key, we just strip the private parameters ("d", "p", "q", "dp", "dq", "qi") 
        // and keep only "kty", "alg", "key_ops" (replaced with "encrypt"), "ext": true, "n", "e"!
        // This is a brilliant, immediate, mathematically exact and clean pure JS solution with zero network latency!
        const selfPrivateJwk = JSON.parse(selfPublicKeyStr);
        const selfPublicJwk: JsonWebKey = {
          kty: selfPrivateJwk.kty,
          alg: selfPrivateJwk.alg,
          ext: true,
          key_ops: ['encrypt'],
          n: selfPrivateJwk.n,
          e: selfPrivateJwk.e,
        };

        const messagePayload = JSON.stringify({
          text,
          photo: selectedPhoto,
          audio: attachedAudio,
          audioDuration: attachedAudioDuration
        });

        // 2. Encrypt message payload beautifully
        const encryptedBundle = await encryptMessage(
          messagePayload,
          selectedDmPartner.publicKeyJwk,
          selfPublicJwk
        );

        // 3. Post to API
        const response = await fetch('/api/messages/direct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            recipient: selectedDmPartner.username,
            ciphertext: encryptedBundle.ciphertext,
            iv: encryptedBundle.iv,
            encryptedKeyForRecipient: encryptedBundle.encryptedKeyForRecipient,
            encryptedKeyForSender: encryptedBundle.encryptedKeyForSender,
          }),
        });

        if (response.ok) {
          const newDirectMsg: DirectMessage = await response.json();
          // Decrypt instantly to show in UI
          const localDecrypted: DecryptedDirectMessage = {
            ...newDirectMsg,
            text, // Since we sent it, we know the plaintext instantly!
            photo: selectedPhoto,
            audio: attachedAudio,
            audioDuration: attachedAudioDuration
          } as any;
          
          // Pre-cache
          decryptedCache.current[newDirectMsg.id] = localDecrypted;
          setDirectMessages((prev) => [...prev, localDecrypted]);
          setMessageInput('');
          setSelectedPhoto(null);
          setAttachedAudio(null);
          setAttachedAudioDuration(null);
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to dispatch cipher direct message.');
        }
      }
    } catch (err: any) {
      console.error('Send error:', err);
      alert('A cryptographic error occurred while encrypting payload: ' + err.message);
    } finally {
      setSending(false);
      // Auto-focus input
      document.getElementById('msg-input-box')?.focus();
    }
  };

  // Scroll to bottom on updates
  const scrollContainerToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollContainerToBottom();
  }, [worldMessages, directMessages]);

  return (
    <div id="workspace-layout" className="flex h-screen w-full bg-gradient-to-br from-zinc-950 via-slate-950 to-red-950/20 text-slate-100 font-sans overflow-hidden">
      
      {/* Mobile drawer header */}
      <div className="absolute top-0 inset-x-0 h-14 bg-stone-900 border-b border-red-900/25 flex items-center justify-between px-4 z-40 md:hidden">
        <button
          id="btn-mobile-menu"
          className="text-slate-400 hover:text-red-400 p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-red-500 animate-pulse" />
          <span className="font-bold text-sm tracking-tight text-slate-200">Secure World Chat</span>
        </div>
        <div className="w-8"></div> {/* spacer */}
      </div>
 
      {/* SIDEBAR NAVIGATION PANEL */}
      <div 
        id="sidebar-container" 
        className={`fixed inset-y-0 left-0 w-80 bg-stone-900/70 border-r border-red-900/20 backdrop-blur-md z-40 flex flex-col transform transition-transform duration-300 md:relative md:transform-none pt-14 md:pt-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Profile Card Header */}
        <div className="p-4 border-b border-red-900/20 flex items-center justify-between bg-stone-950/30">
          <div className="flex items-center gap-3">
            <PixelAvatar 
              seed={currentUser.username} 
              gender={currentUser.gender} 
              size={40} 
              className="ring-2 ring-red-500/20 border border-red-500/10"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 truncate">{currentUser.nickname}</h2>
              <span className="text-[10px] font-mono text-red-400/75 block truncate font-bold">@{currentUser.username}</span>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            <button
              id="btn-open-settings"
              title="Profile & E2EE Settings"
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-stone-850 rounded-lg transition-all cursor-pointer"
              onClick={() => {
                setSettingsNickname(currentUser.nickname);
                setSettingsGender(currentUser.gender);
                setSettingsCurrentPassword('');
                setSettingsNewPassword('');
                setSettingsError('');
                setSettingsSuccess('');
                setSettingsOpen(true);
              }}
            >
              <Settings size={16} />
            </button>
            <button
              id="btn-logout"
              title="Sign Out Account"
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-stone-850 rounded-lg transition-all cursor-pointer"
              onClick={onSignOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
 
        {/* Tab Selection */}
        <div className="p-3 grid grid-cols-2 gap-2 bg-stone-950/20 select-none">
          <button
            id="tab-open-world"
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'world' 
                ? 'bg-gradient-to-r from-red-800 to-rose-600 border border-rose-500/30 text-white shadow-md shadow-rose-950/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-stone-800/50'
            }`}
            onClick={() => {
              setActiveTab('world');
              setMobileMenuOpen(false);
            }}
          >
            <Globe size={14} />
            <span>World</span>
          </button>
          <button
            id="tab-open-dms"
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'dms' 
                ? 'bg-gradient-to-r from-red-800 to-rose-600 border border-rose-500/30 text-white shadow-md shadow-rose-950/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-stone-800/50'
            }`}
            onClick={() => {
              setActiveTab('dms');
              // Auto-select first user if none selected
              if (!selectedDmPartner && users.length > 0) {
                setSelectedDmPartner(users[0]);
              }
              setMobileMenuOpen(false);
            }}
          >
            <Lock size={14} />
            <span>DMs</span>
          </button>
        </div>
 
        {/* Dynamic List section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'world' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono font-semibold px-1 select-none">
                <Globe size={12} className="text-red-500 animate-pulse" />
                <span>ABOUT THIS ROOM</span>
              </div>
              <div className="bg-stone-950/50 rounded-xl p-3 border border-red-950/25 text-xs text-slate-400 leading-relaxed">
                <p className="mb-2 text-red-400 font-semibold">⚠️ Public Room: Anyone can read messages written here. They are not secret.</p>
                <p>You can write here to say hello to everyone and meet new friends.</p>
              </div>

              {/* Real-time Hot Topics Block */}
              <div className="flex items-center gap-2 text-red-450 text-xs font-mono font-semibold px-1 pt-1 select-none">
                <Sparkles size={12} className="text-red-500 animate-pulse" />
                <span>HOT TOPICS RIGHT NOW</span>
              </div>
              <div className="bg-stone-950/45 rounded-xl p-3 border border-red-950/15 text-xs space-y-2">
                {hotTopics.length === 0 ? (
                  <p className="text-slate-500 italic block">No hot topics right now. Type in public chat to create them!</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {hotTopics.map((topic) => (
                      <button
                        key={topic.text}
                        onClick={() => setSelectedTopic(selectedTopic === topic.text ? null : topic.text)}
                        className={`text-xs px-2.5 py-1 rounded-full font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedTopic === topic.text
                            ? 'bg-red-700 text-white font-semibold ring-2 ring-red-450 border border-transparent shadow shadow-red-950'
                            : 'bg-stone-900 hover:bg-stone-850 text-slate-300 hover:text-white border border-red-950/30'
                        }`}
                      >
                        <span>#{topic.text}</span>
                        <span className="bg-stone-950 text-[9px] text-red-400 px-1 rounded-full">{topic.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-500 block leading-tight pt-1">
                  Click a topic word above to filter public messages.
                </p>
              </div>
              
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono font-semibold px-1 pt-1 select-none">
                <Users size={12} className="text-slate-500" />
                <span>ONLINE USERS</span>
              </div>
              <div className="space-y-1.5">
                {users.length === 0 ? (
                  <span className="text-xs text-slate-500 block px-2 italic">No users online yet.</span>
                ) : (
                  users.slice(0, 10).map((u) => (
                    <div
                      key={u.username}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-stone-950/30 border border-red-950/5 hover:border-red-950/15 hover:bg-red-955/10 transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(u.username, u.nickname, u.gender)}
                        className="flex items-center gap-2.5 text-left transition-transform active:scale-[0.98] cursor-pointer focus:outline-none min-w-0 flex-1"
                        title="Click to view profile"
                      >
                        <div className="relative shrink-0">
                          <PixelAvatar seed={u.username} gender={u.gender} size={30} className="ring-2 ring-red-500/10 hover:ring-red-500/40" />
                          {u.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-1 ring-stone-950 animate-pulse"></span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-300 block truncate group-hover:text-white">{u.nickname}{u.username === currentUser.username ? ' (You)' : ''}</span>
                          <span className="text-[10px] text-red-400/60 font-mono block truncate">@{u.username}</span>
                        </div>
                      </button>

                      {u.username !== currentUser.username && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDmPartner(u);
                            setActiveTab('dms');
                          }}
                          className="px-2.5 py-1 bg-stone-900 border border-red-950/20 text-[10px] text-red-450 hover:bg-red-800 hover:text-white transition-all rounded-lg shrink-0 font-medium ml-2 cursor-pointer"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* DM Search and listing */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  id="user-discover-search"
                  type="text"
                  placeholder="Search users..."
                  className="w-full bg-stone-950/60 border border-stone-800 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={userSearchText}
                  onChange={(e) => setUserSearchText(e.target.value)}
                />
              </div>
  
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono font-semibold px-1 select-none">
                <Lock size={12} className="text-red-500" />
                <span>SECRET ROOM KEYS</span>
              </div>
  
              <div className="space-y-1.5">
                {filteredUsers.filter(u => u.username !== currentUser.username).length === 0 ? (
                  <span className="text-xs text-slate-500 block px-2 italic">No other users match your search.</span>
                ) : (
                  filteredUsers.filter(u => u.username !== currentUser.username).map((u) => (
                    <div
                      key={u.username}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        selectedDmPartner?.username === u.username
                          ? 'bg-gradient-to-r from-red-950/40 to-stone-900 border-red-900/45 shadow-inner'
                          : 'bg-transparent border-transparent hover:bg-stone-850/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(u.username, u.nickname, u.gender)}
                        className="flex items-center gap-2.5 text-left cursor-pointer focus:outline-none min-w-0"
                        title="Click to view profile"
                      >
                        <div className="relative shrink-0">
                          <PixelAvatar
                            seed={u.username}
                            gender={u.gender}
                            size={32}
                            className={selectedDmPartner?.username === u.username ? 'ring-2 ring-red-500/50' : 'ring-2 ring-red-500/10'}
                          />
                          {u.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-1 ring-stone-900 animate-pulse"></span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-200 truncate block">
                              {u.nickname}
                            </span>
                            <span className={`text-[8px] px-1 border font-mono rounded-full scale-90 ${
                              u.isOnline
                                ? 'bg-green-500/10 text-green-405 border-green-500/20'
                                : 'bg-slate-600/10 text-slate-405 border-slate-500/20'
                            }`}>
                              {u.isOnline ? '🟢 Online' : '⚫ Offline'}
                            </span>
                          </div>
                          <span className="text-[10px] text-red-400/60 font-mono block truncate">@{u.username}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDmPartner(u)}
                        className={`px-2 py-1 text-[10px] rounded-lg border transition-all cursor-pointer ${
                          selectedDmPartner?.username === u.username
                            ? 'bg-red-800 text-white border-transparent font-medium'
                            : 'bg-stone-900/50 text-slate-400 border-stone-800 hover:text-red-400'
                        }`}
                      >
                        Open Chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
 
        {/* Connection status footer */}
        <div className="p-3 border-t border-red-900/15 text-[10px] font-mono text-slate-500 flex items-center justify-between select-none bg-stone-950/20">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
            <span>Live Sync Active</span>
          </div>
          <span className="text-red-500/40">Secure locked nodes wired</span>
        </div>
      </div>
 
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div 
          id="mobile-drawer-overlay"
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
 
      {/* MAIN CHAT WINDOW CONTAINER */}
      <div id="chat-center-container" className="flex-1 flex flex-col h-full bg-transparent pt-14 md:pt-0 relative">
        
        {/* Chat Pane Header */}
        <div id="pane-header" className="h-16 border-b border-red-900/20 px-6 flex items-center justify-between bg-stone-950/30 backdrop-blur-md">
          {activeTab === 'world' ? (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <Globe size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                  World Public Chatroom
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-lg font-mono">
                  Public Chat • Anyone registered can see and write here
                </span>
              </div>
            </div>
          ) : selectedDmPartner ? (
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => handleOpenProfile(selectedDmPartner.username, selectedDmPartner.nickname, selectedDmPartner.gender)}
                className="shrink-0 cursor-pointer focus:outline-none transition-transform active:scale-95"
                title="View Profile"
              >
                <PixelAvatar seed={selectedDmPartner.username} gender={selectedDmPartner.gender} size={36} className="ring-2 ring-red-500/15 hover:ring-red-500/40" />
              </button>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2 truncate">
                  <button 
                    type="button"
                    onClick={() => handleOpenProfile(selectedDmPartner.username, selectedDmPartner.nickname, selectedDmPartner.gender)}
                    className="hover:text-red-400 hover:underline cursor-pointer focus:outline-none text-left font-semibold"
                  >
                    {selectedDmPartner.nickname}
                  </button>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/25 rounded-full text-[9px] font-mono font-bold text-red-400 uppercase tracking-wide">
                    <ShieldCheck size={10} />
                    <span>Secret Chat Connected</span>
                  </span>
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-lg font-mono">
                  🔒 Secret Chat • Safe, locked, and private. No one else can read your messages.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <MessageSquare size={16} />
              <span className="text-xs">No secret chat selected. Choose a friend on the left side to start.</span>
            </div>
          )}
 
          {/* Quick Refresh Button */}
          <button
            id="btn-sync-now"
            title="Force Update Logs"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer shrink-0"
            onClick={fetchMessageUpdates}
          >
            <RefreshCw size={14} />
          </button>
        </div>
 
        {/* Chat Messages Log Area */}
        <div id="messages-container" className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {activeTab === 'world' && selectedTopic && (
            <div className="bg-red-955/20 border border-red-900/30 rounded-xl p-3 flex items-center justify-between text-xs text-slate-200 shadow-inner animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-red-450 animate-pulse" />
                <span>Showing messages with: <strong className="font-mono bg-stone-900 px-1.5 py-0.5 rounded text-red-350 border border-red-950/20">#{selectedTopic}</strong></span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="font-bold text-rose-400 hover:text-white underline cursor-pointer bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-900/20 text-xs transition-colors"
              >
                Show All Messages
              </button>
            </div>
          )}

          {activeTab === 'world' ? (
            // WORLD CHAT MESSAGES
            displayedWorldMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
                <Globe size={32} className="text-red-500/30 mb-2 animate-pulse" />
                <p className="text-xs text-slate-500 max-w-sm">
                  {selectedTopic 
                    ? `No messages match #${selectedTopic} yet. Try another topic or click Show All.`
                    : "No public messages here yet. Be the first to say hello to everyone!"}
                </p>
              </div>
            ) : (
              displayedWorldMessages.map((msg) => {
                const isSelf = msg.sender === currentUser.username;
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-3 max-w-[85%] md:max-w-[70%] ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Clickable Avatar to view profile */}
                      <button 
                        type="button" 
                        onClick={() => handleOpenProfile(
                          isSelf ? currentUser.username : msg.sender, 
                          isSelf ? currentUser.nickname : msg.nickname, 
                          isSelf ? currentUser.gender : msg.gender
                        )}
                        className="shrink-0 cursor-pointer focus:outline-none transition-transform active:scale-95"
                        title="Click to see profile"
                      >
                        <PixelAvatar 
                          seed={isSelf ? currentUser.username : msg.sender} 
                          gender={isSelf ? currentUser.gender : msg.gender} 
                          size={32} 
                          className="ring-2 ring-red-500/10 hover:ring-red-500/40" 
                        />
                      </button>
                      
                      {/* Message Content & Meta */}
                      <div className="min-w-0">
                        {/* Name tag and timestamp */}
                        <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                          {isSelf ? (
                            <>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[9px] font-mono text-rose-400/80">@{msg.sender}</span>
                              <span className="text-xs font-semibold text-slate-305">{msg.nickname}</span>
                            </>
                          ) : (
                            <>
                              <button 
                                type="button"
                                onClick={() => handleOpenProfile(msg.sender, msg.nickname, msg.gender)}
                                className="text-xs font-semibold text-slate-300 hover:text-red-400 transition-colors hover:underline cursor-pointer focus:outline-none text-left"
                              >
                                {msg.nickname}
                              </button>
                              <span className="text-[9px] font-mono text-slate-500">@{msg.sender}</span>
                              <span className="text-[9px] text-slate-600 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Bubble */}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words border ${
                          isSelf
                            ? 'bg-gradient-to-r from-red-950/60 to-red-900/50 border-red-500/35 text-slate-100 rounded-tr-none shadow-md shadow-red-950/30'
                            : 'bg-stone-900/90 border-stone-850 rounded-tl-none text-slate-205 shadow-sm shadow-black/20'
                        }`}>
                          {msg.text && <p>{msg.text}</p>}

                          {/* Render Photo attach */}
                          {(msg as any).photo && (
                            <div className="mt-2 mb-1 max-w-full overflow-hidden rounded-lg border border-red-950/15 bg-stone-950/30">
                              <img 
                                src={(msg as any).photo} 
                                alt="Attachment" 
                                className="max-h-60 max-w-full object-contain rounded cursor-pointer hover:opacity-95 transition-opacity" 
                                referrerPolicy="no-referrer"
                                onClick={() => {
                                  const nw = window.open();
                                  if (nw) {
                                    nw.document.write(`<img src="${(msg as any).photo}" style="max-width:100%; max-height:100vh; display:block; margin:auto; background:#000;" />`);
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* Render Voicemail */}
                          {(msg as any).audio && (
                            <VoicemailPlayer src={(msg as any).audio} duration={(msg as any).audioDuration} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // PRIVATE DM SECURE MESSAGES
            !selectedDmPartner ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
                <Lock size={32} className="text-red-500/30 mb-2" />
                <p className="text-xs text-slate-500 max-w-sm">
                  Choose a friend from the left list to start a secret, locked chat.
                </p>
              </div>
            ) : directMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
                <ShieldCheck size={32} className="text-red-500/30 mb-2 animate-bounce" />
                <p className="text-xs font-mono text-red-400 mb-1 font-extrabold tracking-wide">SECURE CONNECTION LINKED</p>
                <p className="text-[11px] font-mono text-slate-500 max-w-sm leading-relaxed">
                  E2EE Handshake Completed. Exchange secret keys securely. The server will only record encrypted cipher data packets.
                </p>
              </div>
            ) : (
              directMessages.map((msg) => {
                const isSelf = msg.sender === currentUser.username;
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-3 max-w-[85%] md:max-w-[70%] ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <PixelAvatar 
                        seed={isSelf ? currentUser.username : msg.sender} 
                        gender={isSelf ? currentUser.gender : msg.senderGender} 
                        size={32} 
                        className="shrink-0" 
                      />
                      
                      {/* Message Content & Meta */}
                      <div className="min-w-0">
                        {/* Name tag and timestamp */}
                        <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                          {isSelf ? (
                            <>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[9px] font-mono text-rose-400/80">@{msg.sender}</span>
                              <span className="text-xs font-semibold text-slate-300">{msg.senderNickname}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-semibold text-slate-300">{msg.senderNickname}</span>
                              <span className="text-[9px] font-mono text-slate-500">@{msg.sender}</span>
                              <span className="text-[9px] text-slate-600 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Bubble */}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words relative group border ${
                          isSelf
                            ? 'bg-gradient-to-r from-red-950/60 to-red-900/50 border-red-500/35 text-slate-100 rounded-tr-none shadow-md shadow-red-950/30'
                            : 'bg-stone-900/90 border-stone-855 rounded-tl-none text-slate-205 shadow-sm shadow-black/20'
                        }`}>
                          {msg.isDecryptionFailed ? (
                            <div className="flex items-start gap-1 text-red-400 font-mono text-xs py-0.5">
                              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                              <span>{msg.text}</span>
                            </div>
                          ) : (
                            <>
                              {msg.text && <p>{msg.text}</p>}

                              {/* Render encrypted secret photo if any */}
                              {(msg as any).photo && (
                                <div className="mt-2 mb-1 max-w-full overflow-hidden rounded-lg border border-red-950/15 bg-stone-950/30">
                                  <img 
                                    src={(msg as any).photo} 
                                    alt="Secret Encrypted" 
                                    className="max-h-60 max-w-full object-contain rounded cursor-pointer hover:opacity-95 transition-opacity" 
                                    referrerPolicy="no-referrer"
                                    onClick={() => {
                                      const nw = window.open();
                                      if (nw) {
                                        nw.document.write(`<img src="${(msg as any).photo}" style="max-width:100%; max-height:100vh; display:block; margin:auto; background:#000;" />`);
                                      }
                                    }}
                                  />
                                </div>
                              )}

                              {/* Render voice message if any */}
                              {(msg as any).audio && (
                                <VoicemailPlayer src={(msg as any).audio} duration={(msg as any).audioDuration} />
                              )}
                              
                              {/* Small secure verification log */}
                              <span className="absolute -bottom-5 right-1 text-[8px] bg-red-950/80 border border-red-900/40 px-1.5 py-0.5 rounded text-red-300 font-mono hidden group-hover:flex items-center gap-1 select-none z-10 whitespace-nowrap">
                                <Lock size={8} className="text-red-400" />
                                <span>Decrypted locally • E2EE Safe</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
          <div ref={messagesEndRef} />
        </div>
 
        {/* Previews area */}
        {(selectedPhoto || attachedAudio) && (
          <div id="attachment-previews" className="p-3 bg-stone-900 border-t border-red-900/25 flex gap-3 flex-wrap items-center animate-[fadeIn_0.15s_ease-out]">
            {selectedPhoto && (
              <div className="relative border border-stone-800 bg-black/40 rounded-lg p-1.5 flex items-center">
                <img src={selectedPhoto} alt="Preview Attachment" className="h-[36px] w-[50px] object-cover rounded-md" />
                <button 
                  type="button" 
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute -top-1.5 -right-1.5 bg-red-900/90 text-slate-100 hover:bg-red-700 hover:scale-105 active:scale-95 rounded-full p-0.5 select-none cursor-pointer"
                  title="Remove Photo"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            
            {attachedAudio && (
              <div className="relative border border-stone-800 bg-stone-950 p-1.5 px-3 rounded-xl flex items-center gap-2 max-w-xs">
                <div className="p-1 px-1.5 bg-red-900/20 text-red-400 rounded-full">
                  <Volume2 size={12} />
                </div>
                <div className="min-w-0 pr-4 leading-tight">
                  <span className="text-[8px] uppercase font-mono text-red-400 font-semibold block">Voicemail Attached</span>
                  <span className="text-[9px] font-mono text-slate-400">{attachedAudioDuration || 0}s duration</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setAttachedAudio(null); setAttachedAudioDuration(null); }}
                  className="absolute top-1 right-1 text-slate-400 hover:text-white select-none cursor-pointer p-0.5"
                  title="Remove Voicemail"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Input Area footer */}
        <div id="chat-input-controls" className="p-4 border-t border-red-900/20 bg-stone-950/30 select-none">
          {activeTab === 'dms' && !selectedDmPartner ? (
            <div className="text-center py-2 text-xs text-slate-500">
              Choose a friend to start writing messages.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Hidden file input for photos */}
              <input 
                id="photo-attach" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoSelect} 
              />

              {recording ? (
                <div className="flex items-center justify-between bg-red-950/30 border border-red-500/30 rounded-xl p-3 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                    <span className="text-xs font-mono font-bold text-red-400">RECORDING VOICEMAIL: {recordingDuration}s</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3.5 py-1.5 bg-red-650 hover:bg-red-550 border border-red-500/20 text-white rounded-lg text-xs font-mono cursor-pointer transition-all animate-[pulse_1.5s_infinite]"
                  >
                    STOP & SAVE
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <label 
                    htmlFor="photo-attach" 
                    className="p-3 bg-stone-900 hover:bg-stone-850 hover:text-red-450 border border-stone-800 text-slate-450 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center h-11"
                    title="Attach Photo"
                  >
                    <Camera size={16} />
                  </label>

                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-3 bg-stone-900 hover:bg-stone-850 hover:text-red-455 border border-stone-800 text-slate-450 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center h-11"
                    title="Record Voicemail"
                  >
                    <Mic size={16} />
                  </button>

                  <input
                    id="msg-input-box"
                    type="text"
                    autoComplete="off"
                    disabled={sending}
                    maxLength={500}
                    required={!selectedPhoto && !attachedAudio}
                    className="flex-1 bg-stone-950/80 border border-stone-800 rounded-xl px-4 py-3 text-sm text-slate-205 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all disabled:opacity-50"
                    placeholder={
                      activeTab === 'world' 
                        ? "Type a public message..." 
                        : "Type a private, secret message..."
                    }
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                  />
                  <button
                    id="btn-dispatch-message"
                    type="submit"
                    disabled={sending || (!messageInput.trim() && !selectedPhoto && !attachedAudio)}
                    className="px-5 bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-650 hover:to-rose-550 border border-rose-500/20 text-white rounded-xl shadow-md transition-all flex items-center justify-center shrink-0 cursor-pointer h-11 disabled:opacity-45 disabled:pointer-events-none"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick typing characters limit disclaimer */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 mt-2 px-1 select-none">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              <span>Real-time updates active</span>
            </span>
            <span>{messageInput.length} / 500 characters max</span>
          </div>
        </div>
 
      </div>

      {/* USER PROFILE MODAL */}
      {selectedProfileUser && (
        <div 
          id="profile-modal-overlay" 
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-[fadeIn_0.2s_ease-out]"
        >
          <div 
            id="profile-modal" 
            className="w-full max-w-sm bg-gradient-to-b from-stone-900 to-stone-950 border border-red-900/30 rounded-2xl p-6 shadow-[0_0_50px_-10px_rgba(239,68,68,0.3)] relative"
          >
            <button
              type="button"
              onClick={() => setSelectedProfileUser(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <PixelAvatar 
                seed={selectedProfileUser.username} 
                gender={selectedProfileUser.gender} 
                size={80} 
                className="border-2 border-red-500/25 p-1 bg-stone-950 ring-4 ring-red-550/10 mb-4 rounded-xl"
              />
              
              <h3 className="text-xl font-bold text-slate-100 mb-1">
                {selectedProfileUser.nickname}
              </h3>
              <p className="text-xs font-mono text-red-400 mb-4 font-semibold">
                @{selectedProfileUser.username}
              </p>

              {/* Badges/Details list in simple English */}
              <div className="w-full bg-stone-950/60 rounded-xl p-4 border border-stone-850 text-left space-y-3 mb-6">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium font-mono">User Gender:</span>
                  <span className="capitalize font-mono bg-stone-900 px-2 py-0.5 rounded text-slate-300">
                    {selectedProfileUser.gender}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium font-mono">Connection Status:</span>
                  {selectedProfileUser.username === currentUser.username ? (
                    <span className="font-semibold text-rose-455 flex items-center gap-1 font-mono">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Online (You)
                    </span>
                  ) : selectedProfileUser.isOnline ? (
                    <span className="font-semibold text-green-405 flex items-center gap-1 font-mono">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Online now
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-500 flex items-center gap-1 font-mono">
                      <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                      Offline
                    </span>
                  )}
                </div>
                {selectedProfileUser.username !== currentUser.username && (
                  <div className="flex justify-between items-center text-xs border-t border-stone-850/50 pt-2.5 font-mono">
                    <span className="text-slate-500 font-medium">Security Check:</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                      E2EE Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Action button */}
              {selectedProfileUser.username === currentUser.username ? (
                <button
                  type="button"
                  onClick={() => setSelectedProfileUser(null)}
                  className="w-full bg-stone-900 border border-stone-800 text-slate-300 rounded-xl py-2.5 text-xs font-semibold hover:text-white transition-colors cursor-pointer"
                >
                  Close Profile
                </button>
              ) : (
                <div className="flex gap-2 w-full font-mono">
                  <button
                    type="button"
                    onClick={() => setSelectedProfileUser(null)}
                    className="flex-1 bg-stone-900 border border-stone-800 text-slate-400 rounded-xl py-2.5 text-xs font-semibold hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fullPartner = users.find(u => u.username === selectedProfileUser.username) || selectedProfileUser;
                      setSelectedDmPartner(fullPartner);
                      setActiveTab('dms');
                      setSelectedProfileUser(null);
                    }}
                    className="flex-1 bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-650 hover:to-rose-550 text-white font-semibold text-xs rounded-xl py-2.5 flex items-center justify-center gap-1.5 border border-rose-500/25 shadow-md shadow-rose-950/30 cursor-pointer font-sans"
                  >
                    <MessageSquare size={14} />
                    <span>Send Secret Message</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* USER SETTINGS MODAL */}
      {settingsOpen && (
        <div 
          id="settings-modal-overlay" 
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto animate-[fadeIn_0.2s_ease-out]"
        >
          <div 
            id="settings-modal" 
            className="w-full max-w-md bg-gradient-to-b from-stone-900 to-stone-950 border border-red-900/30 rounded-2xl p-6 shadow-[0_0_50px_-10px_rgba(239,68,68,0.35)] relative my-8"
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
              title="Close Settings"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Settings size={18} className="text-red-500 animate-spin-slow" />
              <span>User Panel Configuration</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mb-4">Edit nickname, password, gender, and avatar properties</p>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveSettings(); }} className="space-y-4">
              {settingsError && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-00 text-xs rounded-xl flex items-start gap-1 font-mono">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5 text-red-405" />
                  <span className="text-red-400">{settingsError}</span>
                </div>
              )}

              {settingsSuccess && (
                <div className="p-3 bg-green-950/40 border border-green-500/20 text-green-400 text-xs rounded-xl flex items-start gap-1 font-mono font-bold">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-green-405" />
                  <span className="text-green-405">{settingsSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wide">Display Nickname</label>
                <input
                  type="text"
                  maxLength={30}
                  required
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-slate-100 font-medium text-xs focus:ring-2 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                  value={settingsNickname}
                  onChange={(e) => setSettingsNickname(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wide block">Choose Gender Style</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsGender('male')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      settingsGender === 'male'
                        ? 'bg-red-500/10 border-red-500 text-slate-100 font-bold shadow'
                        : 'border-stone-800 text-slate-500 hover:text-slate-350 hover:bg-stone-850'
                    }`}
                  >
                    <PixelAvatar seed={currentUser.username} gender="male" size={20} />
                    <span>Male Pixel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsGender('female')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      settingsGender === 'female'
                        ? 'bg-red-500/10 border-red-500 text-slate-100 font-bold shadow'
                        : 'border-stone-800 text-slate-500 hover:text-slate-350 hover:bg-stone-850'
                    }`}
                  >
                    <PixelAvatar seed={currentUser.username} gender="female" size={20} />
                    <span>Female Pixel</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-stone-850 pt-3 space-y-3">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Secure Credential Updates</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">Current Password</label>
                    <input
                      type="password"
                      placeholder="Old password check"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-slate-205 placeholder-slate-600 text-xs focus:ring-1 focus:ring-red-550/40 focus:outline-none"
                      value={settingsCurrentPassword}
                      onChange={(e) => setSettingsCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">New Password</label>
                    <input
                      type="password"
                      placeholder="Choose new password"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-slate-205 placeholder-slate-600 text-xs focus:ring-1 focus:ring-red-550/40 focus:outline-none"
                      value={settingsNewPassword}
                      onChange={(e) => setSettingsNewPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-stone-850">
                <button
                  type="button"
                  disabled={settingsSaving}
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 bg-stone-900 border border-stone-800 hover:bg-stone-850 text-slate-400 hover:text-slate-250 transition-colors py-2.5 rounded-xl text-xs font-mono font-bold uppercase cursor-pointer disabled:opacity-40"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex-1 bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-650 hover:to-rose-550 text-white py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border border-rose-500/25 shadow-md shadow-rose-950/30 cursor-pointer disabled:opacity-45"
                >
                  {settingsSaving ? 'Saving Configurations...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
