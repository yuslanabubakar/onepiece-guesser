import { assignCharacters, type PlayerSuggestion } from './matching';

interface Env {
  DB: D1Database;
}

interface EventContext {
  request: Request;
  env: Env;
}

export interface QuestionHistory {
  text: string;
  ya: number;
  tidak: number;
  mungkin: number;
}

export interface Player {
  id: string;
  googleId?: string;
  name: string;
  avatarUrl?: string;
  socketId: string;
  clientId?: string;
  suggestions: string[];
  assignedCharacter: string | null;
  hasGuessedCorrectly: boolean;
  failedToGuess: boolean;
  guessesCount: number;
  guessTimeMs?: number;
  questionsHistory?: QuestionHistory[];
}

export interface ActiveQuestion {
  text: string;
  askedBy: string;
  reactions: Record<string, 'ya' | 'tidak' | 'mungkin'>;
}

export interface ActiveGuess {
  characterName: string;
  guessedBy: string;
}

export interface Room {
  id: string;
  hostId: string;
  status: 'LOBBY' | 'SUGGESTING' | 'PLAYING' | 'GAME_OVER';
  players: Player[];
  turnIndex: number;
  turnPhase: 'NONE' | 'ASKING' | 'ANSWERING' | 'GUESSING';
  activeQuestion: ActiveQuestion | null;
  activeGuess: ActiveGuess | null;
  timerEndEpoch: number | null;
  timerDuration: number | null;
  gameStartEpoch: number | null;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// In-Memory Edge State
const rooms: Record<string, Room> = {};
const roomSockets: Record<string, Set<WebSocket>> = {};
const socketToPlayer: Map<WebSocket, { roomId: string; playerId: string }> = new Map();

function generateRoomId(): string {
  let id = Math.random().toString(36).substring(2, 8).toUpperCase();
  while (rooms[id]) {
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  return id;
}

function broadcastRoom(roomId: string) {
  const room = rooms[roomId];
  const sockets = roomSockets[roomId];
  if (!room || !sockets) return;

  const payload = JSON.stringify({ type: 'room_state', data: room });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      // ignore closed sockets
    }
  }
}

function sendAlert(ws: WebSocket, type: 'info' | 'success' | 'danger', message: string) {
  try {
    ws.send(JSON.stringify({ type: 'game_alert', data: { type, message } }));
  } catch {
    // ignore
  }
}

function broadcastAlert(roomId: string, type: 'info' | 'success' | 'danger', message: string) {
  const sockets = roomSockets[roomId];
  if (!sockets) return;
  const payload = JSON.stringify({ type: 'game_alert', data: { type, message } });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      // ignore
    }
  }
}

function broadcastChatMessage(roomId: string, msg: ChatMessage) {
  const sockets = roomSockets[roomId];
  if (!sockets) return;
  const payload = JSON.stringify({ type: 'chat_message', data: msg });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      // ignore
    }
  }
}

function isGuessCorrect(guess: string, target: string): boolean {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  return clean(guess) === clean(target);
}

function advanceTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

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
    room.status = 'GAME_OVER';
    room.turnPhase = 'NONE';
    room.timerEndEpoch = null;
    room.timerDuration = null;
    broadcastRoom(roomId);
    return;
  }

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
  broadcastRoom(roomId);
}

async function handleVictoryStatsUpdate(db: D1Database | undefined, googleId?: string) {
  if (!db || !googleId) return;
  try {
    await db
      .prepare(
        `
      INSERT INTO player_stats (user_id, games_played, wins, correct_guesses, total_guesses)
      VALUES (?, 1, 1, 1, 1)
      ON CONFLICT(user_id) DO UPDATE SET
        games_played = games_played + 1,
        wins = wins + 1,
        correct_guesses = correct_guesses + 1,
        total_guesses = total_guesses + 1
    `
      )
      .bind(googleId)
      .run();
  } catch (err) {
    console.error('Failed to update D1 stats on victory:', err);
  }
}

export async function onRequestGet(context: EventContext) {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  server.addEventListener('message', async (event: MessageEvent) => {
    try {
      const { type, payload } = JSON.parse(event.data as string);

      if (type === 'create_room') {
        const { playerName, clientId, avatarUrl, googleId } = payload;
        const roomId = generateRoomId();
        const playerId = clientId || `p_${Date.now()}`;

        const hostPlayer: Player = {
          id: playerId,
          googleId,
          name: playerName.trim(),
          avatarUrl,
          socketId: playerId,
          clientId: playerId,
          suggestions: [],
          assignedCharacter: null,
          hasGuessedCorrectly: false,
          failedToGuess: false,
          guessesCount: 0,
        };

        rooms[roomId] = {
          id: roomId,
          hostId: playerId,
          status: 'LOBBY',
          players: [hostPlayer],
          turnIndex: 0,
          turnPhase: 'NONE',
          activeQuestion: null,
          activeGuess: null,
          timerEndEpoch: null,
          timerDuration: null,
          gameStartEpoch: null,
          createdAt: Date.now(),
        };

        roomSockets[roomId] = roomSockets[roomId] || new Set();
        roomSockets[roomId].add(server);
        socketToPlayer.set(server, { roomId, playerId });

        server.send(
          JSON.stringify({
            type: 'room_created',
            data: { roomId, playerId, room: rooms[roomId] },
          })
        );
        broadcastRoom(roomId);
        return;
      }

      if (type === 'join_room') {
        const { roomId: rawRoomId, playerName, clientId, avatarUrl, googleId } = payload;
        const roomId = (rawRoomId || '').toUpperCase().trim();
        const room = rooms[roomId];

        if (!room) {
          server.send(JSON.stringify({ type: 'reconnect_failed', data: { message: 'Room tidak ditemukan' } }));
          return;
        }

        const effectiveClientId = clientId || `p_${Date.now()}`;
        const existingPlayer = room.players.find(
          (p) => p.id === effectiveClientId || (p.clientId && p.clientId === effectiveClientId)
        );

        let playerId: string;

        if (existingPlayer) {
          playerId = existingPlayer.id;
          existingPlayer.name = playerName.trim() || existingPlayer.name;
          if (avatarUrl) existingPlayer.avatarUrl = avatarUrl;
          if (googleId) existingPlayer.googleId = googleId;
        } else {
          if (room.status !== 'LOBBY') {
            server.send(
              JSON.stringify({
                type: 'reconnect_failed',
                data: { message: 'Game sudah berjalan, tidak bisa bergabung lagi' },
              })
            );
            return;
          }

          if (room.players.length >= 7) {
            server.send(
              JSON.stringify({
                type: 'reconnect_failed',
                data: { message: 'Room sudah penuh (maksimal 7 pemain)' },
              })
            );
            return;
          }

          playerId = effectiveClientId;
          const newPlayer: Player = {
            id: playerId,
            googleId,
            name: playerName.trim(),
            avatarUrl,
            socketId: playerId,
            clientId: effectiveClientId,
            suggestions: [],
            assignedCharacter: null,
            hasGuessedCorrectly: false,
            failedToGuess: false,
            guessesCount: 0,
          };
          room.players.push(newPlayer);
        }

        roomSockets[roomId] = roomSockets[roomId] || new Set();
        roomSockets[roomId].add(server);
        socketToPlayer.set(server, { roomId, playerId });

        server.send(
          JSON.stringify({
            type: 'room_joined',
            data: { roomId, playerId, room: rooms[roomId] },
          })
        );
        broadcastRoom(roomId);
        return;
      }

      const meta = socketToPlayer.get(server);
      if (!meta) return;
      const { roomId, playerId } = meta;
      const room = rooms[roomId];
      if (!room) return;

      if (type === 'start_game') {
        if (room.hostId !== playerId) return;
        if (room.players.length < 2) {
          sendAlert(server, 'danger', 'Dibutuhkan minimal 2 pemain untuk memulai permainan!');
          return;
        }
        room.status = 'SUGGESTING';
        room.turnPhase = 'NONE';
        broadcastRoom(roomId);
        return;
      }

      if (type === 'submit_suggestions') {
        const { suggestions } = payload;
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return;

        player.suggestions = (suggestions || []).map((s: string) => s.trim()).filter(Boolean);

        const allSubmitted = room.players.every((p) => p.suggestions.length > 0);
        if (allSubmitted) {
          const suggestionsData: PlayerSuggestion[] = room.players.map((p) => ({
            id: p.id,
            suggestions: p.suggestions,
          }));

          const assignment = assignCharacters(suggestionsData);

          if (!assignment) {
            broadcastAlert(
              roomId,
              'danger',
              'Karakter bentrok! Kurang variasi karakter unik. Mohon host meminta pemain merubah usulan.'
            );
            room.players.forEach((p) => (p.suggestions = []));
            room.status = 'SUGGESTING';
            broadcastRoom(roomId);
            return;
          }

          room.players.forEach((p) => {
            p.assignedCharacter = assignment[p.id] || null;
          });

          room.status = 'PLAYING';
          room.turnIndex = 0;
          room.turnPhase = 'ASKING';
          room.gameStartEpoch = Date.now();
          broadcastRoom(roomId);
        } else {
          broadcastRoom(roomId);
        }
        return;
      }

      if (type === 'submit_question') {
        const { questionText } = payload;
        if (room.status !== 'PLAYING') return;

        const activePlayer = room.players[room.turnIndex];
        if (activePlayer.id !== playerId) return;

        room.activeQuestion = {
          text: questionText.trim(),
          askedBy: playerId,
          reactions: {},
        };
        room.turnPhase = 'ANSWERING';
        broadcastRoom(roomId);
        return;
      }

      if (type === 'answer_question') {
        const { reaction } = payload;
        if (!room.activeQuestion || room.turnPhase !== 'ANSWERING') return;

        const activePlayer = room.players[room.turnIndex];
        if (activePlayer.id === playerId) return;

        room.activeQuestion.reactions[playerId] = reaction;
        broadcastRoom(roomId);
        return;
      }

      if (type === 'guess_now') {
        if (room.status !== 'PLAYING') return;
        const activePlayer = room.players[room.turnIndex];
        if (activePlayer.id !== playerId) return;

        room.turnPhase = 'GUESSING';
        broadcastRoom(roomId);
        return;
      }

      if (type === 'submit_guess') {
        const { characterName } = payload;
        if (room.status !== 'PLAYING') return;

        const activePlayer = room.players[room.turnIndex];
        if (activePlayer.id !== playerId) return;

        const guessName = (characterName || '').trim();
        const isCorrect = activePlayer.assignedCharacter
          ? isGuessCorrect(guessName, activePlayer.assignedCharacter)
          : false;

        if (isCorrect) {
          activePlayer.hasGuessedCorrectly = true;
          if (room.gameStartEpoch) {
            activePlayer.guessTimeMs = Date.now() - room.gameStartEpoch;
          }
          broadcastAlert(roomId, 'success', `${activePlayer.name} berhasil menebak karakternya: ${guessName}!`);
          await handleVictoryStatsUpdate(context.env.DB, activePlayer.googleId);
        } else {
          activePlayer.guessesCount += 1;
          if (activePlayer.guessesCount >= 3) {
            activePlayer.failedToGuess = true;
            broadcastAlert(
              roomId,
              'danger',
              `${activePlayer.name} gagal menebak dan telah kehabisan kesempatan! Karakter aslinya adalah: ${activePlayer.assignedCharacter}`
            );
          } else {
            broadcastAlert(
              roomId,
              'info',
              `Tebakan ${activePlayer.name} (${guessName}) salah! Kesempatan tersisa: ${3 - activePlayer.guessesCount}`
            );
          }
        }

        advanceTurn(roomId);
        return;
      }

      if (type === 'chat_message') {
        const { text } = payload;
        const player = room.players.find((p) => p.id === playerId);
        if (!player || !text.trim()) return;

        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          senderId: player.id,
          senderName: player.name,
          text: text.trim(),
          timestamp: Date.now(),
        };

        broadcastChatMessage(roomId, msg);
        return;
      }

      if (type === 'leave_room') {
        if (roomSockets[roomId]) {
          roomSockets[roomId].delete(server);
        }
        socketToPlayer.delete(server);
        const playerIndex = room.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
        }
        if (room.players.length === 0) {
          delete rooms[roomId];
          delete roomSockets[roomId];
        } else {
          if (room.hostId === playerId) {
            room.hostId = room.players[0].id;
          }
          broadcastRoom(roomId);
        }
        return;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  server.addEventListener('close', () => {
    const meta = socketToPlayer.get(server);
    if (!meta) return;
    const { roomId, playerId } = meta;
    socketToPlayer.delete(server);
    if (roomSockets[roomId]) {
      roomSockets[roomId].delete(server);
    }
    const room = rooms[roomId];
    if (!room) return;

    if (room.status === 'LOBBY') {
      const playerIndex = room.players.findIndex((p) => p.id === playerId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
      }
      if (room.players.length === 0) {
        delete rooms[roomId];
        delete roomSockets[roomId];
      } else {
        if (room.hostId === playerId) {
          room.hostId = room.players[0].id;
        }
        broadcastRoom(roomId);
      }
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
