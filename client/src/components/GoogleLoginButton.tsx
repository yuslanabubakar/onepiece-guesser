import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export function GoogleLoginButton() {
  const { user, stats, loginWithProfile, logout } = useAuth();

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json();
        loginWithProfile(profile);
      } catch (err) {
        console.error('Failed to fetch Google user profile:', err);
      }
    },
    onError: (err) => console.error('Google Login Error:', err),
  });

  if (user) {
    return (
      <div className="flex items-center gap-2 bg-amber-950/90 border-2 border-amber-500 rounded-lg px-2.5 py-1 shadow-lg text-amber-100 font-serif">
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="w-7 h-7 rounded border border-amber-400 object-cover shrink-0"
        />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-xs font-bold truncate max-w-[100px] text-amber-200">{user.name}</span>
          <span className="text-[9px] text-amber-400/90">
            {stats ? `Win: ${stats.wins}` : 'Google Member'}
          </span>
        </div>
        <button
          onClick={logout}
          className="text-[10px] font-bold uppercase tracking-wide bg-red-950 hover:bg-red-800 text-red-200 border border-red-500/60 px-1.5 py-0.5 rounded transition-colors ml-1"
          title="Keluar dari akun Google"
        >
          Keluar
        </button>
      </div>
    );
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => handleGoogleAuth()}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border-2 border-amber-400 text-amber-200 font-bold text-xs shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
      title="Masuk dengan Akun Google"
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
        <path
          fill="#EA4335"
          d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
        />
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
        />
        <path
          fill="#FBBC05"
          d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3S.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
        />
        <path
          fill="#34A853"
          d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
        />
      </svg>
      <span>Masuk via Google</span>
    </button>
  );
}
