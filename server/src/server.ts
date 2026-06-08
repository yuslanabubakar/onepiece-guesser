import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { assignCharacters } from './matching.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In development, allow all origins
    methods: ['GET', 'POST'],
  },
});

interface Player {
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

interface Question {
  text: string;
  reactions: { [playerId: string]: 'ya' | 'tidak' | 'mungkin' };
}

interface Guess {
  characterName: string;
  reactions: { [playerId: string]: 'benar' | 'salah' };
}

interface Room {
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
}

// In-memory rooms store
const rooms: { [roomId: string]: Room } = {};
// Active timeouts for timers to avoid multiple schedules colliding
const roomTimeouts: { [roomId: string]: NodeJS.Timeout } = {};
// Host transfer timeouts to delay transferring host on disconnect
const hostTransferTimeouts: { [roomId: string]: NodeJS.Timeout } = {};

const MAX_PLAYERS = 7;
const THINK_TIME_MS = 45000;
const GUESS_TIME_MS = 15000;
const VOTE_TIME_MS = 15000;

function broadcastRoomState(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('room_state', room);
}

function clearRoomTimeout(roomId: string) {
  if (roomTimeouts[roomId]) {
    clearTimeout(roomTimeouts[roomId]);
    delete roomTimeouts[roomId];
  }
}

// Check if player's guess matches their assigned character
function isGuessCorrect(guess: string, assigned: string): boolean {
  const g = guess.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const a = assigned.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  
  if (!g || !a) return false;
  
  // Exact match
  if (g === a) return true;
  
  // Substring match (if one contains the other)
  if (g.length >= 3 && a.length >= 3) {
    if (g.includes(a) || a.includes(g)) return true;
  }
  
  return false;
}

// Selects the next player who needs to guess
function advanceTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  clearRoomTimeout(roomId);
  
  if (room.activeQuestion) {
    const activePlayer = room.players[room.turnIndex];
    if (!activePlayer.questionsHistory) {
      activePlayer.questionsHistory = [];
    }
    const reactions = Object.values(room.activeQuestion.reactions);
    const ya = reactions.filter((r) => r === 'ya').length;
    const tidak = reactions.filter((r) => r === 'tidak').length;
    const mungkin = reactions.filter((r) => r === 'mungkin').length;
    
    activePlayer.questionsHistory.push({
      text: room.activeQuestion.text,
      ya,
      tidak,
      mungkin,
    });
  }

  room.activeQuestion = null;
  room.activeGuess = null;

  const activePlayers = room.players.filter(
    (p) => !p.hasGuessedCorrectly && !p.failedToGuess
  );

  if (activePlayers.length === 0) {
    // Everyone has finished guessing
    room.status = 'GAME_OVER';
    room.turnPhase = 'NONE';
    room.timerEndEpoch = null;
    room.timerDuration = null;
    broadcastRoomState(roomId);
    return;
  }

  // Find the next active player
  let nextIndex = room.turnIndex;
  let attempts = 0;
  
  do {
    nextIndex = (nextIndex + 1) % room.players.length;
    attempts++;
  } while (
    (room.players[nextIndex].hasGuessedCorrectly ||
      room.players[nextIndex].failedToGuess) &&
    attempts < room.players.length
  );

  room.turnIndex = nextIndex;
  room.turnPhase = 'ASKING';
  room.timerEndEpoch = null;
  room.timerDuration = null;

  broadcastRoomState(roomId);
}

// Start the 15-second guess timer
function startGuessingTimer(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  clearRoomTimeout(roomId);
  room.turnPhase = 'GUESSING';
  room.timerDuration = GUESS_TIME_MS;
  room.timerEndEpoch = Date.now() + GUESS_TIME_MS;
  broadcastRoomState(roomId);

  roomTimeouts[roomId] = setTimeout(() => {
    // If they didn't submit a guess, they skip guessing and turn advances
    advanceTurn(roomId);
  }, GUESS_TIME_MS);
}

// Voting phase is removed, guess is evaluated immediately

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ playerName }: { playerName: string }) => {
    if (!playerName || playerName.trim() === '') {
      socket.emit('error', 'Nama pemain tidak boleh kosong');
      return;
    }

    const roomId = uuidv4().slice(0, 6).toUpperCase();
    const playerId = uuidv4();

    const host: Player = {
      id: playerId,
      name: playerName.trim(),
      socketId: socket.id,
      suggestions: [],
      assignedCharacter: null,
      guessesCount: 0,
      hasGuessedCorrectly: false,
      failedToGuess: false,
      questionsHistory: [],
    };

    rooms[roomId] = {
      id: roomId,
      hostId: playerId,
      players: [host],
      status: 'LOBBY',
      turnIndex: 0,
      activeQuestion: null,
      activeGuess: null,
      turnPhase: 'NONE',
      timerEndEpoch: null,
      timerDuration: null,
    };

    socket.join(roomId);
    socket.emit('room_created', { roomId, playerId, roomState: rooms[roomId] });
    console.log(`Room created: ${roomId} by host ${playerName}`);
  });

  // Join Room
  socket.on(
    'join_room',
    ({ roomId, playerName, playerId }: { roomId: string; playerName: string; playerId?: string }) => {
      const id = roomId ? roomId.toUpperCase() : '';
      const room = rooms[id];

      if (!room) {
        socket.emit('error', 'Room tidak ditemukan');
        return;
      }

      // Check if player is already in room (reconnect or duplicate tab)
      let player = room.players.find(
        (p) => playerId && p.id === playerId
      );

      // If in LOBBY, we can also match by name if the player was disconnected (to allow simple name-based re-entry)
      if (!player && room.status === 'LOBBY') {
        player = room.players.find(
          (p) => p.name.toLowerCase() === playerName.trim().toLowerCase() && p.socketId === null
        );
      }

      if (!player && room.status !== 'LOBBY') {
        socket.emit('error', 'Game sudah dimulai, tidak bisa bergabung');
        return;
      }

      if (player) {
        player.socketId = socket.id;
        // Clear host transfer timeout if this player is the host
        if (room.hostId === player.id) {
          if (hostTransferTimeouts[id]) {
            clearTimeout(hostTransferTimeouts[id]);
            delete hostTransferTimeouts[id];
            console.log(`Cancelled host transfer timeout for room ${id} as host joined.`);
          }
        }
      } else {
        if (room.players.length >= MAX_PLAYERS) {
          socket.emit('error', `Room penuh! Maksimal ${MAX_PLAYERS} pemain`);
          return;
        }

        const newPlayerId = playerId || uuidv4();
        player = {
          id: newPlayerId,
          name: playerName.trim(),
          socketId: socket.id,
          suggestions: [],
          assignedCharacter: null,
          guessesCount: 0,
          hasGuessedCorrectly: false,
          failedToGuess: false,
          questionsHistory: [],
        };
        room.players.push(player);
      }

      socket.join(id);
      socket.emit('room_joined', { roomId: id, playerId: player.id, roomState: room });
      io.to(id).emit('player_joined', { name: player.name });
      broadcastRoomState(id);
      console.log(`Player ${player.name} joined room ${id}`);
    }
  );

  // Reconnect Player
  socket.on('reconnect_player', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('reconnect_failed', 'Room tidak ditemukan');
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      socket.emit('reconnect_failed', 'Pemain tidak terdaftar di room ini');
      return;
    }

    // Clear host transfer timeout if this player is the host and reconnecting
    if (room.hostId === playerId) {
      if (hostTransferTimeouts[roomId]) {
        clearTimeout(hostTransferTimeouts[roomId]);
        delete hostTransferTimeouts[roomId];
        console.log(`Cancelled host transfer timeout for room ${roomId} as host reconnected.`);
      }
    }

    player.socketId = socket.id;
    socket.join(roomId);
    socket.emit('reconnected', room);
    broadcastRoomState(roomId);
    console.log(`Player ${player.name} reconnected to room ${roomId}`);
  });

  // Start Suggestion Phase
  socket.on('start_game', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== playerId) {
      socket.emit('error', 'Hanya host yang bisa memulai permainan');
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', 'Butuh minimal 2 pemain untuk bermain');
      return;
    }

    room.status = 'SUGGESTING';
    broadcastRoomState(roomId);
  });

  // Submit Suggestions
  socket.on(
    'submit_suggestions',
    ({ roomId, playerId, suggestions }: { roomId: string; playerId: string; suggestions: string[] }) => {
      const room = rooms[roomId];
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      // Clean suggestions and limit to max 3
      player.suggestions = suggestions.map((s) => s.trim()).filter((s) => s !== '').slice(0, 3);
      broadcastRoomState(roomId);

      // Check if all active players have submitted at least 1 suggestion
      const activePlayers = room.players.filter((p) => !p.failedToGuess);
      const allSubmitted = activePlayers.every((p) => p.suggestions.length > 0);
      if (allSubmitted) {
        // Try to assign characters
        const assignments = assignCharacters(activePlayers);
        if (assignments) {
          // Success! Assign characters and start playing
          room.players.forEach((p) => {
            if (p.failedToGuess) {
              p.assignedCharacter = null;
            } else {
              p.assignedCharacter = assignments[p.id];
            }
            p.guessTimeMs = null;
          });
          room.status = 'PLAYING';
          room.gameStartEpoch = Date.now();
          const firstActiveIndex = room.players.findIndex((p) => !p.failedToGuess);
          room.turnIndex = firstActiveIndex !== -1 ? firstActiveIndex : 0;
          room.turnPhase = 'ASKING';
          io.to(roomId).emit('game_alert', {
            type: 'info',
            message: 'Semua karakter telah dibagikan! Mulai tebak karakter Anda!',
          });
          broadcastRoomState(roomId);
        } else {
          // Bipartite matching failed (not enough unique names or too many overlaps)
          // Reset suggestions for all or tell them to modify
          io.to(roomId).emit('assignment_failed', 'Karakter bentrok! Kurang variasi karakter unik. Mohon host meminta pemain merubah usulan.');
          // Reset everyone's suggestions so they can resubmit
          room.players.forEach((p) => {
            p.suggestions = [];
          });
          broadcastRoomState(roomId);
        }
      }
    }
  );

  // Submit Question
  socket.on(
    'submit_question',
    ({ roomId, playerId, questionText }: { roomId: string; playerId: string; questionText: string }) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'PLAYING') return;

      const activePlayer = room.players[room.turnIndex];
      if (activePlayer.id !== playerId) return;

      room.activeQuestion = {
        text: questionText.trim(),
        reactions: {},
      };
      room.turnPhase = 'THINKING';
      broadcastRoomState(roomId);
    }
  );

  // Submit Question Reaction
  socket.on(
    'submit_question_reaction',
    ({
      roomId,
      playerId,
      reaction,
    }: {
      roomId: string;
      playerId: string;
      reaction: 'ya' | 'tidak' | 'mungkin';
    }) => {
      const room = rooms[roomId];
      if (!room || !room.activeQuestion) return;

      // Active player cannot react to their own question
      const activePlayer = room.players[room.turnIndex];
      if (activePlayer.id === playerId) return;

      const isFirstReaction = Object.keys(room.activeQuestion.reactions).length === 0;

      room.activeQuestion.reactions[playerId] = reaction;

      // Start 45s think timer on the first reaction
      if (isFirstReaction) {
        room.timerDuration = THINK_TIME_MS;
        room.timerEndEpoch = Date.now() + THINK_TIME_MS;
        broadcastRoomState(roomId);

        clearRoomTimeout(roomId);
        roomTimeouts[roomId] = setTimeout(() => {
          // If think timer expires, proceed directly to guessing phase
          startGuessingTimer(roomId);
        }, THINK_TIME_MS);
      } else {
        broadcastRoomState(roomId);
      }
    }
  );

  // Skip Guessing (Active player decides to skip early)
  socket.on('skip_guessing', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'PLAYING') return;

    const activePlayer = room.players[room.turnIndex];
    if (activePlayer.id !== playerId) return;

    advanceTurn(roomId);
  });

  // Start Guessing Phase (Active player decides to guess early)
  socket.on('guess_now', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'PLAYING') return;

    const activePlayer = room.players[room.turnIndex];
    if (activePlayer.id !== playerId) return;

    startGuessingTimer(roomId);
  });

  // Submit Guess (Active player inputs their guess)
  socket.on(
    'submit_guess',
    ({ roomId, playerId, characterName }: { roomId: string; playerId: string; characterName: string }) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'PLAYING') return;

      const activePlayer = room.players[room.turnIndex];
      if (activePlayer.id !== playerId) return;

      clearRoomTimeout(roomId);

      const guessName = characterName.trim();
      const isCorrect = activePlayer.assignedCharacter
        ? isGuessCorrect(guessName, activePlayer.assignedCharacter)
        : false;

      if (isCorrect) {
        activePlayer.hasGuessedCorrectly = true;
        if (room.gameStartEpoch) {
          activePlayer.guessTimeMs = Date.now() - room.gameStartEpoch;
        }
        io.to(roomId).emit('game_alert', {
          type: 'success',
          message: `${activePlayer.name} berhasil menebak karakternya: ${guessName}!`,
        });
      } else {
        activePlayer.guessesCount += 1;
        if (activePlayer.guessesCount >= 3) {
          activePlayer.failedToGuess = true;
          io.to(roomId).emit('game_alert', {
            type: 'danger',
            message: `${activePlayer.name} gagal menebak dan telah kehabisan kesempatan! Karakter aslinya adalah: ${activePlayer.assignedCharacter}`,
          });
        } else {
          io.to(roomId).emit('game_alert', {
            type: 'info',
            message: `Tebakan ${activePlayer.name} (${guessName}) salah! Kesempatan tersisa: ${3 - activePlayer.guessesCount}`,
          });
        }
      }

      advanceTurn(roomId);
    }
  );

  // Leave Room
  socket.on('leave_room', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    const player = room.players[playerIndex];
    console.log(`Player ${player.name} explicitly left room ${roomId}`);

    if (room.status === 'LOBBY') {
      // In LOBBY, remove the player completely
      room.players.splice(playerIndex, 1);
      
      // If room is empty, clean it up
      const allDisconnected = room.players.every((p) => p.socketId === null);
      if (room.players.length === 0 || allDisconnected) {
        clearRoomTimeout(roomId);
        if (hostTransferTimeouts[roomId]) {
          clearTimeout(hostTransferTimeouts[roomId]);
          delete hostTransferTimeouts[roomId];
        }
        delete rooms[roomId];
        console.log(`Cleaned up empty room: ${roomId}`);
      } else {
        // If the player who left was the host, reassign host
        if (room.hostId === playerId) {
          // Clear any pending host transfer timeout
          if (hostTransferTimeouts[roomId]) {
            clearTimeout(hostTransferTimeouts[roomId]);
            delete hostTransferTimeouts[roomId];
          }
          const nextHost = room.players.find((p) => p.socketId !== null);
          if (nextHost) {
            room.hostId = nextHost.id;
            io.to(roomId).emit('game_alert', {
              type: 'info',
              message: `${nextHost.name} sekarang menjadi Host Room.`,
            });
          }
        }
        io.to(roomId).emit('player_left', { name: player.name });
        broadcastRoomState(roomId);
      }
    } else {
      // In SUGGESTING, PLAYING, or GAME_OVER, mark them as gugur/failedToGuess
      player.failedToGuess = true;
      player.socketId = null;
      
      io.to(roomId).emit('game_alert', {
        type: 'danger',
        message: `${player.name} telah keluar dari permainan dan dianggap gugur!`,
      });

      // If they were the host, reassign host
      if (room.hostId === playerId) {
        if (hostTransferTimeouts[roomId]) {
          clearTimeout(hostTransferTimeouts[roomId]);
          delete hostTransferTimeouts[roomId];
        }
        const nextHost = room.players.find((p) => p.socketId !== null);
        if (nextHost) {
          room.hostId = nextHost.id;
          io.to(roomId).emit('game_alert', {
            type: 'info',
            message: `${nextHost.name} sekarang menjadi Host Room.`,
          });
        }
      }

      // If SUGGESTING phase, check if remaining players have all submitted suggestions
      if (room.status === 'SUGGESTING') {
        const activePlayers = room.players.filter((p) => !p.failedToGuess);
        const allSubmitted = activePlayers.every((p) => p.suggestions.length > 0);
        if (allSubmitted && activePlayers.length >= 2) {
          const assignments = assignCharacters(activePlayers);
          if (assignments) {
            room.players.forEach((p) => {
              if (p.failedToGuess) {
                p.assignedCharacter = null;
              } else {
                p.assignedCharacter = assignments[p.id];
              }
              p.guessTimeMs = null;
            });
            room.status = 'PLAYING';
            room.gameStartEpoch = Date.now();
            const firstActiveIndex = room.players.findIndex((p) => !p.failedToGuess);
            room.turnIndex = firstActiveIndex !== -1 ? firstActiveIndex : 0;
            room.turnPhase = 'ASKING';
            io.to(roomId).emit('game_alert', {
              type: 'info',
              message: 'Semua karakter telah dibagikan! Mulai tebak karakter Anda!',
            });
          } else {
            io.to(roomId).emit('assignment_failed', 'Karakter bentrok! Kurang variasi karakter unik. Mohon host meminta pemain merubah usulan.');
            room.players.forEach((p) => {
              p.suggestions = [];
            });
          }
        } else if (activePlayers.length < 2) {
          room.status = 'GAME_OVER';
          room.turnPhase = 'NONE';
          io.to(roomId).emit('game_alert', {
            type: 'danger',
            message: 'Pemain aktif kurang dari 2, permainan berakhir.',
          });
        }
      }

      // If PLAYING phase, handle turn advancement
      if (room.status === 'PLAYING') {
        const activePlayer = room.players[room.turnIndex];
        if (activePlayer && activePlayer.id === playerId) {
          advanceTurn(roomId);
        } else {
          const remainingActive = room.players.filter((p) => !p.hasGuessedCorrectly && !p.failedToGuess);
          if (remainingActive.length === 0) {
            room.status = 'GAME_OVER';
            room.turnPhase = 'NONE';
            room.timerEndEpoch = null;
            room.timerDuration = null;
          }
        }
      }

      broadcastRoomState(roomId);
    }

    socket.leave(roomId);
  });

  // Kick Player
  socket.on(
    'kick_player',
    ({ roomId, playerId, targetPlayerId }: { roomId: string; playerId: string; targetPlayerId: string }) => {
      const room = rooms[roomId];
      if (!room) return;

      if (room.hostId !== playerId) {
        socket.emit('error', 'Hanya host yang bisa menendang pemain');
        return;
      }

      if (room.status !== 'LOBBY') {
        socket.emit('error', 'Hanya bisa menendang pemain saat di Lobby');
        return;
      }

      const targetIndex = room.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIndex === -1) return;

      const targetPlayer = room.players[targetIndex];
      room.players.splice(targetIndex, 1);

      if (targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('kicked');
        const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
        if (targetSocket) {
          targetSocket.leave(roomId);
        }
      }

      io.to(roomId).emit('game_alert', {
        type: 'info',
        message: `${targetPlayer.name} telah ditendang oleh Host.`,
      });

      broadcastRoomState(roomId);
    }
  );

  // Restart Game (Keep players, reset scores/state)
  socket.on('restart_game', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== playerId) {
      socket.emit('error', 'Hanya host yang bisa merestart permainan');
      return;
    }

    clearRoomTimeout(roomId);
    room.status = 'SUGGESTING';
    room.turnIndex = 0;
    room.activeQuestion = null;
    room.activeGuess = null;
    room.turnPhase = 'NONE';
    room.timerEndEpoch = null;
    room.timerDuration = null;

    room.players.forEach((p) => {
      p.suggestions = [];
      p.assignedCharacter = null;
      p.guessesCount = 0;
      p.hasGuessedCorrectly = false;
      p.failedToGuess = false;
      p.questionsHistory = [];
    });

    broadcastRoomState(roomId);
    io.to(roomId).emit('game_alert', {
      type: 'info',
      message: 'Game telah di-restart! Silakan masukkan usulan karakter baru.',
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find room and player
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        player.socketId = null; // Mark as disconnected
        
        io.to(roomId).emit('player_left', { name: player.name });
        
        // If room is empty (all socketIds are null), we could clean it up after some time
        const allDisconnected = room.players.every((p) => p.socketId === null);
        if (allDisconnected) {
          clearRoomTimeout(roomId);
          if (hostTransferTimeouts[roomId]) {
            clearTimeout(hostTransferTimeouts[roomId]);
            delete hostTransferTimeouts[roomId];
          }
          // Wait 5 minutes before deleting the room in case of reconnection
          roomTimeouts[roomId] = setTimeout(() => {
            delete rooms[roomId];
            console.log(`Cleaned up empty room: ${roomId}`);
          }, 300000);
        } else {
          // If the disconnected player was the host, reassign host after delay
          if (room.hostId === player.id) {
            if (hostTransferTimeouts[roomId]) {
              clearTimeout(hostTransferTimeouts[roomId]);
            }
            hostTransferTimeouts[roomId] = setTimeout(() => {
              const r = rooms[roomId];
              if (r && r.hostId === player.id) {
                const hostPlayer = r.players.find((p) => p.id === player.id);
                if (hostPlayer && hostPlayer.socketId === null) {
                  const nextHost = r.players.find((p) => p.socketId !== null);
                  if (nextHost) {
                    r.hostId = nextHost.id;
                    io.to(roomId).emit('game_alert', {
                      type: 'info',
                      message: `${nextHost.name} sekarang menjadi Host Room.`,
                    });
                    broadcastRoomState(roomId);
                  }
                }
              }
              delete hostTransferTimeouts[roomId];
            }, 8000);
          }
        }
        
        broadcastRoomState(roomId);
        break;
      }
    }
  });
});

// Basic Express API routes
app.get('/health', (req, res) => {
  res.send('Den Den Trivia server is running!');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
