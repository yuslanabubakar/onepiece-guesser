import React, { useState, useEffect, useRef } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { popularCharacters } from './data/characters';
import { audioService } from './services/audio';
import { 
  Volume2, VolumeX, Copy, Check, Users, Crown, LogOut, 
  Play, Send, Heart, X, Check as CheckIcon, RotateCcw, MessageSquare,
  UserX
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Autocomplete Input Component
interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  id: string;
}

function AutocompleteInput({ value, onChange, placeholder, id }: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.trim() === '') {
      setSuggestions([]);
      return;
    }
    const filtered = popularCharacters
      .filter((c) => c.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 5);
    setSuggestions(filtered);
    setShowSuggestions(true);
  };

  const selectSuggestion = (name: string) => {
    onChange(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (value.trim() !== '') {
            const filtered = popularCharacters
              .filter((c) => c.toLowerCase().includes(value.toLowerCase()))
              .slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className="input-pirate w-full"
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((name) => (
            <div
              key={name}
              onClick={() => selectSuggestion(name)}
              className="autocomplete-item"
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Timer Countdown Component
function TimerCountdown({ expiryEpoch }: { expiryEpoch: number | null }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const lastTickRef = useRef<number>(-1);

  useEffect(() => {
    if (!expiryEpoch) {
      setTimeLeft(0);
      lastTickRef.current = -1;
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((expiryEpoch - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Play ticking sound when remaining <= 10
      if (remaining <= 10 && remaining > 0 && remaining !== lastTickRef.current) {
        lastTickRef.current = remaining;
        audioService.playTick();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [expiryEpoch]);

  if (!expiryEpoch) return null;

  const isWarning = timeLeft <= 10;

  return (
    <div className="flex flex-col items-center justify-center my-3">
      <div className={`timer-badge ${isWarning ? 'warning animate-pulse' : ''}`}>
        {timeLeft}s
      </div>
      <div className="text-sm font-semibold mt-1" style={{ color: isWarning ? 'var(--danger)' : 'var(--wood-brown)' }}>
        {isWarning ? 'Waktu hampir habis!' : 'Waktu berpikir'}
      </div>
    </div>
  );
}

// Inner Game App
function GameApp() {
  const {
    room, playerId, playerName, error, alert, isMuted,
    clearError, clearAlert, createRoom, joinRoom, submitSuggestions,
    submitQuestion, submitQuestionReaction, skipGuessing, guessNow, submitGuess,
    startGame, restartGame, toggleMute, leaveRoom, kickPlayer
  } = useGame();

  const [inputName, setInputName] = useState(playerName || '');
  const [inputRoomId, setInputRoomId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Suggestion screen state
  const [sug1, setSug1] = useState('');
  const [sug2, setSug2] = useState('');
  const [sug3, setSug3] = useState('');

  // Playing screen state
  const [questionText, setQuestionText] = useState('');
  const [guessName, setGuessName] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto-fill room code from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setInputRoomId(roomCode.toUpperCase());
    }
  }, []);

  // Confetti effect on victory
  useEffect(() => {
    if (room && room.status === 'GAME_OVER') {
      const correctGuessers = room.players.filter((p) => p.hasGuessedCorrectly);
      if (correctGuessers.length > 0) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    }
  }, [room?.status]);

  const handleCopyLink = () => {
    if (!room) return;
    const inviteLink = `${window.location.origin}/?room=${room.id}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getShareUrl = (platform: 'wa' | 'tele' | 'ig') => {
    if (!room) return '';
    const inviteLink = `${window.location.origin}/?room=${room.id}`;
    const text = `Ayo main game tebak tokoh One Piece "Den Den Trivia" bareng gua! Klik link ini untuk join room: ${inviteLink}`;
    
    if (platform === 'wa') {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    if (platform === 'tele') {
      return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Main Den Den Trivia bareng!')}`;
    }
    return '';
  };

  const handleCreateClick = () => {
    if (!inputName.trim()) {
      setLocalError("Nama Anda tidak boleh kosong!");
      return;
    }
    setLocalError(null);
    createRoom(inputName);
  };

  const handleJoinClick = () => {
    if (!inputName.trim()) {
      setLocalError("Nama Anda tidak boleh kosong!");
      return;
    }
    if (!inputRoomId.trim()) {
      setLocalError("Kode Room tidak boleh kosong!");
      return;
    }
    setLocalError(null);
    joinRoom(inputRoomId.toUpperCase(), inputName);
  };

  const handleRandomizeSuggestions = () => {
    const shuffled = [...popularCharacters].sort(() => 0.5 - Math.random());
    setSug1(shuffled[0]);
    setSug2(shuffled[1]);
    setSug3(shuffled[2]);
  };

  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const suggestions = [sug1, sug2, sug3].filter((s) => s.trim() !== '');
    if (suggestions.length === 0) {
      alert?.message ? null : clearError();
      return;
    }
    submitSuggestions(suggestions);
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionText.trim()) {
      submitQuestion(questionText);
      setQuestionText('');
    }
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guessName.trim()) {
      submitGuess(guessName);
      setGuessName('');
    }
  };

  // Render Mute Button (Persistent UI element)
  const renderMuteToggle = () => (
    <button 
      onClick={toggleMute}
      className="absolute top-4 right-4 p-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-800 transition-colors z-50"
      title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
    >
      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
    </button>
  );

  // 1. Lobby Setup Screen (Create or Join)
  if (!room) {
    return (
      <div className="lobby-container">
        <div className="lobby-header-section text-center">
          <h1 className="heading-pirate text-4xl mb-2 flex items-center justify-center gap-2">
            <span className="snail-icon-container">🐌</span> Den Den Trivia
          </h1>
          <p className="text-center text-sm italic text-amber-500 mb-8 font-serif">
            "Panggil Mushi Transponder Anda & Tebak Karakternya!"
          </p>
        </div>

        {(localError || error) && (
          <div className="alert-banner alert-danger">
            <X className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{localError || error}</span>
            <button 
              onClick={() => {
                setLocalError(null);
                clearError();
              }} 
              className="ml-auto text-current font-bold"
            >
              &times;
            </button>
          </div>
        )}

        <div className="lobby-grid">
          <div className="logbook-card">
            {renderMuteToggle()}
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <h2 className="heading-pirate text-xl text-left border-b-2 border-amber-950 pb-2">Buat atau Gabung Logbook</h2>
              <div>
                <label htmlFor="playerName" className="block text-sm font-bold font-serif mb-1 text-amber-950">Nama Anda</label>
                <input
                  type="text"
                  id="playerName"
                  placeholder="Misal: Luffy, Zoro..."
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="input-pirate"
                />
              </div>
              
              <div className="pt-2">
                <button 
                  type="button" 
                  onClick={handleCreateClick}
                  className="btn-pirate btn-pirate-gold w-full py-3"
                >
                  <Crown className="w-5 h-5" /> Buat Room Baru
                </button>
              </div>

              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-amber-900 opacity-30"></div>
                <span className="flex-shrink mx-4 text-amber-950 font-serif text-sm">ATAU</span>
                <div className="flex-grow border-t border-amber-900 opacity-30"></div>
              </div>

              <div>
                <label htmlFor="roomId" className="block text-sm font-bold font-serif mb-1 text-amber-950">Kode Room (6 Digit)</label>
                <input
                  type="text"
                  id="roomId"
                  placeholder="Ketik Kode Room..."
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  className="input-pirate text-center tracking-widest font-mono uppercase"
                  maxLength={6}
                />
              </div>
              
              <button 
                type="button" 
                onClick={handleJoinClick}
                className="btn-pirate w-full py-3"
                disabled={!inputRoomId}
              >
                <Play className="w-5 h-5" /> Masuk Room
              </button>
            </form>
          </div>

          <div className="logbook-card">
            <h3 className="heading-pirate text-lg text-left border-b border-amber-500/20 pb-2 mb-4 flex items-center gap-2">
              🧭 Panduan & Aturan Bermain
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="text-xs font-serif">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  color: '#fbbf24',
                  padding: '0.25rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  flexShrink: 0
                }}>1</span>
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>Buat / Gabung Room</strong>
                  Tulis nama Anda kemudian buat room baru (sebagai Kapten/Host) atau ketik Kode Room teman Anda untuk bergabung (maksimal 7 pemain).
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  color: '#fbbf24',
                  padding: '0.25rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  flexShrink: 0
                }}>2</span>
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>Usulkan Tokoh One Piece</strong>
                  Setiap pemain memasukkan 3 usulan nama karakter One Piece secara rahasia. Sistem akan otomatis mengacak dan membagikan 1 karakter unik ke tiap pemain untuk ditebak (Anda dijamin tidak akan menebak karakter usulan sendiri atau mendapatkan karakter ganda).
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  color: '#fbbf24',
                  padding: '0.25rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  flexShrink: 0
                }}>3</span>
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>Ajukan Pertanyaan Clue</strong>
                  Saat giliran Anda tiba, tulis pertanyaan pancingan untuk menebak siapa Anda (contoh: <em>"Apakah saya anggota Topi Jerami?"</em>). Anggota kru lain akan merespons jujur secara real-time dengan memilih: <strong>YA</strong>, <strong>TIDAK</strong>, atau <strong>MUNGKIN</strong>.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  color: '#fbbf24',
                  padding: '0.25rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  flexShrink: 0
                }}>4</span>
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>Menebak dengan Nyawa (❤️)</strong>
                  Anda dapat menebak nama karakter Anda di sisa waktu giliran. Anda memiliki **3 nyawa (❤️)**. Jika tebakan Anda benar (cocok dengan karakter rahasia Anda), Anda menang secara instan! Waktu penyelesaian tercepat Anda akan dicatat di papan skor akhir.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Common UI Elements for inside a room
  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const activePlayer = room.players[room.turnIndex];
  const isMyTurn = activePlayer && activePlayer.id === playerId;

  // 2. Room Lobby Screen (Waiting for players)
  if (room.status === 'LOBBY') {
    return (
      <div className="px-4 py-8 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <button onClick={leaveRoom} className="btn-pirate btn-pirate-red px-3 py-2 text-sm">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
          <h1 className="heading-pirate text-2xl flex items-center gap-1 m-0">
            🐌 Den Den Trivia
          </h1>
          <div className="relative w-8 h-8">
            {renderMuteToggle()}
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-danger">
            <X className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={clearError} className="ml-auto text-current font-bold">&times;</button>
          </div>
        )}

        <div className="logbook-card text-center mb-6">
          <p className="text-xs font-serif uppercase tracking-wider text-amber-800 m-0">Kode Room Anda</p>
          <h2 className="text-4xl font-mono font-black tracking-widest text-amber-950 m-2">{room.id}</h2>
          
          <div className="share-buttons-group">
            <button onClick={handleCopyLink} className="btn-share btn-share-copy">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Tersalin!' : 'Salin Link'}
            </button>
            
            <a href={getShareUrl('wa')} target="_blank" rel="noopener noreferrer" className="btn-share btn-share-wa">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>

            <a href={getShareUrl('tele')} target="_blank" rel="noopener noreferrer" className="btn-share btn-share-tele">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.92 2.87-3.43.02-.07.03-.13-.01-.17-.04-.04-.1-.03-.15-.02-.07.02-1.19.76-3.37 2.23-.32.22-.61.33-.87.32-.29-.01-.85-.17-1.27-.3-1.08-.33-1.06-.52.27-1.04 6.5-2.82 10.83-4.68 12.98-5.59.8-.33 1.57-.48 2.08-.47.3.01.76.15 1.05.37.24.18.43.43.48.77.06.39-.02.83-.17 1.43z"/>
              </svg>
              Telegram
            </a>
          </div>
          <p className="text-xs text-amber-800 mt-2 font-serif">
            Bagikan link di atas untuk mengajak teman (Maksimal 7 pemain)
          </p>
        </div>

        <div className="logbook-card flex-grow mb-6">
          <h3 className="heading-pirate text-lg text-left border-b border-amber-950 pb-1 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" /> Daftar Kru ({room.players.length}/7)
          </h3>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div key={p.id} className="player-row">
                <span className="flex items-center gap-2 font-semibold">
                  {room.hostId === p.id && <Crown className="w-4 h-4 text-amber-600" />}
                  {p.name} {p.id === playerId ? '(Anda)' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded font-serif ${p.socketId ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {p.socketId ? 'Online' : 'Offline'}
                  </span>
                  {isHost && p.id !== playerId && (
                    <button 
                      onClick={() => kickPlayer(p.id)}
                      className="p-1 rounded bg-red-950/40 text-red-400 hover:bg-red-900/40 hover:text-red-200 border border-red-800 transition-colors flex items-center justify-center"
                      title="Tendang Pemain"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          {isHost ? (
            <button 
              onClick={startGame} 
              className="btn-pirate btn-pirate-gold w-full py-4 text-lg"
              disabled={room.players.length < 2}
            >
              <Play className="w-6 h-6" /> Mulai Petualangan!
            </button>
          ) : (
            <div className="text-center font-serif text-amber-400 animate-pulse bg-stone-900/60 p-4 rounded-lg border border-amber-950">
              Menunggu kapten (host) memulai pelayaran...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Suggestions Submission Screen
  if (room.status === 'SUGGESTING') {
    const hasSubmitted = me && me.suggestions && me.suggestions.length > 0;
    
    return (
      <div className="px-4 py-8 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <button onClick={leaveRoom} className="btn-pirate btn-pirate-red px-3 py-2 text-sm">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
          <h1 className="heading-pirate text-2xl flex items-center gap-1 m-0">
            🐌 Den Den Trivia
          </h1>
          <div className="relative w-8 h-8">
            {renderMuteToggle()}
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-danger">
            <X className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={clearError} className="ml-auto text-current font-bold">&times;</button>
          </div>
        )}

        <div className="game-layout-grid">
          <div className="game-column-main">
            <div className="logbook-card mb-6">
              <h2 className="heading-pirate text-xl text-left border-b border-amber-950 pb-2 mb-4">
                Usulkan Tokoh One Piece
              </h2>
              
              {hasSubmitted ? (
                <div className="text-center py-6 font-serif">
                  <div className="text-green-800 font-bold text-lg mb-2 flex items-center justify-center gap-2">
                    <CheckIcon className="w-6 h-6" /> Usulan Diterima!
                  </div>
                  <p className="text-sm text-amber-950">
                    Usulan Anda:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {me.suggestions.map((name, idx) => (
                      <span key={idx} className="bg-amber-100 text-amber-950 px-3 py-1 rounded-full border border-amber-800 text-sm font-semibold">
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-6 animate-pulse">
                    Menunggu kru lain menyelesaikan usulan mereka...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSuggestSubmit} className="space-y-4">
                  <p className="text-xs text-amber-800 italic font-serif leading-relaxed">
                    Tuliskan masing-masing maksimal 3 tokoh One Piece. Karakter-karakter ini akan diacak dan dibagikan ke pemain lain secara otomatis untuk ditebak. Ketik minimal 1 karakter untuk mengirim.
                  </p>
                  
                  <div>
                    <label className="block text-xs font-bold font-serif text-amber-950 mb-1">Usulan 1</label>
                    <AutocompleteInput
                      id="sug1"
                      value={sug1}
                      onChange={setSug1}
                      placeholder="Misal: Luffy, Zoro..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold font-serif text-amber-950 mb-1">Usulan 2 (Opsional)</label>
                    <AutocompleteInput
                      id="sug2"
                      value={sug2}
                      onChange={setSug2}
                      placeholder="Misal: Nami, Usopp..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold font-serif text-amber-950 mb-1">Usulan 3 (Opsional)</label>
                    <AutocompleteInput
                      id="sug3"
                      value={sug3}
                      onChange={setSug3}
                      placeholder="Misal: Sanji, Robin..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button 
                      type="button" 
                      onClick={handleRandomizeSuggestions}
                      className="btn-pirate py-3 bg-transparent border-amber-900 text-amber-950 font-bold"
                    >
                      🎲 Acak Karakter
                    </button>
                    <button 
                      type="submit" 
                      className="btn-pirate btn-pirate-gold py-3"
                      disabled={!sug1.trim() && !sug2.trim() && !sug3.trim()}
                    >
                      Kirim Usulan
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="game-column-sidebar">
            {/* Show who has submitted */}
            <div className="logbook-card flex-grow">
              <h3 className="heading-pirate text-sm text-left border-b border-amber-950 pb-1 mb-3">Status Usulan Kru</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {room.players.map((p) => {
                  const submitted = p.suggestions && p.suggestions.length > 0;
                  return (
                    <div 
                      key={p.id} 
                      className={`p-2 rounded border flex items-center justify-between font-serif ${
                        submitted ? 'bg-green-100 border-green-800 text-green-900' : 'bg-amber-50 border-amber-800 text-amber-900'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span>{submitted ? '✔' : '✍'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Main Game Play Screen
  if (room.status === 'PLAYING') {
    const isMeActive = isMyTurn;
    const hasGuessedMe = me?.hasGuessedCorrectly;
    const failedMe = me?.failedToGuess;
    const isSpectator = hasGuessedMe || failedMe;

    return (
      <div className="px-4 py-6 min-h-screen flex flex-col">
        {/* Global Toast Alert */}
        {alert && (
          <div className={`alert-banner alert-${alert.type}`}>
            <MessageSquare className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-serif font-bold">{alert.message}</span>
            <button onClick={clearAlert} className="ml-auto text-current font-bold">&times;</button>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <button onClick={leaveRoom} className="btn-pirate btn-pirate-red px-2 py-1 text-xs">
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
          
          <div className="wanted-poster py-1 px-4 border-2 rounded">
            <div className="text-[10px] uppercase font-bold tracking-widest leading-none">TARGET ANDA</div>
            <div className="text-xs font-black text-amber-950 leading-none mt-1">
              {hasGuessedMe ? (
                <span className="text-green-800 font-bold">{me?.assignedCharacter} (SELESAI)</span>
              ) : failedMe ? (
                <span className="text-red-800 font-bold">{me?.assignedCharacter} (GAGAL)</span>
              ) : (
                <span className="text-amber-800 italic">??? (Tebaklah!)</span>
              )}
            </div>
          </div>
          
          <div className="relative w-8 h-8">
            {renderMuteToggle()}
          </div>
        </div>

        <div className="game-layout-grid">
          <div className="game-column-main">
            {/* Turn Header Alert */}
            <div className="logbook-card logbook-card-gold p-3 mb-4 text-center">
              <div className="text-xs font-serif uppercase tracking-wider text-amber-800">Giliran Pemain</div>
              <h2 className="text-xl font-black text-amber-950 my-1 font-serif flex items-center justify-center gap-2">
                {isMeActive ? 'Giliran Anda!' : `${activePlayer?.name}`} 
                {room.turnPhase === 'ASKING' && ' sedang memikirkan pertanyaan...'}
                {room.turnPhase === 'THINKING' && ' mengajukan pertanyaan!'}
                {room.turnPhase === 'GUESSING' && ' sedang bersiap menebak...'}
                {room.turnPhase === 'VOTING_GUESS' && ' mengajukan tebakan!'}
              </h2>
              <div className="text-[10px] text-amber-700 italic">
                Fase Turn: {room.turnPhase}
              </div>
            </div>

            {/* Active Phase Card */}
            <div className="logbook-card flex-grow mb-4 flex flex-col justify-center min-h-[220px]">
              
              {/* FASE 1: ASKING (Active Player writes a question) */}
              {room.turnPhase === 'ASKING' && (
                <div className="w-full text-center space-y-4">
                  {isMeActive ? (
                    <form onSubmit={handleQuestionSubmit} className="space-y-3">
                      <h3 className="heading-pirate text-lg text-left m-0">Tulis Pertanyaan Anda</h3>
                      <p className="text-xs text-left text-amber-800 font-serif italic m-0">
                        Tulis pertanyaan pancingan untuk mempersempit ciri-ciri karakter tebakan Anda. Teman-teman akan menjawab Ya, Tidak, atau Mungkin.
                      </p>
                      <input
                        type="text"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Misal: Apakah dia kru bajak laut topi jerami?"
                        className="input-pirate"
                        required
                      />
                      <button type="submit" className="btn-pirate btn-pirate-gold w-full py-3">
                        <Send className="w-4 h-4" /> Kirim Pertanyaan ke Room
                      </button>
                    </form>
                  ) : (
                    <div className="py-6 font-serif">
                      <div className="snail-icon-container text-4xl mb-2">🐌</div>
                      <p className="text-sm font-semibold text-amber-950">
                        Menunggu {activePlayer?.name} menuliskan pertanyaan pancingan...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FASE 2: THINKING (Question is active, people are reacting, 45s timer starts after first reaction) */}
              {room.turnPhase === 'THINKING' && room.activeQuestion && (
                <div className="w-full text-center space-y-4">
                  <div className="p-3 bg-amber-100/60 border border-amber-900/30 rounded-lg text-amber-950 font-serif italic text-base">
                    "{room.activeQuestion.text}"
                  </div>

                  {/* Timer */}
                  <TimerCountdown expiryEpoch={room.timerEndEpoch} />

                  {/* Reactions display */}
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-950 font-serif text-left">Tanggapan Kru:</p>
                    <div className="flex flex-wrap gap-1.5 justify-start text-xs font-serif">
                      {room.players
                        .filter((p) => p.id !== activePlayer.id)
                        .map((p) => {
                          const reaction = room.activeQuestion!.reactions[p.id];
                          return (
                            <div key={p.id} className="bg-amber-200/50 px-2.5 py-1 rounded border border-amber-800/20">
                              {p.name}: <span className="font-bold uppercase tracking-wider">{reaction || '?'}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Actions */}
                  {isMeActive ? (
                    <div className="pt-2">
                      <p className="text-xs text-amber-700 font-serif italic mb-2">
                        Setelah setidaknya 1 teman bereaksi, waktu 45 detik berjalan. Anda bisa menebak sekarang jika siap.
                      </p>
                      <button 
                        onClick={guessNow}
                        className="btn-pirate btn-pirate-gold w-full py-3"
                      >
                        Menebak Sekarang (Batas waktu 15 detik)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-amber-950/20">
                      {isSpectator ? (
                        <p className="text-xs text-amber-700 font-serif italic">
                          Anda sudah selesai menebak. Berikan reaction untuk membantu teman Anda!
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 font-serif italic">
                          Beri reaksi untuk pertanyaan {activePlayer?.name}:
                        </p>
                      )}
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => submitQuestionReaction('ya')}
                          className={`btn-pirate py-2 text-sm ${room.activeQuestion.reactions[playerId!] === 'ya' ? 'bg-emerald-950 border-emerald-500 text-emerald-100' : ''}`}
                        >
                          Ya
                        </button>
                        <button 
                          onClick={() => submitQuestionReaction('tidak')}
                          className={`btn-pirate py-2 text-sm ${room.activeQuestion.reactions[playerId!] === 'tidak' ? 'bg-red-950 border-red-500 text-red-100' : ''}`}
                        >
                          Tidak
                        </button>
                        <button 
                          onClick={() => submitQuestionReaction('mungkin')}
                          className={`btn-pirate py-2 text-sm ${room.activeQuestion.reactions[playerId!] === 'mungkin' ? 'bg-amber-950 border-amber-500 text-amber-100' : ''}`}
                        >
                          Mungkin
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FASE 3: GUESSING (15s timer to write down the guess name) */}
              {room.turnPhase === 'GUESSING' && (
                <div className="w-full text-center space-y-4">
                  <TimerCountdown expiryEpoch={room.timerEndEpoch} />
                  
                  {isMeActive ? (
                    <form onSubmit={handleGuessSubmit} className="space-y-3">
                      <h3 className="heading-pirate text-lg text-left m-0">Ketik Tebakan Anda!</h3>
                      <p className="text-xs text-left text-amber-800 font-serif italic m-0">
                        Masukkan nama karakter One Piece yang Anda duga adalah karakter rahasia Anda. Ingat, tebakan salah akan mengurangi nyawa Anda! Anda juga bisa melewatinya.
                      </p>
                      <AutocompleteInput
                        id="guessName"
                        value={guessName}
                        onChange={setGuessName}
                        placeholder="Ketik tebakan nama karakter..."
                      />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button 
                          type="button" 
                          onClick={skipGuessing}
                          className="btn-pirate py-3 text-amber-900 border-amber-900 bg-transparent"
                        >
                          Lewati (Skip)
                        </button>
                        <button 
                          type="submit" 
                          className="btn-pirate btn-pirate-gold py-3"
                          disabled={!guessName.trim()}
                        >
                          Kirim Tebakan
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="py-6 font-serif">
                      <div className="animate-pulse text-4xl mb-2">🤔</div>
                      <p className="text-sm font-semibold text-amber-950">
                        Menunggu {activePlayer?.name} memasukkan nama tebakan karakternya...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Voting Guess layout removed since guessing is evaluated instantly on the server */}

            </div>
          </div>

          <div className="game-column-sidebar">
            {/* Previous Questions Log */}
            {me && me.questionsHistory && me.questionsHistory.length > 0 && (
              <div className="logbook-card py-3 px-4 mb-4">
                <h3 className="heading-pirate text-sm text-left border-b border-amber-950 pb-1 mb-2 flex items-center gap-1">
                  📜 Riwayat Pertanyaan Anda
                </h3>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {me.questionsHistory.slice().reverse().map((q, idx) => (
                    <div key={idx} className="bg-amber-100/40 p-2 rounded border border-amber-950/10 text-xs font-serif">
                      <div className="font-semibold text-amber-950 mb-1">"{q.text}"</div>
                      <div className="flex gap-2">
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-600/20 font-bold">
                          Ya: {q.ya}
                        </span>
                        <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-600/20 font-bold">
                          Tidak: {q.tidak}
                        </span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-600/20 font-bold">
                          Mungkin: {q.mungkin}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players Status Deck */}
            <div className="logbook-card">
              <h3 className="heading-pirate text-sm text-left border-b border-amber-950 pb-1 mb-3 flex items-center gap-1">
                <Users className="w-4 h-4" /> Status Kru Kapal
              </h3>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {room.players.map((p) => {
                  const isActive = activePlayer && activePlayer.id === p.id;
                  const isPMe = p.id === playerId;
                  
                  // Hearts generator
                  const hearts = [];
                  const remaining = 3 - p.guessesCount;
                  for (let i = 0; i < 3; i++) {
                    const isActiveHeart = i < remaining;
                    hearts.push(
                      <Heart 
                        key={i} 
                        className={`heart-icon ${isActiveHeart ? 'active' : 'used'}`} 
                      />
                    );
                  }

                  return (
                    <div 
                      key={p.id} 
                      className={`player-row py-2 px-3 text-xs ${
                        isActive ? 'active' : ''
                      } ${p.hasGuessedCorrectly ? 'correct border-green-700 bg-green-50/50' : ''} ${p.failedToGuess ? 'failed border-red-700 bg-red-50/50' : ''}`}
                    >
                      <div className="flex flex-col font-serif font-semibold truncate max-w-[160px]">
                        <div className="flex items-center gap-1">
                          {room.hostId === p.id && <Crown className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                          <span className="truncate">{p.name} {isPMe ? '(Anda)' : ''}</span>
                        </div>
                        <div className="text-[10px] text-amber-800 font-normal italic mt-0.5 leading-none">
                          Tebak: {isPMe ? '???' : p.assignedCharacter}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-0.5">
                          {hearts}
                        </div>
                        <span className="font-bold min-w-[50px] text-right">
                          {p.hasGuessedCorrectly && <span className="text-green-700">✔ LOLOS</span>}
                          {p.failedToGuess && <span className="text-red-700">💀 GAGAL</span>}
                          {!p.hasGuessedCorrectly && !p.failedToGuess && <span className="text-amber-800">MAIN</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Game Over Scoreboard View
  if (room.status === 'GAME_OVER') {
    const formatTime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
      <div className="px-4 py-8 min-h-screen flex flex-col justify-center">
        <h1 className="heading-pirate text-3xl mb-1 flex items-center justify-center gap-1">
          ☠️ Game Selesai!
        </h1>
        <p className="text-center text-xs italic text-amber-500 mb-6 font-serif">
          Semua kru telah mendarat. Berikut hasil catatannya:
        </p>

        <div className="game-layout-grid">
          <div className="game-column-main">
            <div className="logbook-card text-center mb-6">
              <h2 className="heading-pirate text-xl border-b border-amber-950 pb-2 mb-4">
                Papan Skor Akhir
              </h2>
              
              <div className="space-y-3 text-left">
                {room.players.map((p) => (
                  <div 
                    key={p.id} 
                    className={`p-3 rounded-lg border flex flex-col font-serif ${
                      p.hasGuessedCorrectly 
                        ? 'bg-green-50 border-green-800 text-green-900' 
                        : 'bg-red-50 border-red-800 text-red-900'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span className="flex items-center gap-1">
                        {p.id === playerId ? '(Anda) ' : ''}
                        {p.name}
                      </span>
                      <span>{p.hasGuessedCorrectly ? '✔ BERHASIL' : '💀 GAGAL'}</span>
                    </div>
                    <div className="text-xs mt-1 text-stone-700 flex flex-wrap justify-between gap-2">
                      <span>Karakter: <strong className="text-stone-900">{p.assignedCharacter}</strong></span>
                      <span>Percobaan: <strong className="text-stone-900">{p.guessesCount}/3</strong></span>
                      {p.hasGuessedCorrectly && p.guessTimeMs !== undefined && p.guessTimeMs !== null && (
                        <span>Waktu: <strong className="text-stone-900">{formatTime(p.guessTimeMs)}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="game-column-sidebar">
            <div className="logbook-card space-y-3">
              <h3 className="heading-pirate text-lg text-left border-b border-amber-950 pb-1 mb-3">Tindakan Room</h3>
              {isHost ? (
                <button onClick={restartGame} className="btn-pirate btn-pirate-gold w-full py-4 text-lg">
                  <RotateCcw className="w-5 h-5" /> Main Lagi!
                </button>
              ) : (
                <div className="text-center font-serif text-amber-800 bg-amber-100/40 p-4 rounded-lg border border-amber-950/20">
                  Menunggu kapten (host) me-restart permainan...
                </div>
              )}
              
              <button onClick={leaveRoom} className="btn-pirate btn-pirate-red w-full py-3">
                <LogOut className="w-4 h-4" /> Kembali ke Menu Utama
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function App() {
  return (
    <GameProvider>
      <GameApp />
    </GameProvider>
  );
}
