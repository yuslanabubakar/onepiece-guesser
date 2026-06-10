/**
 * Find an assignment of characters to players such that:
 * 1. Each player gets exactly one character.
 * 2. No player gets a character they suggested.
 * 3. Each player gets a unique character.
 *
 * On top of a valid matching, we actively try to make the assignment
 * DIVERSE: characters should be drawn from as many different suggesters
 * as possible instead of mostly coming from a single player. We do this
 * by running several randomized matchings (Kuhn's algorithm with shuffled
 * orders) and keeping the one whose "origins" are spread out the most.
 */

interface PlayerSuggestion {
  id: string;
  suggestions: string[];
}

// Fisher-Yates shuffle (returns a new array)
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Attempt a single maximum bipartite matching using Kuhn's algorithm.
 * Both the player order and the candidate-character order are randomized
 * so repeated calls yield different (but always valid) assignments.
 */
function tryMatch(
  players: PlayerSuggestion[],
  allSuggestions: string[]
): { [playerId: string]: string } | null {
  const n = players.length;

  // Randomize which player we try to satisfy first.
  const order = shuffle(players.map((_, i) => i));
  // matchR[char] -> player index currently matched to that character
  const matchR: { [character: string]: number } = {};

  function bpm(u: number, seen: Set<string>): boolean {
    const player = players[u];
    // Randomize candidate order so the result varies between runs.
    for (const char of shuffle(allSuggestions)) {
      // An edge exists only if the player did NOT suggest this character.
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
      return null; // No perfect matching of size n possible.
    }
  }

  const result: { [playerId: string]: string } = {};
  for (const char of Object.keys(matchR)) {
    result[players[matchR[char]].id] = char;
  }

  if (Object.keys(result).length !== n) return null;
  return result;
}

/**
 * Diversity score for an assignment. We attribute every assigned character
 * to the player(s) who suggested it, then penalize concentration using the
 * sum of squares of per-suggester counts. A higher score means the assigned
 * characters are spread across more distinct suggesters.
 */
function diversityScore(
  assignment: { [playerId: string]: string },
  suggesters: { [character: string]: string[] }
): number {
  const counts: { [playerId: string]: number } = {};
  for (const character of Object.values(assignment)) {
    const owners = suggesters[character] || [];
    if (owners.length === 0) continue;
    // Spread the credit evenly when a character was suggested by several players.
    const share = 1 / owners.length;
    for (const owner of owners) {
      counts[owner] = (counts[owner] || 0) + share;
    }
  }
  let sumSquares = 0;
  for (const id of Object.keys(counts)) {
    sumSquares += counts[id] * counts[id];
  }
  // Negate: lower concentration (smaller sum of squares) => higher score.
  return -sumSquares;
}

export function assignCharacters(
  players: PlayerSuggestion[]
): { [playerId: string]: string } | null {
  const n = players.length;
  if (n === 0) return {};

  // All distinct suggested characters across the whole room.
  const allSuggestions = Array.from(
    new Set(players.flatMap((p) => p.suggestions))
  );

  // A perfect matching needs at least as many unique characters as players.
  if (allSuggestions.length < n) {
    return null;
  }

  // Map each character to the players who suggested it (its "origins").
  const suggesters: { [character: string]: string[] } = {};
  for (const p of players) {
    for (const s of p.suggestions) {
      (suggesters[s] = suggesters[s] || []).push(p.id);
    }
  }

  // Run several randomized matchings and keep the most diverse valid one.
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

  // If no randomized attempt found a matching, the constraints are infeasible.
  return anySuccess ? best : null;
}
