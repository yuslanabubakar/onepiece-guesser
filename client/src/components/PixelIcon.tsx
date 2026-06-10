// Retro pixel icons sourced from pixelarticons (MIT). Each SVG uses
// fill="currentColor" so the icon inherits the surrounding text color, and
// is sized through the wrapper span (e.g. className="w-4 h-4").
import volumeOn from 'pixelarticons/svg/volume-3.svg?raw';
import volumeOff from 'pixelarticons/svg/volume.svg?raw';
import copy from 'pixelarticons/svg/copy.svg?raw';
import check from 'pixelarticons/svg/check.svg?raw';
import users from 'pixelarticons/svg/users.svg?raw';
import crown from 'pixelarticons/svg/crown.svg?raw';
import logout from 'pixelarticons/svg/logout.svg?raw';
import play from 'pixelarticons/svg/play.svg?raw';
import send from 'pixelarticons/svg/arrow-right.svg?raw';
import close from 'pixelarticons/svg/close.svg?raw';
import reload from 'pixelarticons/svg/reload.svg?raw';
import message from 'pixelarticons/svg/message.svg?raw';
import userX from 'pixelarticons/svg/user-x.svg?raw';
import bookOpen from 'pixelarticons/svg/book-open.svg?raw';
import skull from 'pixelarticons/svg/skull.svg?raw';
import shuffle from 'pixelarticons/svg/shuffle.svg?raw';
import scroll from 'pixelarticons/svg/scroll-vertical.svg?raw';
import comment from 'pixelarticons/svg/comment.svg?raw';
import clock from 'pixelarticons/svg/clock.svg?raw';
import trophy from 'pixelarticons/svg/trophy.svg?raw';
import penSquare from 'pixelarticons/svg/pen-square.svg?raw';

// Custom pixel-art Den Den Mushi (snail) mascot — no equivalent exists in the
// icon set, so it is hand-built on a pixel grid to match the retro theme.
const snail =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="2" width="2" height="2"/><rect x="6" y="2" width="2" height="2"/><rect x="8" y="2" width="2" height="2"/><rect x="10" y="2" width="2" height="2"/><rect x="12" y="2" width="2" height="2"/><rect x="14" y="2" width="2" height="2"/><rect x="4" y="4" width="2" height="2"/><rect x="14" y="4" width="2" height="2"/><rect x="4" y="6" width="2" height="2"/><rect x="8" y="6" width="2" height="2"/><rect x="10" y="6" width="2" height="2"/><rect x="14" y="6" width="2" height="2"/><rect x="4" y="8" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/><rect x="14" y="8" width="2" height="2"/><rect x="4" y="10" width="2" height="2"/><rect x="14" y="10" width="2" height="2"/><rect x="4" y="12" width="2" height="2"/><rect x="6" y="12" width="2" height="2"/><rect x="8" y="12" width="2" height="2"/><rect x="10" y="12" width="2" height="2"/><rect x="12" y="12" width="2" height="2"/><rect x="14" y="12" width="2" height="2"/><rect x="18" y="10" width="2" height="2"/><rect x="20" y="10" width="2" height="2"/><rect x="22" y="10" width="2" height="2"/><rect x="18" y="12" width="2" height="2"/><rect x="20" y="12" width="2" height="2"/><rect x="22" y="12" width="2" height="2"/><rect x="18" y="4" width="2" height="2"/><rect x="22" y="4" width="2" height="2"/><rect x="18" y="6" width="2" height="2"/><rect x="22" y="6" width="2" height="2"/><rect x="18" y="8" width="2" height="2"/><rect x="22" y="8" width="2" height="2"/><rect x="2" y="14" width="2" height="2"/><rect x="4" y="14" width="2" height="2"/><rect x="6" y="14" width="2" height="2"/><rect x="8" y="14" width="2" height="2"/><rect x="10" y="14" width="2" height="2"/><rect x="12" y="14" width="2" height="2"/><rect x="14" y="14" width="2" height="2"/><rect x="16" y="14" width="2" height="2"/><rect x="18" y="14" width="2" height="2"/><rect x="20" y="14" width="2" height="2"/><rect x="22" y="14" width="2" height="2"/><rect x="4" y="16" width="2" height="2"/><rect x="6" y="16" width="2" height="2"/><rect x="8" y="16" width="2" height="2"/><rect x="10" y="16" width="2" height="2"/><rect x="12" y="16" width="2" height="2"/><rect x="14" y="16" width="2" height="2"/><rect x="16" y="16" width="2" height="2"/><rect x="18" y="16" width="2" height="2"/><rect x="20" y="16" width="2" height="2"/><rect x="22" y="16" width="2" height="2"/></svg>';

// Custom pixel-art filled heart for the "lives" indicator. The icon-set heart
// is only an outline, which read as empty, so this solid version is used.
const heart =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="2" height="2"/><rect x="6" y="4" width="2" height="2"/><rect x="16" y="4" width="2" height="2"/><rect x="18" y="4" width="2" height="2"/><rect x="2" y="6" width="2" height="2"/><rect x="4" y="6" width="2" height="2"/><rect x="6" y="6" width="2" height="2"/><rect x="8" y="6" width="2" height="2"/><rect x="14" y="6" width="2" height="2"/><rect x="16" y="6" width="2" height="2"/><rect x="18" y="6" width="2" height="2"/><rect x="20" y="6" width="2" height="2"/><rect x="2" y="8" width="2" height="2"/><rect x="4" y="8" width="2" height="2"/><rect x="6" y="8" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/><rect x="10" y="8" width="2" height="2"/><rect x="12" y="8" width="2" height="2"/><rect x="14" y="8" width="2" height="2"/><rect x="16" y="8" width="2" height="2"/><rect x="18" y="8" width="2" height="2"/><rect x="20" y="8" width="2" height="2"/><rect x="2" y="10" width="2" height="2"/><rect x="4" y="10" width="2" height="2"/><rect x="6" y="10" width="2" height="2"/><rect x="8" y="10" width="2" height="2"/><rect x="10" y="10" width="2" height="2"/><rect x="12" y="10" width="2" height="2"/><rect x="14" y="10" width="2" height="2"/><rect x="16" y="10" width="2" height="2"/><rect x="18" y="10" width="2" height="2"/><rect x="20" y="10" width="2" height="2"/><rect x="4" y="12" width="2" height="2"/><rect x="6" y="12" width="2" height="2"/><rect x="8" y="12" width="2" height="2"/><rect x="10" y="12" width="2" height="2"/><rect x="12" y="12" width="2" height="2"/><rect x="14" y="12" width="2" height="2"/><rect x="16" y="12" width="2" height="2"/><rect x="18" y="12" width="2" height="2"/><rect x="6" y="14" width="2" height="2"/><rect x="8" y="14" width="2" height="2"/><rect x="10" y="14" width="2" height="2"/><rect x="12" y="14" width="2" height="2"/><rect x="14" y="14" width="2" height="2"/><rect x="16" y="14" width="2" height="2"/><rect x="8" y="16" width="2" height="2"/><rect x="10" y="16" width="2" height="2"/><rect x="12" y="16" width="2" height="2"/><rect x="14" y="16" width="2" height="2"/><rect x="10" y="18" width="2" height="2"/><rect x="12" y="18" width="2" height="2"/></svg>';

const ICONS: Record<string, string> = {
  'volume-on': volumeOn,
  'volume-off': volumeOff,
  copy,
  check,
  users,
  crown,
  logout,
  play,
  send,
  heart,
  close,
  reload,
  message,
  'user-x': userX,
  'book-open': bookOpen,
  skull,
  shuffle,
  scroll,
  comment,
  clock,
  trophy,
  pen: penSquare,
  snail,
};

export type PixelIconName = keyof typeof ICONS;

interface PixelIconProps {
  name: PixelIconName;
  className?: string;
  /**
   * Accessible label. When provided the icon is exposed to screen readers as an
   * image; otherwise it is treated as decorative (aria-hidden).
   */
  title?: string;
}

export function PixelIcon({ name, className = '', title }: PixelIconProps) {
  const svg = ICONS[name] ?? ICONS.check;
  return (
    <span
      className={`pixel-icon ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
