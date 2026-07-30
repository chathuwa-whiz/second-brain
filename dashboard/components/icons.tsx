/* Inline stroke icons - no icon dependency, and stroke-width tuned to match
   the interface's hairlines rather than a library's defaults. */

type P = { className?: string };
const base = "h-[18px] w-[18px]";

function S({ children, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? base}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: P) => (
  <S {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
    <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
  </S>
);

export const IconApprovals = (p: P) => (
  <S {...p}>
    <path d="M9 11.5 11.5 14 15.5 9.5" />
    <path d="M20.5 12a8.5 8.5 0 1 1-3.2-6.65" />
  </S>
);

export const IconActivity = (p: P) => (
  <S {...p}>
    <path d="M3 12h4l2.5-6.5L14 18.5 16.5 12H21" />
  </S>
);

export const IconJobs = (p: P) => (
  <S {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M3 12h18" />
  </S>
);

export const IconResumes = (p: P) => (
  <S {...p}>
    <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z" />
    <path d="M14 3v4h4" />
    <path d="M9 13h6M9 16.5h4" />
  </S>
);

export const IconModules = (p: P) => (
  <S {...p}>
    <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
    <path d="M4 7.5 12 12l8-4.5M12 12v9" />
  </S>
);

export const IconSettings = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
  </S>
);

export const IconSun = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
  </S>
);

export const IconMoon = (p: P) => (
  <S {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </S>
);

export const IconAuto = (p: P) => (
  <S {...p}>
    <rect x="2.5" y="5" width="19" height="13" rx="2.5" />
    <path d="M8.5 21h7M12 18v3" />
  </S>
);

export const IconSignOut = (p: P) => (
  <S {...p}>
    <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15" />
    <path d="M10 8.5 6.5 12 10 15.5M6.5 12H16" />
  </S>
);

export const IconExternal = (p: P) => (
  <S {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5v4A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
  </S>
);

export const IconMenu = (p: P) => (
  <S {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </S>
);
