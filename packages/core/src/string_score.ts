/**
 * Score how well `query` matches `target`, returning a value between 0 and 1.
 *
 * Based on the [string_score](https://github.com/joshaven/string_score) algorithm
 * with bonuses for:
 * - **Consecutive characters** — "hel" in "hello" scores higher than "h_e_l"
 * - **Start-of-word / acronym** — "HiMi" strongly matches "Hillsdale Michigan"
 * - **Case match** — exact case adds a small bonus
 * - **Shorter targets** — matching in a short string is worth more than in a long one
 *
 * Returns `1` for an exact match, `0` for no match (or if `query` is empty).
 * In strict mode (no fuzziness), a single unmatched character returns `0`.
 *
 * @param target - The string being scored against
 * @param query - The search query
 * @param fuzziness - Optional fuzziness factor (0–1). When set, unmatched characters
 *   degrade the score instead of returning 0 immediately.
 * @param lowerQuery - Pre-lowercased query for performance (avoids repeated `.toLowerCase()` calls).
 *   Computed automatically if omitted.
 * @returns Score between 0 (no match) and 1 (perfect match)
 */
export function string_score(
  target: string,
  query: string,
  fuzziness?: number,
  lowerQuery?: string,
  positions?: number[],
): number {
  // If the string is equal to the word, perfect match.
  if (target === query) {
    return 1;
  }

  // if it's not a perfect match and is empty return 0
  if (query === '') {
    return 0;
  }

  let runningScore = 0;
  let charScore: number;
  let finalScore: number;
  const rawString = target;
  const lString = rawString.toLowerCase();
  const strLength = rawString.length;
  const lWord = lowerQuery ?? query.toLowerCase();
  const wordLength = query.length;
  let idxOf: number;
  let startAt = 0;
  let fuzzies = 1;
  let fuzzyFactor = 0;
  let i: number;

  // Cache fuzzyFactor for speed increase
  if (fuzziness) {
    fuzzyFactor = 1 - fuzziness;
  }

  // Walk through word and add up scores.
  // Code duplication occurs to prevent checking fuzziness inside for loop
  if (fuzziness) {
    let prevFound = true;
    let misses = 0;
    for (i = 0; i < wordLength; i += 1) {
      // Find next first case-insensitive match of a character.
      idxOf = lString.indexOf(lWord.charAt(i), startAt);

      if (idxOf === -1) {
        fuzzies += fuzzyFactor;
        prevFound = false;
        misses++;
      } else {
        if (positions) positions.push(idxOf);
        if (startAt === idxOf && prevFound) {
          // Consecutive letter bonus — only when the previous query char
          // was also found (not skipped via fuzziness)
          charScore = 0.7;
        } else {
          charScore = 0.1;

          // Acronym Bonus
          // Weighing Logic: Typing the first character of an acronym is as if you
          // preceded it with two perfect character matches.
          if (rawString[idxOf - 1] === ' ') {
            charScore += 0.8;
          }
        }

        // Same case bonus.
        if (rawString[idxOf] === query[i]) {
          charScore += 0.1;
        }

        // Update scores and startAt position for next round of indexOf
        runningScore += charScore;
        startAt = idxOf + 1;
        prevFound = true;
      }
    }

    // Quadratic degradation: penalizes high miss ratios heavily
    // 0% miss → 1.0×, 50% miss → 0.25×, 75% miss → 0.0625×
    const missRatio = misses / wordLength;
    runningScore *= (1 - missRatio) * (1 - missRatio);
  } else {
    for (i = 0; i < wordLength; i += 1) {
      // Find next first case-insensitive match of a character.
      idxOf = lString.indexOf(lWord.charAt(i), startAt);

      if (-1 === idxOf) {
        return 0;
      }

      if (positions) positions.push(idxOf);

      if (startAt === idxOf) {
        // Consecutive letter & start-of-string Bonus
        charScore = 0.7;
      } else {
        charScore = 0.1;

        // Acronym Bonus
        // Weighing Logic: Typing the first character of an acronym is as if you
        // preceded it with two perfect character matches.
        if (rawString[idxOf - 1] === ' ') {
          charScore += 0.8;
        }
      }

      // Same case bonus.
      if (rawString[idxOf] === query[i]) {
        charScore += 0.1;
      }

      // Update scores and startAt position for next round of indexOf
      runningScore += charScore;
      startAt = idxOf + 1;
    }
  }

  // Reduce penalty for longer strings.
  finalScore = (0.3 * (runningScore / strLength) + 0.7 * (runningScore / wordLength)) / fuzzies;

  if (lWord[0] === lString[0] && finalScore < 0.85) {
    finalScore += 0.15;
  }

  return finalScore;
}
