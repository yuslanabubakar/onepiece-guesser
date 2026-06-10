// Deterministic per-player "crew" color + retro pixel avatar badge.
// The same player id always maps to the same color so crew members are easy
// to tell apart across every screen.

interface CrewColor {
  bg: string;
  /** Text color that stays readable on top of `bg`. */
  fg: string;
}

const CREW_COLORS: CrewColor[] = [
  { bg: '#c8472c', fg: '#fefefe' }, // One Piece red
  { bg: '#105edd', fg: '#fefefe' }, // deep blue
  { bg: '#f8de3c', fg: '#412a1e' }, // straw-hat yellow
  { bg: '#2f9e44', fg: '#fefefe' }, // marine green
  { bg: '#58acf4', fg: '#06243f' }, // sky blue
  { bg: '#e8821e', fg: '#412a1e' }, // sunny orange
  { bg: '#9c46c4', fg: '#fefefe' }, // den den purple
  { bg: '#0b3075', fg: '#f8de3c' }, // navy + gold
];

export function getCrewColor(id: string): CrewColor {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return CREW_COLORS[hash % CREW_COLORS.length];
}

interface AvatarProps {
  id: string;
  name: string;
  /** Pixel size of the square badge. Defaults to 32. */
  size?: number;
  className?: string;
}

export function Avatar({ id, name, size = 32, className = '' }: AvatarProps) {
  const { bg, fg } = getCrewColor(id);
  const initial = (name.trim()[0] || '?').toUpperCase();

  return (
    <span
      className={`crew-avatar ${className}`}
      role="img"
      aria-label={`Avatar ${name}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}
