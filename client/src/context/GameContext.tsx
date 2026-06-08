import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { audioService } from '../services/audio';

export interface Player {
  id: string;
  name: string;
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
  socket: Socket | null;
  room: Room | null;
  playerId: string | null;
  playerName: string | null;
  error: string | null;
  alert: AlertMessage | null;
  isMuted: boolean;
  clearError: () => void;
  clearAlert: () => void;
  createRoom: (name: string) => void;
  joinRoom: (roomId: string, name: string) => void;
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

export function GameProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(localStorage.getItem('denden_playerId'));
  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('denden_playerName'));
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(localStorage.getItem('denden_muted') === 'true');

  // Initialize socket
  useEffect(() => {
    // Connect to VITE_WS_URL if set (production), otherwise fallback to local hostname port 3001
    const socketUrl = import.meta.env.VITE_WS_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      // If we have saved credentials, try to reconnect
      const savedRoomId = localStorage.getItem('denden_roomId');
      const savedPlayerId = localStorage.getItem('denden_playerId');
      if (savedRoomId && savedPlayerId) {
        newSocket.emit('reconnect_player', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    });

    newSocket.on('room_created', ({ roomId, playerId: newPlayerId, roomState }) => {
      localStorage.setItem('denden_roomId', roomId);
      localStorage.setItem('denden_playerId', newPlayerId);
      setPlayerId(newPlayerId);
      setRoom(roomState);
      setError(null);
    });

    newSocket.on('room_joined', ({ roomId, playerId: newPlayerId, roomState }) => {
      localStorage.setItem('denden_roomId', roomId);
      localStorage.setItem('denden_playerId', newPlayerId);
      setPlayerId(newPlayerId);
      setRoom(roomState);
      setError(null);
    });

    newSocket.on('reconnected', (roomState: Room) => {
      setRoom(roomState);
      setError(null);
    });

    newSocket.on('reconnect_failed', (msg) => {
      console.log('Reconnect failed:', msg);
      // Clean up localStorage
      localStorage.removeItem('denden_roomId');
      setRoom(null);
    });

    newSocket.on('room_state', (roomState: Room) => {
      setRoom(roomState);
    });

    newSocket.on('game_alert', (msg: AlertMessage) => {
      setAlert(msg);
      
      // Play appropriate sound effect
      if (msg.type === 'success') {
        audioService.playCorrect();
      } else if (msg.type === 'danger') {
        audioService.playWrong();
      } else {
        audioService.playClick();
      }
      
      // Clear alert after 5 seconds
      setTimeout(() => {
        setAlert((curr) => (curr && curr.message === msg.message ? null : curr));
      }, 5000);
    });

    newSocket.on('assignment_failed', (msg: string) => {
      setError(msg);
      audioService.playWrong();
    });

    newSocket.on('kicked', () => {
      localStorage.removeItem('denden_roomId');
      setRoom(null);
      setError('Anda telah ditendang dari room oleh Host');
      audioService.playWrong();
    });

    newSocket.on('chat_message', (msg: ChatMessage) => {
      setRoom((currentRoom) => {
        if (!currentRoom) return null;
        const updatedMessages = currentRoom.messages ? [...currentRoom.messages, msg] : [msg];
        if (updatedMessages.length > 50) {
          updatedMessages.shift();
        }
        return {
          ...currentRoom,
          messages: updatedMessages,
        };
      });
      // Play a click sound on new chat messages
      audioService.playClick();
    });

    newSocket.on('error', (msg: string) => {
      setError(msg);
      audioService.playWrong();
    });

    // Mute sync
    audioService.setMuted(isMuted);

    return () => {
      newSocket.close();
    };
  }, []);



  // Sync mute state with localStorage & service
  useEffect(() => {
    localStorage.setItem('denden_muted', String(isMuted));
    audioService.setMuted(isMuted);
  }, [isMuted]);

  const clearError = () => setError(null);
  const clearAlert = () => setAlert(null);

  const createRoom = (name: string) => {
    if (socket) {
      localStorage.setItem('denden_playerName', name);
      setPlayerName(name);
      socket.emit('create_room', { playerName: name });
    }
  };

  const joinRoom = (roomId: string, name: string) => {
    if (socket) {
      localStorage.setItem('denden_playerName', name);
      setPlayerName(name);
      socket.emit('join_room', { roomId, playerName: name, playerId });
    }
  };

  const submitSuggestions = (suggestions: string[]) => {
    if (socket && room && playerId) {
      socket.emit('submit_suggestions', { roomId: room.id, playerId, suggestions });
    }
  };

  const submitQuestion = (questionText: string) => {
    if (socket && room && playerId) {
      socket.emit('submit_question', { roomId: room.id, playerId, questionText });
    }
  };

  const submitQuestionReaction = (reaction: 'ya' | 'tidak' | 'mungkin') => {
    if (socket && room && playerId) {
      socket.emit('submit_question_reaction', { roomId: room.id, playerId, reaction });
    }
  };

  const skipGuessing = () => {
    if (socket && room && playerId) {
      socket.emit('skip_guessing', { roomId: room.id, playerId });
    }
  };

  const guessNow = () => {
    if (socket && room && playerId) {
      socket.emit('guess_now', { roomId: room.id, playerId });
    }
  };

  const submitGuess = (characterName: string) => {
    if (socket && room && playerId) {
      socket.emit('submit_guess', { roomId: room.id, playerId, characterName });
    }
  };

  const startGame = () => {
    if (socket && room && playerId) {
      socket.emit('start_game', { roomId: room.id, playerId });
    }
  };

  const restartGame = () => {
    if (socket && room && playerId) {
      socket.emit('restart_game', { roomId: room.id, playerId });
    }
  };

  const toggleMute = () => {
    setIsMuted((m) => !m);
  };

  const leaveRoom = () => {
    if (socket && room && playerId) {
      socket.emit('leave_room', { roomId: room.id, playerId });
    }
    localStorage.removeItem('denden_roomId');
    setRoom(null);
  };

  const kickPlayer = (targetPlayerId: string) => {
    if (socket && room && playerId) {
      socket.emit('kick_player', { roomId: room.id, playerId, targetPlayerId });
    }
  };

  const sendChatMessage = (text: string) => {
    if (socket && room && playerId) {
      socket.emit('send_chat_message', { roomId: room.id, playerId, text });
    }
  };

  return (
    <GameContext.Provider
      value={{
        socket,
        room,
        playerId,
        playerName,
        error,
        alert,
        isMuted,
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

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
