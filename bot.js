import { config } from './src/config.js';
import { channels } from './src/channels.js';
import { commands } from './src/commands/index.js';
import { connectEventSub } from './src/twitch/eventsub.js';
import { getUser, sendChatMessage, subscribeToChatMessages, validateToken } from './src/twitch/api.js';

const ERROR_MESSAGE = "Impossible d'exécuter la commande pour le moment.";

const lastUsedAt = new Map(); // "channelId:command" -> timestamp, for cooldowns

async function main() {
	const { user_id: botUserId, login } = await validateToken();
	console.log(`Validated token for ${login} (user id ${botUserId}).`);

	const channelsById = await resolveChannels();

	// WebSocket keeps the process alive until it is stopped
	connectEventSub({
		onReady: (sessionId) => subscribeAll(channelsById, botUserId, sessionId),
		onNotification: (type, event) => {
			if (type === 'channel.chat.message') {
				handleChatMessage(event, channelsById, botUserId);
			}
		},
	});
}

async function resolveChannels() {
	const byId = new Map();

	for (const channel of channels) {
		const user = await getUser(channel);
		if (!user) {
			throw new Error(`Twitch channel not found: ${channel.login}`);
		}
		byId.set(user.id, { ...channel, id: user.id, login: user.login });
		console.log(`Channel ${user.login} (user id ${user.id})`);
	}

	return byId;
}

async function subscribeAll(channelsById, botUserId, sessionId) {
	for (const channel of channelsById.values()) {
		try {
			const { data } = await subscribeToChatMessages({ broadcasterId: channel.id, userId: botUserId, sessionId });
			console.log(`Subscribed to chat of ${channel.login} [${data[0].id}]`);
		} catch (err) {
			console.error(`Failed to subscribe to chat of ${channel.login}:`, err.message);
		}
	}
}

async function handleChatMessage(event, channelsById, botUserId) {
	const channel = channelsById.get(event.broadcaster_user_id);
	const text = event.message.text.trim();
	console.log(`MSG #${channel.login} <${event.chatter_user_login}> ${text}`);

	const command = commands.get(text.split(/\s+/)[0].toLowerCase());
	if (!command || isOnCooldown(channel, command)) return;

	let reply;
	try {
		reply = await command.run({ channel, event });
	} catch (err) {
		console.error(`Command ${command.name} failed:`, err.message);
		reply = ERROR_MESSAGE;
	}

	try {
		await sendChatMessage({ broadcasterId: channel.id, senderId: botUserId, message: reply });
		console.log(`Sent to #${channel.login}: ${reply}`);
	} catch (err) {
		console.error(`Failed to send message to #${channel.login}:`, err.message);
	}
}

function isOnCooldown(channel, command) {
	const key = `${channel.id}:${command.name}`;
	const now = Date.now();

	if (now - (lastUsedAt.get(key) ?? 0) < config.commandCooldownMs) return true;

	lastUsedAt.set(key, now);
	return false;
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
