import { useAuth } from '../context/AuthContext';
import { PixelIcon } from './PixelIcon';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, stats, logout } = useAuth();

  if (!user) return null;

  const wins = stats?.wins || 0;
  const gamesPlayed = stats?.gamesPlayed || 0;
  const correctGuesses = stats?.correctGuesses || 0;
  const totalGuesses = stats?.totalGuesses || 0;

  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

  let titleBadge = 'Kru Pemula';
  let badgeColor = 'bg-amber-900/60 border-amber-500/50 text-amber-200';

  if (wins >= 10) {
    titleBadge = 'Raja Bajak Laut';
    badgeColor = 'bg-amber-500/30 border-amber-400 text-amber-300 animate-pulse';
  } else if (wins >= 5) {
    titleBadge = 'Kapten Veteran';
    badgeColor = 'bg-amber-600/30 border-amber-400 text-amber-200';
  } else if (wins >= 1) {
    titleBadge = 'Bajak Laut Handal';
    badgeColor = 'bg-amber-700/30 border-amber-500 text-amber-200';
  }

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#fdf4dc] border-4 border-[#5c3a21] rounded-2xl p-6 shadow-2xl text-amber-950 font-serif">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-amber-900/20 hover:bg-amber-900/40 text-amber-950 transition-colors cursor-pointer"
          title="Tutup Modal"
        >
          <PixelIcon name="close" className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 border-b-2 border-amber-900/20 pb-5">
          <div className="relative mb-3">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-20 h-20 rounded-full border-4 border-amber-600 shadow-md object-cover"
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-xs whitespace-nowrap bg-amber-950 border-amber-400 text-amber-200">
              Google Account
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-amber-950 mt-1 leading-tight">{user.name}</h2>
          <p className="text-xs text-amber-800/80 mb-2">{user.email}</p>

          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${badgeColor}`}>
            🏴‍☠️ {titleBadge}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-amber-900/10 border border-amber-900/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-amber-900">{wins}</div>
            <div className="text-[11px] font-bold uppercase text-amber-800/90 tracking-wide mt-0.5">🏆 Kemenangan</div>
          </div>

          <div className="bg-amber-900/10 border border-amber-900/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-amber-900">{gamesPlayed}</div>
            <div className="text-[11px] font-bold uppercase text-amber-800/90 tracking-wide mt-0.5">🎮 Total Game</div>
          </div>

          <div className="bg-amber-900/10 border border-amber-900/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-amber-900">{winRate}%</div>
            <div className="text-[11px] font-bold uppercase text-amber-800/90 tracking-wide mt-0.5">📊 Win Rate</div>
          </div>

          <div className="bg-amber-900/10 border border-amber-900/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-amber-900">{accuracy}%</div>
            <div className="text-[11px] font-bold uppercase text-amber-800/90 tracking-wide mt-0.5">🎯 Akurasi Tebak</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-900 hover:bg-red-800 text-red-100 font-bold text-xs border-2 border-red-700 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Keluar Akun
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-amber-950 font-extrabold text-xs border-2 border-amber-800 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Tutup Logbook
          </button>
        </div>
      </div>
    </div>
  );
}
