/**
 * Find an assignment of characters to players such that:
 * 1. Each player gets exactly one character.
 * 2. No player gets a character they suggested.
 * 3. Each player gets a unique character.
 * 
 * We use Kuhn's algorithm for Maximum Bipartite Matching.
 */
export function assignCharacters(
  players: { id: string; suggestions: string[] }[]
): { [playerId: string]: string } | null {
  const n = players.length;
  if (n === 0) return {};

  // Get all unique character suggestions across all players
  const allSuggestions = Array.from(
    new Set(players.flatMap((p) => p.suggestions))
  );

  // If there are fewer unique characters than players, a perfect matching is impossible
  if (allSuggestions.length < n) {
    return null;
  }

  // matchR[char] stores the player index matched to character char
  const matchR: { [character: string]: number } = {};

  // Helper DFS function to find if a matching is possible for player u
  function bpm(u: number, seen: Set<string>): boolean {
    const player = players[u];
    
    // Try all characters in the pool
    for (const char of allSuggestions) {
      // Edge exists if the player did not suggest this character
      if (!player.suggestions.includes(char)) {
        if (!seen.has(char)) {
          seen.add(char); // Mark character as visited for this DFS path

          // If character is not matched to any player, OR
          // the player matched to character has an alternative match
          if (matchR[char] === undefined || bpm(matchR[char], seen)) {
            matchR[char] = u;
            return true;
          }
        }
      }
    }
    return false;
  }
  
  // Find matching for each player
  for (let i = 0; i < n; i++) {
    const seen = new Set<string>();
    if (!bpm(i, seen)) {
      // If we couldn't match a player, then a perfect matching of size n is impossible
      return null;
    }
  }

  // Convert matchR (character -> player index) to (playerId -> character)
  const result: { [playerId: string]: string } = {};
  for (const char of Object.keys(matchR)) {
    const playerIndex = matchR[char];
    const player = players[playerIndex];
    result[player.id] = char;
  }

  // Double check that we have assigned characters for all players
  if (Object.keys(result).length !== n) {
    return null;
  }

  return result;
}
