import { rank } from './rank.js';

// To add a command: create a module exporting { name, run({ channel, event }) } and list it here.
const all = [rank];

export const commands = new Map(all.map((command) => [command.name, command]));
