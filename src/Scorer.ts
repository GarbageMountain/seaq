/**
 * string_score is an implementation of the string score algo developed by
 * https://github.com/joshaven/string_score
 *
 * @export
 * @param {string} target
 * @param {string} query
 * @param {number} [fuzziness]
 * @returns {number}
 */
export function string_score(
  target: string,
  query: string,
  fuzziness?: number,
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
  const lWord = query.toLowerCase();
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
    for (i = 0; i < wordLength; i += 1) {
      // Find next first case-insensitive match of a character.
      idxOf = lString.indexOf(lWord[i], startAt);

      if (idxOf === -1) {
        fuzzies += fuzzyFactor;
      } else {
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
  } else {
    for (i = 0; i < wordLength; i += 1) {
      // Find next first case-insensitive match of a character.
      idxOf = lString.indexOf(lWord[i], startAt);

      if (-1 === idxOf) {
        return 0;
      }

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
  finalScore =
    (0.5 * (runningScore / strLength + runningScore / wordLength)) / fuzzies;

  if (lWord[0] === lString[0] && finalScore < 0.85) {
    finalScore += 0.15;
  }

  return finalScore;
}
