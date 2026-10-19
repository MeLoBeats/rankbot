function required(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing environment variable ${name} (see .env.example)`);
	}
	return value;
}

export const config = {
	twitch: {
		clientId: required('TWITCH_CLIENT_ID'),
		clientSecret: required('TWITCH_CLIENT_SECRET'),
	},
	henrikApiKey: required('HENRIK_API_KEY'),
	commandCooldownMs: 10_000,
};
