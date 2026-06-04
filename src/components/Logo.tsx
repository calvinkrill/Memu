export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <rect width="128" height="128" fill="#0f172a" />
      <circle cx="64" cy="64" r="58" fill="none" stroke="#dc2626" strokeWidth="2" opacity="0.3" />

      <g transform="translate(20, 25)">
        <rect x="0" y="0" width="6" height="70" fill="#dc2626" rx="3" />
        <rect x="82" y="0" width="6" height="70" fill="#dc2626" rx="3" />
        <path d="M 6 0 L 44 40" stroke="#dc2626" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 82 0 L 44 40" stroke="#dc2626" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 44 40 L 6 70" stroke="#f87171" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M 44 40 L 82 70" stroke="#f87171" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
        <circle cx="44" cy="40" r="5" fill="#fca5a5" opacity="0.9" />
      </g>

      <circle cx="108" cy="20" r="8" fill="#10b981" opacity="0.9" />
      <circle cx="108" cy="20" r="5" fill="#34d399" />
    </svg>
  );
}

export function LogoWithText({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={size} />
      <span className="text-xl font-bold bg-gradient-to-r from-red-400 via-rose-200 to-amber-200 bg-clip-text text-transparent">
        Memu
      </span>
    </div>
  );
}
