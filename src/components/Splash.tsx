import { useEffect, useState } from 'react';
import { Logo } from './Logo';

interface SplashProps {
  onComplete: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onComplete, 600);
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleClick = () => {
    setIsClosing(true);
    setTimeout(onComplete, 600);
  };

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-zinc-950 via-slate-950 to-red-950/30 flex items-center justify-center overflow-hidden z-50 transition-opacity duration-600 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClick}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1917_1px,transparent_1px),linear-gradient(to_bottom,#1c1917_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25"></div>

      {/* Decorative glow lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Main splash content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-md">
        {/* Logo with animation */}
        <div className="mb-6 animate-[bounce_2s_ease-in-out_infinite]">
          <Logo size={120} />
        </div>

        {/* Main title */}
        <h1 className="text-6xl font-black bg-gradient-to-r from-red-400 via-rose-300 to-amber-200 bg-clip-text text-transparent mb-2 tracking-tighter animate-[fadeIn_0.8s_ease-out_0.2s_backwards]">
          Memu
        </h1>

        {/* Subtitle with typewriter effect */}
        <p className="text-sm text-slate-300 font-mono mb-1 animate-[fadeIn_0.8s_ease-out_0.6s_backwards]">
          End-to-End Encrypted
        </p>

        {/* Tagline */}
        <p className="text-xs text-slate-400 font-mono mb-8 animate-[fadeIn_0.8s_ease-out_0.8s_backwards]">
          Zero-Knowledge Communication Node
        </p>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono animate-[fadeIn_0.8s_ease-out_1s_backwards]">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>Initializing Secure World...</span>
        </div>

        {/* Click hint */}
        <p className="text-[11px] text-slate-500 mt-12 animate-pulse">
          Click anywhere or wait to continue
        </p>
      </div>

      {/* Animated scan line effect */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 animate-[scanLine_3s_ease-in-out_infinite]"></div>
      </div>
    </div>
  );
}
