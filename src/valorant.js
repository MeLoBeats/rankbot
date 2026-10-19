import { config } from './config.js';

const HENRIK_URL = 'https://api.henrikdev.xyz/valorant/v3/mmr';

// Returns the current competitive rank of a Riot account, e.g. { tier: 'Gold 2', rr: 45 }
export async function getRank({ name, tag, region }) {
	const url = `${HENRIK_URL}/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
	const response = await fetch(url, { headers: { 'Authorization': config.henrikApiKey } });

	if (!response.ok) {
		throw new Error(`HenrikDev API returned status ${response.status}: ${await response.text()}`);
	}

	const { current } = (await response.json()).data;
	return { tier: current.tier.name, rr: current.rr };
}
