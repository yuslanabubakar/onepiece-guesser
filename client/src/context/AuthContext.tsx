import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

export interface UserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  correctGuesses: number;
  totalGuesses: number;
}

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: UserProfile | null;
  stats: PlayerStats | null;
  loginWithCredential: (credential: string) => void;
  loginWithProfile: (profile: { sub?: string; id?: string; email: string; name: string; picture?: string; avatarUrl?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'denden_auth_user';
const STORAGE_KEY_STATS = 'denden_auth_stats';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [stats, setStats] = useState<PlayerStats | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_STATS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (stats) {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    } else {
      localStorage.removeItem(STORAGE_KEY_STATS);
    }
  }, [stats]);

  const loginWithCredential = (credential: string) => {
    try {
      const decoded = jwtDecode<GoogleJwtPayload>(credential);
      const userProfile: UserProfile = {
        id: decoded.sub,
        googleId: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        avatarUrl: decoded.picture,
      };

      setUser(userProfile);

      if (!stats) {
        setStats({
          gamesPlayed: 0,
          wins: 0,
          correctGuesses: 0,
          totalGuesses: 0,
        });
      }
    } catch (err) {
      console.error('Failed to decode Google Credential token', err);
    }
  };

  const loginWithProfile = (profile: { sub?: string; id?: string; email: string; name: string; picture?: string; avatarUrl?: string }) => {
    const userId = profile.sub || profile.id || profile.email;
    const userProfile: UserProfile = {
      id: userId,
      googleId: userId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture || profile.avatarUrl || '',
    };
    setUser(userProfile);
    if (!stats) {
      setStats({
        gamesPlayed: 0,
        wins: 0,
        correctGuesses: 0,
        totalGuesses: 0,
      });
    }

    // Sync profile & fetch stats from Cloudflare D1 Database API
    fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: userId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture || profile.avatarUrl || '',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stats) {
          setStats({
            gamesPlayed: data.stats.games_played || 0,
            wins: data.stats.wins || 0,
            correctGuesses: data.stats.correct_guesses || 0,
            totalGuesses: data.stats.total_guesses || 0,
          });
        }
      })
      .catch((err) => {
        console.warn('D1 API sync skipped or unavailable locally:', err);
      });
  };

  const logout = () => {
    setUser(null);
    setStats(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_STATS);
  };

  return (
    <AuthContext.Provider value={{ user, stats, loginWithCredential, loginWithProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
