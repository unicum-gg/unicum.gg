/**
 * The catalogue key for one of the client's names for a vehicle's state.
 *
 * Derived from the word rather than from the mechanic, so a word the game uses
 * once is translated once: three mechanics leave a state called Travel and two
 * fire a Salvo, and keyed per mechanic those would be asked for twice and could
 * come back as two different words for one thing.
 *
 * **A file of its own, with nothing imported into it.** The key a reader is
 * looked up under and the key the catalogue is written under have to be one
 * derivation rather than two copies of a rule, so both `components/game-name`
 * and `scripts/generate-game-vocabulary` read it from here. The script cannot
 * reach it through the component, which imports the `@unicum.gg/shared` barrel:
 * that validates the environment as it is imported, and an import is evaluated
 * before the script's own `config()` has loaded the file that would satisfy it.
 */
export function vehicleModeKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
