const PINK = '#FF0083';

const ICONS = [
  <>
    <circle cx={48} cy={38} r={22} fill="#FFE6F3" />
    <path d="M38 66 H58 M40 76 H56" />
    <path d="M48 4 V10 M14 18 L20 24 M82 18 L76 24" stroke={PINK} />
  </>,
  <>
    <circle cx={30} cy={30} r={12} />
    <path d="M10 80 Q10 52 30 52 Q50 52 50 80" />
    <path d="M58 14 H92 V40 H74 L66 48 V40 H58Z" fill="#FFFFFF" />
    <path d="M68 27 H82" stroke={PINK} strokeWidth={3} />
  </>,
  <>
    <path d="M20 80 V44 H64 V80 Z M20 44 L34 30 H78 L64 44 M78 30 V66 L64 80" fill="#FFFFFF" />
    <path d="M20 58 H64 L78 44" stroke={PINK} strokeWidth={5} />
  </>,
  <>
    <circle cx={36} cy={50} r={26} />
    <circle cx={66} cy={40} r={22} fill={PINK} />
    <path d="M60 48 V38 Q60 32 66 32 Q72 32 72 38 V48" stroke="#FFFFFF" />
    <path d="M28 58 V46 Q28 40 36 40 Q44 40 44 46 V58" />
  </>,
  <>
    <path d="M16 40 V60 H28 L64 78 V22 L28 40 Z" fill="#FFFFFF" />
    <path d="M28 60 L34 80 H42 L38 62" />
    <path d="M74 36 Q82 50 74 64 M82 28 Q94 50 82 72" stroke={PINK} />
  </>,
  <>
    <rect x={12} y={10} width={72} height={50} rx={3} fill="#FFFFFF" />
    <path d="M26 50 V40 M40 50 V32 M54 50 V26" strokeWidth={5} />
    <path d="M68 50 V18" stroke={PINK} strokeWidth={5} />
    <path d="M30 60 L22 86 M66 60 L74 86 M48 60 V72" />
  </>,
];

export default function ModuleIcon({ index }: { index: number }) {
  return (
    <svg
      width={96}
      height={92}
      viewBox="0 0 96 92"
      fill="none"
      stroke="#1A1A1A"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[index]}
    </svg>
  );
}
