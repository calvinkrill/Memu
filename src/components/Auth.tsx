/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Sparkles, Shield, UserX, ArrowRight, Eye, EyeOff } from 'lucide-react';
import PixelAvatar from './PixelAvatar';
import { Logo } from './Logo';
import { generateE2EKeys, backupPrivateKey, recoverPrivateKey } from '../utils/crypto';
import { Gender } from '../types';

interface AuthProps {
  onSuccess: (userData: { token: string; username: string; nickname: string; gender: Gender }) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Auto-generate nickname if empty on tab change
  useEffect(() => {
    setError('');
  }, [isLogin]);

  useEffect(() => {
    if (isLogin) {
      setUsernameTaken(false);
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setUsernameTaken(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(cleanUsername)}`);
        if (response.ok) {
          const data = await response.json();
          setUsernameTaken(data.taken);
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Username is required.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Password is required.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        setPhaseMessage('Authenticating credentials...');
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Login failed.');
        }

        const { token, user } = data;

        // E2EE Key Recovery
        setPhaseMessage('Decrypting and recovering secure E2EE keys...');
        let privKeyStored = localStorage.getItem(`crypto_privkey_${user.username}`);
        
        if (!privKeyStored && user.privateKeyBackup) {
          try {
            const recoveredJwk = await recoverPrivateKey(user.privateKeyBackup, password, user.username);
            localStorage.setItem(`crypto_privkey_${user.username}`, JSON.stringify(recoveredJwk));
          } catch (recoveryErr) {
            console.error('Failed to recover private key:', recoveryErr);
            throw new Error('Successfully logged in, but failed to decrypt your local encryption keys. Your password may be mismatching your keys.');
          }
        }

        // Cache session credentials
        localStorage.setItem(`chat_token`, token);
        localStorage.setItem(`chat_username`, user.username);
        localStorage.setItem(`chat_nickname`, user.nickname);
        localStorage.setItem(`chat_gender`, user.gender);

        onSuccess({
          token,
          username: user.username,
          nickname: user.nickname,
          gender: user.gender,
        });

      } else {
        // Validation for registration
        if (usernameTaken) {
          setError('This username is already taken. Please choose a different one.');
          setLoading(false);
          return;
        }
        const cleanNickname = nickname.trim();
        if (!cleanNickname) {
          setError('Display nickname is required.');
          setLoading(false);
          return;
        }

        if (cleanUsername.length < 3) {
          setError('Username must be at least 3 characters.');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        // E2EE Key Generation
        setPhaseMessage('Generating high-entropy RSA-256 E2EE container keys...');
        const keys = await generateE2EKeys();

        // Backup private key using PBKDF2 GCM encryption from password
        setPhaseMessage('Securing private container with password protection...');
        const encryptedBackup = await backupPrivateKey(keys.privateKeyJwk, password, cleanUsername);

        setPhaseMessage('Creating secure global account...');
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            nickname: cleanNickname,
            password,
            gender,
            publicKeyJwk: keys.publicKeyJwk,
            privateKeyBackup: encryptedBackup,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        // Store private key locally
        localStorage.setItem(`crypto_privkey_${cleanUsername}`, JSON.stringify(keys.privateKeyJwk));
        localStorage.setItem(`chat_token`, data.token);
        localStorage.setItem(`chat_username`, data.user.username);
        localStorage.setItem(`chat_nickname`, data.user.nickname);
        localStorage.setItem(`chat_gender`, data.user.gender);

        onSuccess({
          token: data.token,
          username: data.user.username,
          nickname: data.user.nickname,
          gender: data.user.gender,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected cryptographic or network error occurred.');
    } finally {
      setLoading(false);
      setPhaseMessage('');
    }
  };

  return (
    <div id="auth-container" className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-br from-zinc-950 via-slate-950 to-red-950/30 text-slate-100 font-sans relative overflow-hidden">
      {/* Cool cyber grid overlay background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1917_1px,transparent_1px),linear-gradient(to_bottom,#1c1917_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25"></div>
      
      {/* Decorative colored glow lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div id="auth-card" className="w-full max-w-md bg-stone-900/80 border border-red-900/30 rounded-2xl shadow-[0_0_50px_-12px_rgba(239,68,68,0.25)] overflow-hidden p-8 relative z-10 backdrop-blur-xl">
        
        {/* Title area */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size={56} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 via-rose-200 to-amber-200 bg-clip-text text-transparent mb-2">
            Memu
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-mono mb-3">
            <Shield size={12} />
            <span>End-to-End Encrypted E2EE</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            No emails needed. Absolute zero-knowledge communication node.
          </p>
        </div>

        {/* Tab Switches */}
        <div className="flex border-b border-stone-800 mb-6 font-mono">
          <button
            id="tab-login"
            type="button"
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              isLogin
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
            onClick={() => {
              if (!loading) setIsLogin(true);
            }}
          >
            Sign In
          </button>
          <button
            id="tab-signup"
            type="button"
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              !isLogin
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
            onClick={() => {
              if (!loading) setIsLogin(false);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Avatar Live Preview (Signup only, but nice to show as a custom aesthetic!) */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            <PixelAvatar
              seed={username.trim() || 'default_preview_seed'}
              gender={gender}
              size={80}
              className="border-2 border-red-950/50 bg-stone-950 p-1 shadow-lg ring-4 ring-red-500/10"
            />
            {!isLogin && (
              <div className="absolute -bottom-2 bg-gradient-to-r from-red-600 to-rose-600 border border-rose-400 text-[10px] uppercase font-mono px-2 py-0.5 rounded shadow-md text-white flex items-center gap-1">
                <Sparkles size={8} />
                <span>Your Unique Avatar</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-6">
            <UserX size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-semibold">Username (Unique handle)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <UserIcon size={16} />
              </span>
              <input
                id="input-username"
                type="text"
                required
                disabled={loading}
                className="w-full bg-stone-950/80 border border-stone-850 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 select-all focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all disabled:opacity-50"
                placeholder="e.g. cyber_sam"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} // No spaces or symbols
              />
            </div>
            {username.trim().length >= 3 && !isLogin && (
              <div className="mt-1 text-xs font-mono">
                {checkingUsername ? (
                  <span className="text-slate-400">Checking availability...</span>
                ) : usernameTaken ? (
                  <span className="text-red-400">⚠️ Username is already taken by another user.</span>
                ) : (
                  <span className="text-emerald-400">✓ Username is available!</span>
                )}
              </div>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-semibold">Display Nickname</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Sparkles size={16} />
                </span>
                <input
                  id="input-nickname"
                  type="text"
                  required={!isLogin}
                  disabled={loading}
                  className="w-full bg-stone-950/80 border border-stone-850 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all disabled:opacity-50"
                  placeholder="e.g. Sam the Netrunner"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-semibold">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock size={16} />
              </span>
              <input
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                className="w-full bg-stone-950/80 border border-stone-850 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all disabled:opacity-50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                id="btn-show-password"
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-2 font-semibold">Choose Avatar Gender Variant</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="btn-gender-male"
                  type="button"
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 border rounded-xl py-2.5 text-xs transition-all ${
                    gender === 'male'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-medium shadow-sm shadow-rose-500/5'
                      : 'bg-stone-950/40 border-stone-850 text-slate-400 hover:bg-stone-950/80'
                  }`}
                  onClick={() => setGender('male')}
                >
                  <span className="text-sm">♂</span> Male Grid
                </button>
                <button
                  id="btn-gender-female"
                  type="button"
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 border rounded-xl py-2.5 text-xs transition-all ${
                    gender === 'female'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-medium shadow-sm shadow-rose-500/5'
                      : 'bg-stone-950/40 border-stone-850 text-slate-400 hover:bg-stone-950/80'
                  }`}
                  onClick={() => setGender('female')}
                >
                  <span className="text-sm">♀</span> Female Grid
                </button>
              </div>
            </div>
          )}

          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-550 border border-red-500/30 text-white rounded-xl py-3 text-sm font-semibold transition-all mt-6 shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-xs font-mono">{phaseMessage || 'Processing...'}</span>
              </div>
            ) : (
              <>
                <span>{isLogin ? 'Enter Secure World' : 'Initialize E2EE Node'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400 select-none">
          <p className="max-w-[280px] mx-auto text-[10px] leading-relaxed text-slate-500">
            * All local keys are stored strictly in-memory or inside your secure browser's local sandbox data partition. Keys never leave your machine unencrypted.
          </p>
        </div>

      </div>
    </div>
  );
}
