import type { DixtPlugin } from "dixt";
import { clanCommand } from "./commands/clan.js";
import { playerCommand } from "./commands/player.js";

/**
 * The WoT plugin: unicum.gg's slash commands. Each command lives in its own file
 * under `commands/` and is registered here.
 */
const wotPlugin: DixtPlugin = () => ({
  name: "wot",
  commands: [playerCommand, clanCommand],
});

export default wotPlugin;
