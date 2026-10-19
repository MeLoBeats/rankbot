import { readFile, writeFile } from 'node:fs/promises';
import { config } from '../config.js';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TOKENS_PATH = process.env.TOKENS_PATH ?? new URL('../../tokens.json', import.meta.url);
const REFRESH_MARGIN_MS = 5 * 60_000; // Refresh this long before the token expires

let tokens; // { accessToken, refreshToken, expiresAt }
let refreshing; // In-flight refresh, shared by concurrent callers
let refreshTimer;

async function requestTokens(params) {
	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			client_id: config.twitch.clientId,
			client_secret: config.twitch.clientSecret,
			...params,
		}),
	});
	const data = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(`Twitch token endpoint returned status ${response.status}: ${JSON.stringify(data)}`);
	}

	tokens = {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
	await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
	scheduleRefresh();
}

// One-time setup: exchanges the authorization code for tokens (see scripts/auth.js)
export function saveTokensFromCode(code, redirectUri) {
	return requestTokens({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

export function refreshTokens() {
	refreshing ??= requestTokens({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken })
		.finally(() => { refreshing = undefined; });
	return refreshing;
}

async function loadTokens() {
	try {
		tokens = JSON.parse(await readFile(TOKENS_PATH, 'utf8'));
	} catch {
		throw new Error('No tokens found. Run `npm run auth` first.');
	}
	scheduleRefresh();
}

// Keeps the token fresh even when the bot is idle
function scheduleRefresh() {
	clearTimeout(refreshTimer);
	const delay = Math.max(tokens.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);

	refreshTimer = setTimeout(() => {
		refreshTokens().catch((err) => {
			console.error('Token refresh failed, retrying in 1 minute:', err.message);
			refreshTimer = setTimeout(scheduleRefresh, 60_000);
		});
	}, delay);
	refreshTimer.unref();
}

export async function getAccessToken() {
	if (!tokens) await loadTokens();
	if (Date.now() > tokens.expiresAt - REFRESH_MARGIN_MS) await refreshTokens();
	return tokens.accessToken;
}
