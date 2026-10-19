import { config } from '../config.js';
import { getAccessToken, refreshTokens } from './auth.js';

const HELIX_URL = 'https://api.twitch.tv/helix';
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';

export class TwitchApiError extends Error {
	constructor(status, body) {
		super(`Twitch API returned status ${status}: ${JSON.stringify(body)}`);
		this.status = status;
		this.body = body;
	}
}

async function helix(path, { method = 'GET', body } = {}, isRetry = false) {
	const response = await fetch(HELIX_URL + path, {
		method,
		headers: {
			'Authorization': 'Bearer ' + await getAccessToken(),
			'Client-Id': config.twitch.clientId,
			...(body && { 'Content-Type': 'application/json' }),
		},
		body: body && JSON.stringify(body),
	});

	// Token rejected (e.g. revoked or expired early): refresh once and retry
	if (response.status === 401 && !isRetry) {
		await refreshTokens();
		return helix(path, { method, body }, true);
	}

	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new TwitchApiError(response.status, data);
	}
	return data;
}

// https://dev.twitch.tv/docs/authentication/validate-tokens/
// Returns { user_id, login, ... } of the account that owns the token.
export async function validateToken() {
	const response = await fetch(VALIDATE_URL, {
		headers: { 'Authorization': 'OAuth ' + await getAccessToken() },
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new TwitchApiError(response.status, data);
	}
	if (!data.user_id) {
		throw new Error('Token has no user: a user access token is required, not an app access token.');
	}
	return data;
}

// `by` is { login } or { id }. Returns the Twitch user or undefined.
export async function getUser(by) {
	const query = by.id ? 'id=' + by.id : 'login=' + encodeURIComponent(by.login);
	const { data } = await helix('/users?' + query);
	return data[0];
}

export function sendChatMessage({ broadcasterId, senderId, message }) {
	return helix('/chat/messages', {
		method: 'POST',
		body: { broadcaster_id: broadcasterId, sender_id: senderId, message },
	});
}

export function subscribeToChatMessages({ broadcasterId, userId, sessionId }) {
	return helix('/eventsub/subscriptions', {
		method: 'POST',
		body: {
			type: 'channel.chat.message',
			version: '1',
			condition: { broadcaster_user_id: broadcasterId, user_id: userId },
			transport: { method: 'websocket', session_id: sessionId },
		},
	});
}
