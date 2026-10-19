import WebSocket from 'ws';

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws';
const RECONNECT_DELAY_MS = 5_000;

// Connects to Twitch EventSub over WebSocket and keeps the connection alive.
// - onReady(sessionId): called once per new session, when subscriptions must be (re)created.
// - onNotification(type, event): called for every EventSub notification.
export function connectEventSub({ onReady, onNotification }) {
	let current; // The socket currently receiving events

	open(EVENTSUB_URL, false);

	function open(url, isReconnect) {
		const socket = new WebSocket(url);

		socket.on('error', (err) => console.error('EventSub WebSocket error:', err.message));
		socket.on('message', (raw) => handle(socket, JSON.parse(raw.toString()), isReconnect));
		socket.on('close', () => {
			// A replaced socket closing is expected; only retry if the active one dropped
			if (current === socket || current === undefined) {
				console.warn(`EventSub connection lost, retrying in ${RECONNECT_DELAY_MS / 1000}s`);
				current = undefined;
				setTimeout(() => open(EVENTSUB_URL, false), RECONNECT_DELAY_MS);
			}
		});
	}

	function handle(socket, message, isReconnect) {
		const { message_type: type, subscription_type: subscriptionType } = message.metadata;

		switch (type) {
			case 'session_welcome': {
				const previous = current;
				current = socket;
				if (previous && previous !== socket) previous.close();

				// A reconnect keeps the existing subscriptions, a fresh session does not
				if (!isReconnect) onReady(message.payload.session.id);
				break;
			}
			case 'session_reconnect': // Twitch asks us to move to another server
				open(message.payload.session.reconnect_url, true);
				break;
			case 'notification':
				onNotification(subscriptionType, message.payload.event);
				break;
		}
	}
}
