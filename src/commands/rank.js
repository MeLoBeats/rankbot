import { getRank } from '../valorant.js';

export const rank = {
	name: '!rank',

	// Returns the message to send in chat
	async run({ channel }) {
		const { tier, rr } = await getRank(channel.valorant);
		return `Rang actuel : ${tier} (${rr} RR)`;
	},
};
