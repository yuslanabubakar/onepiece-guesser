export interface PlayerSuggestion {
  id: string;
  suggestions: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function tryMatch(
  players: PlayerSuggestion[],
  allSuggestions: string[]
): { [playerId: string]: string } | null {
  const n = players.length;
  const order = shuffle(players.map((_, i) => i));
  const matchR: { [character: string]: number } = {};

  function bpm(u: number, seen: Set<string>): boolean {
    const player = players[u];
    for (const char of shuffle(allSuggestions)) {
      if (player.suggestions.includes(char)) continue;
      if (seen.has(char)) continue;
      seen.add(char);
      if (matchR[char] === undefined || bpm(matchR[char], seen)) {
        matchR[char] = u;
        return true;
      }
    }
    return false;
  }

  for (const u of order) {
    const seen = new Set<string>();
    if (!bpm(u, seen)) {
      return null;
    }
  }

  const result: { [playerId: string]: string } = {};
  for (const char of Object.keys(matchR)) {
    result[players[matchR[char]].id] = char;
  }

  if (Object.keys(result).length !== n) return null;
  return result;
}

function diversityScore(
  assignment: { [playerId: string]: string },
  suggesters: { [character: string]: string[] }
): number {
  const counts: { [playerId: string]: number } = {};
  for (const character of Object.values(assignment)) {
    const owners = suggesters[character] || [];
    if (owners.length === 0) continue;
    const share = 1 / owners.length;
    for (const owner of owners) {
      counts[owner] = (counts[owner] || 0) + share;
    }
  }
  let sumSquares = 0;
  for (const id of Object.keys(counts)) {
    sumSquares += counts[id] * counts[id];
  }
  return -sumSquares;
}

export function assignCharacters(
  players: PlayerSuggestion[]
): { [playerId: string]: string } | null {
  const n = players.length;
  if (n === 0) return {};

  const allSuggestions = Array.from(
    new Set(players.flatMap((p) => p.suggestions))
  );

  if (allSuggestions.length < n) {
    return null;
  }

  const suggesters: { [character: string]: string[] } = {};
  for (const p of players) {
    for (const s of p.suggestions) {
      (suggesters[s] = suggesters[s] || []).push(p.id);
    }
  }

  const ATTEMPTS = 60;
  let best: { [playerId: string]: string } | null = null;
  let bestScore = -Infinity;
  let anySuccess = false;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const candidate = tryMatch(players, allSuggestions);
    if (!candidate) continue;
    anySuccess = true;
    const score = diversityScore(candidate, suggesters);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return anySuccess ? best : null;
}
