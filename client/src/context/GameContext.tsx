import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { audioService } from '../services/audio';

export interface Player {
  id: string;
  name: string;
  avatarUrl?: string | null;
  socketId: string | null;
  suggestions: string[];
  assignedCharacter: string | null;
  guessesCount: number;
  hasGuessedCorrectly: boolean;
  failedToGuess: boolean;
  questionsHistory?: { text: string; ya: number; tidak: number; mungkin: number }[];
  guessTimeMs?: number | null;
}

export interface Question {
  text: string;
  reactions: { [playerId: string]: 'ya' | 'tidak' | 'mungkin' };
}

export interface Guess {
  characterName: string;
  reactions: { [playerId: string]: 'benar' | 'salah' };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface Room {
  id: string;
  hostId: string;
  players: Player[];
  status: 'LOBBY' | 'SUGGESTING' | 'PLAYING' | 'GAME_OVER';
  turnIndex: number;
  activeQuestion: Question | null;
  activeGuess: Guess | null;
  turnPhase: 'ASKING' | 'THINKING' | 'GUESSING' | 'VOTING_GUESS' | 'NONE';
  timerEndEpoch: number | null;
  timerDuration: number | null;
  gameStartEpoch?: number | null;
  messages?: ChatMessage[];
}

export interface AlertMessage {
  type: 'success' | 'info' | 'danger';
  message: string;
}

interface GameContextType {
  room: Room | null;
  playerId: string | null;
  playerName: string | null;
  error: string | null;
  alert: AlertMessage | null;
  isMuted: boolean;
  connected: boolean;
  clearError: () => void;
  clearAlert: () => void;
  createRoom: (name: string, avatarUrl?: string | null) => void;
  joinRoom: (roomId: string, name: string, avatarUrl?: string | null) => void;
  submitSuggestions: (suggestions: string[]) => void;
  submitQuestion: (text: string) => void;
  submitQuestionReaction: (reaction: 'ya' | 'tidak' | 'mungkin') => void;
  skipGuessing: () => void;
  guessNow: () => void;
  submitGuess: (characterName: string) => void;
  startGame: () => void;
  restartGame: () => void;
  toggleMute: () => void;
  leaveRoom: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  sendChatMessage: (text: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

function generateClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'client_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function getOrCreateClientId(): string {
  let clientId = localStorage.getItem('denden_clientId') || localStorage.getItem('denden_playerId');
  if (!clientId) {
    clientId = generateClientId();
  }
  localStorage.setItem('denden_clientId', clientId);
  localStorage.setItem('denden_playerId', clientId);
  return clientId;
}

function getSavedRoomId(): string | null {
  const sessionRoom = sessionStorage.getItem('denden_roomId');
  if (sessionRoom) return sessionRoom;

  const localRoom = localStorage.getItem('denden_roomId');
  if (localRoom) {
    sessionStorage.setItem('denden_roomId', localRoom);
    localStorage.removeItem('denden_roomId');
    return localRoom;
  }
  return null;
}

function saveRoomSession(roomId: string, playerId: string) {
  sessionStorage.setItem('denden_roomId', roomId);
  sessionStorage.setItem('denden_roomTimestamp', Date.now().toString());
  localStorage.setItem('denden_clientId', playerId);
  localStorage.setItem('denden_playerId', playerId);
}

function clearRoomSession() {
  sessionStorage.removeItem('denden_roomId');
  sessionStorage.removeItem('denden_roomTimestamp');
  localStorage.removeItem('denden_roomId');
}

function isSessionExpired(): boolean {
  const ts = sessionStorage.getItem('denden_roomTimestamp');
  if (!ts) return false;
  const elapsed = Date.now() - parseInt(ts, 10);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return elapsed > TWO_HOURS_MS;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(getOrCreateClientId());
  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('denden_playerName'));
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(localStorage.getItem('denden_muted') === 'true');
  const [connected, setConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    console.log('Connecting to Cloudflare Edge WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Cloudflare Edge WebSockets ⚡');
      setConnected(true);

      const savedRoomId = getSavedRoomId();
      const activeClientId = getOrCreateClientId();
      const savedName = localStorage.getItem('denden_playerName');

      if (savedRoomId && activeClientId) {
        if (isSessionExpired()) {
          clearRoomSession();
          setRoom(null);
        } else {
          ws.send(
            JSON.stringify({
              type: 'join_room',
              payload: { roomId: savedRoomId, clientId: activeClientId, playerName: savedName || 'Pemain' },
            })
          );
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'room_created' || type === 'room_joined') {
          saveRoomSession(data.roomId, data.playerId);
          setPlayerId(data.playerId);
          setRoom(data.room);
          setError(null);
        } else if (type === 'room_state') {
          setRoom(data);
        } else if (type === 'game_alert') {
          setAlert(data);
          if (data.type === 'success') audioService.playCorrect();
          else if (data.type === 'danger') audioService.playWrong();
          else audioService.playClick();
          setTimeout(() => {
            setAlert((curr) => (curr && curr.message === data.message ? null : curr));
          }, 5000);
        } else if (type === 'chat_message') {
          setRoom((currentRoom) => {
            if (!currentRoom) return null;
            const updatedMessages = currentRoom.messages ? [...currentRoom.messages, data] : [data];
            if (updatedMessages.length > 50) updatedMessages.shift();
            return { ...currentRoom, messages: updatedMessages };
          });
          audioService.playClick();
        } else if (type === 'reconnect_failed') {
          clearRoomSession();
          setRoom(null);
          setError(data?.message || 'Sesi telah berakhir.');
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      setConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('denden_muted', String(isMuted));
    audioService.setMuted(isMuted);
  }, [isMuted]);

  const send = (type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      setError('Belum terhubung ke Cloudflare Edge WebSocket. Silakan coba lagi.');
      audioService.playWrong();
    }
  };

  const clearError = () => setError(null);
  const clearAlert = () => setAlert(null);

  const createRoom = (name: string, avatarUrl?: string | null) => {
    localStorage.setItem('denden_playerName', name);
    setPlayerName(name);
    const activeClientId = getOrCreateClientId();
    send('create_room', { playerName: name, clientId: activeClientId, avatarUrl });
  };

  const joinRoom = (roomId: string, name: string, avatarUrl?: string | null) => {
    localStorage.setItem('denden_playerName', name);
    setPlayerName(name);
    const activeClientId = getOrCreateClientId();
    send('join_room', { roomId, playerName: name, clientId: activeClientId, avatarUrl });
  };

  const submitSuggestions = (suggestions: string[]) => {
    send('submit_suggestions', { suggestions });
  };

  const submitQuestion = (questionText: string) => {
    send('submit_question', { questionText });
  };

  const submitQuestionReaction = (reaction: 'ya' | 'tidak' | 'mungkin') => {
    send('answer_question', { reaction });
  };

  const skipGuessing = () => {
    send('skip_guessing', {});
  };

  const guessNow = () => {
    send('guess_now', {});
  };

  const submitGuess = (characterName: string) => {
    send('submit_guess', { characterName });
  };

  const startGame = () => {
    send('start_game', {});
  };

  const restartGame = () => {
    send('start_game', {});
  };

  const toggleMute = () => {
    setIsMuted((m) => !m);
  };

  const leaveRoom = () => {
    send('leave_room', {});
    clearRoomSession();
    setRoom(null);
  };

  const kickPlayer = (targetPlayerId: string) => {
    send('kick_player', { targetPlayerId });
  };

  const sendChatMessage = (text: string) => {
    send('chat_message', { text });
  };

  return (
    <GameContext.Provider
      value={{
        room,
        playerId,
        playerName,
        error,
        alert,
        isMuted,
        connected,
        clearError,
        clearAlert,
        createRoom,
        joinRoom,
        submitSuggestions,
        submitQuestion,
        submitQuestionReaction,
        skipGuessing,
        guessNow,
        submitGuess,
        startGame,
        restartGame,
        toggleMute,
        leaveRoom,
        kickPlayer,
        sendChatMessage,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
