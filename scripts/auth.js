// One-time setup: authorizes the bot with the Twitch account that will chat, and stores
// the tokens in tokens.json. Run it with `npm run auth` while logged in as that account.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { config } from '../src/config.js';
import { saveTokensFromCode } from '../src/twitch/auth.js';

const PORT = 8000;
const REDIRECT_URI = `http://localhost:${PORT}/redirect`; // Must be registered in the Twitch console
const SCOPES = ['user:bot', 'user:read:chat', 'user:write:chat'];

const state = randomUUID();

const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
authorizeUrl.search = new URLSearchParams({
	response_type: 'code',
	client_id: config.twitch.clientId,
	redirect_uri: REDIRECT_URI,
	scope: SCOPES.join(' '),
	state,
});

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	if (url.pathname !== '/redirect') {
		res.writeHead(404).end();
		return;
	}

	const code = url.searchParams.get('code');
	if (url.searchParams.get('state') !== state || !code) {
		res.writeHead(400).end('Authorization failed or state mismatch.');
		console.error('Authorization failed:', url.searchParams.get('error_description') ?? 'invalid response');
		process.exit(1);
	}

	try {
		await saveTokensFromCode(code, REDIRECT_URI);
		res.end('Authorization complete, you can close this tab.');
		console.log('Tokens saved to tokens.json. You can now run `npm start`.');
		server.close();
	} catch (err) {
		res.writeHead(500).end('Token exchange failed, see the terminal.');
		console.error(err.message);
		process.exit(1);
	}
});

server.listen(PORT, () => {
	console.log('Open this URL while logged in as the Twitch account the bot will chat as:\n');
	console.log(authorizeUrl.toString() + '\n');
});
