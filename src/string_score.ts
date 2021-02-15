/**
 * string_score is an implementation of the string score algo developed by
 * https://github.com/joshaven/string_score
 *
 * "hello world".score("axl") //=> 0
 * "hello world".score("ow")  //=> 0.35454545454545455
 *
 * // Single letter match
 * "hello world".score("e")           //=>0.1090909090909091
 *
 * // Single letter match plus bonuses for beginning of word and beginning of phrase
 * "hello world".score("h")           //=>0.5363636363636364
 *
 * "hello world".score("he")          //=>0.5727272727272728
 * "hello world".score("hel")         //=>0.6090909090909091
 * "hello world".score("hell")        //=>0.6454545454545455
 * "hello world".score("hello")       //=>0.6818181818181818
 *  ...
 * "hello world".score("hello worl")  //=>0.8636363636363635
 * "hello world".score("hello world") //=> 1
 *
 *
 * // Using a "1" in place of an "l" is a mismatch unless the score is fuzzy
 * "hello world".score("hello wor1")  //=>0
 * "hello world".score("hello wor1",0.5)  //=>0.6081818181818182 (fuzzy)
 *
 * // Finding a match in a shorter string is more significant.
 * 'Hello'.score('h') //=>0.52
 * 'He'.score('h')    //=>0.6249999999999999
 *
 * // Same case matches better than wrong case
 * 'Hello'.score('h') //=>0.52
 * 'Hello'.score('H') //=>0.5800000000000001
 *
 * // Acronyms are given a little more weight
 * "Hillsdale Michigan".score("HiMi") > "Hillsdale Michigan".score("Hills")
 * "Hillsdale Michigan".score("HiMi") < "Hillsdale Michigan".score("Hillsd")
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
