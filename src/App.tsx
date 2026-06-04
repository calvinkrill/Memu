/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import ChatWindow from './components/ChatWindow';
import { Gender } from './types';

interface AuthUser {
  username: string;
  nickname: string;
  gender: Gender;
  token: string;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Read session on boot
  useEffect(() => {
    const handleBoot = async () => {
      const token = localStorage.getItem('chat_token');
      const username = localStorage.getItem('chat_username');
      const nickname = localStorage.getItem('chat_nickname');
      const gender = localStorage.getItem('chat_gender') as Gender;

      if (token && username && nickname && gender) {
        try {
          // Check integrity of session with backend
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          });

          if (response.ok) {
            setUser({ token, username, nickname, gender });
          } else {
            // Token is stale or invalid, clean up local cache
            localStorage.removeItem('chat_token');
            localStorage.removeItem('chat_username');
            localStorage.removeItem('chat_nickname');
            localStorage.removeItem('chat_gender');
          }
        } catch (err) {
          console.error('Integrity fetch failed on boot:', err);
          // If server is temporarily unreachable, fallback to cached state to enable offline inspection
          setUser({ token, username, nickname, gender });
        }
      }
      setInitializing(false);
    };

    handleBoot();
  }, []);

  const handleAuthSuccess = (authenticatedPayload: {
    token: string;
    username: string;
    nickname: string;
    gender: Gender;
  }) => {
    setUser({
      token: authenticatedPayload.token,
      username: authenticatedPayload.username,
      nickname: authenticatedPayload.nickname,
      gender: authenticatedPayload.gender,
    });
  };

  const handleProfileUpdate = (updatedFields: { nickname: string; gender: Gender; token: string }) => {
    setUser((prev) => prev ? { ...prev, ...updatedFields } : null);
  };

  const handleSignOut = () => {
    // Clear credentials
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    localStorage.removeItem('chat_nickname');
    localStorage.removeItem('chat_gender');
    setUser(null);
  };

  if (initializing) {
    return (
      <div id="full-page-loader" className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">Connecting to Cryptic Node...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {user ? (
        <ChatWindow 
          currentUser={user} 
          onSignOut={handleSignOut} 
          onProfileUpdate={handleProfileUpdate}
        />
      ) : (
        <Auth onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

