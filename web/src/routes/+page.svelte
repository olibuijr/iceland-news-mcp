<script lang="ts">
	import { GeminiLiveClient, AVAILABLE_VOICES, type VoiceId } from '$lib/gemini-live.svelte';
	import { onMount } from 'svelte';

	let { data } = $props();

	let apiKey = $state(data.apiKey || '');
	let client = $state<GeminiLiveClient | null>(null);
	let textInput = $state('');
	let showApiKeyInput = $state(!data.apiKey);
	let selectedVoice = $state<VoiceId>('Kore');

	// Check for API key in localStorage and auto-connect
	onMount(async () => {
		if (!apiKey) {
			const savedKey = localStorage.getItem('gemini_api_key');
			if (savedKey) {
				apiKey = savedKey;
				showApiKeyInput = false;
			}
		}

		// Auto-connect and start with headlines if we have an API key
		if (apiKey && !showApiKeyInput) {
			await autoStartWithHeadlines();
		}
	});

	async function autoStartWithHeadlines() {
		try {
			await connect();
			// Wait for connection to establish
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Send initial request for headlines
			if (client?.isConnected) {
				client.sendText('Góðan daginn! Lestu upp 10 nýjustu fréttirnar frá öllum miðlum.');
			}
		} catch (err) {
			console.error('Auto-start failed:', err);
		}
	}

	function saveApiKey() {
		if (apiKey.trim()) {
			localStorage.setItem('gemini_api_key', apiKey);
			showApiKeyInput = false;
		}
	}

	function clearApiKey() {
		localStorage.removeItem('gemini_api_key');
		apiKey = '';
		showApiKeyInput = true;
		if (client) {
			client.disconnect();
			client = null;
		}
	}

	async function connect() {
		if (!apiKey) return;

		client = new GeminiLiveClient({
			apiKey,
			voice: selectedVoice,
			systemInstruction: `Þú ert fréttamaður á íslensku. Þú lest upp fréttir eins og faglegur fréttamaður á sjónvarpi eða útvarpi.

MIKILVÆGAR REGLUR:
1. Talaðu ALLTAF á íslensku nema notandinn tali ensku við þig.
2. Ekki spyrja spurninga - lestu bara upp fréttirnar faglega.
3. Ekki bulla eða búa til fréttir. Notaðu ALLTAF tólin til að sækja raunverulegar fréttir.
4. Notaðu get_all_news tólið til að sækja fréttir. Settu limit á 10 til að fá 10 fréttir.
5. Þegar notandinn biður um fréttir eftir flokkum (íþróttir, innlent, erlent, viðskipti, menning):
   - Notaðu get_news_by_category tólið
6. Þegar notandinn biður um fréttir frá ákveðnum miðli (RÚV, Morgunblaðið, Vísir):
   - Notaðu get_news_by_source tólið
7. Lestu fréttirnar upp á faglegan hátt, byrjaðu á heimildinni.
8. Haltu hverri frétt stuttri - bara fyrirsögn og eina setningu lýsingu.

HEIMILDIR: ruv, mbl, visir, heimildin
FLOKKAR: ithrottir, innlent, erlent, vidskipti, menning`
		});

		await client.connect();
	}

	function disconnect() {
		if (client) {
			client.disconnect();
			client = null;
		}
	}

	async function toggleListening() {
		if (!client) return;

		if (client.isListening) {
			client.stopListening();
		} else {
			await client.startListening();
		}
	}

	function sendMessage() {
		if (!client || !textInput.trim()) return;
		client.sendText(textInput);
		textInput = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}
</script>

<svelte:head>
	<title>Iceland News Voice Assistant</title>
</svelte:head>

<main>
	<header>
		<h1>Iceland News Voice Assistant</h1>
		<p>Real-time voice conversation powered by Gemini Live API</p>
		<p class="mcp-info">
			Using <a href="https://github.com/olibuijr/iceland-news-mcp" target="_blank">Iceland News MCP Server</a> for news data
		</p>
	</header>

	{#if showApiKeyInput}
		<section class="api-key-section">
			<h2>Enter your Google API Key</h2>
			<p>Your API key is stored locally and never sent to our servers.</p>
			<div class="api-key-input">
				<input
					type="password"
					bind:value={apiKey}
					placeholder="Enter your Gemini API key"
				/>
				<button onclick={saveApiKey} disabled={!apiKey.trim()}>
					Save Key
				</button>
			</div>
			<p class="hint">
				Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a>
			</p>
		</section>
	{:else}
		<section class="controls">
			{#if !client?.isConnected}
				<div class="voice-selector">
					<label for="voice-select">Voice:</label>
					<select id="voice-select" bind:value={selectedVoice}>
						{#each AVAILABLE_VOICES as voice (voice.id)}
							<option value={voice.id}>{voice.name} - {voice.description}</option>
						{/each}
					</select>
				</div>
				<button class="connect-btn" onclick={connect}>
					Connect to Assistant
				</button>
			{:else}
				<button class="disconnect-btn" onclick={disconnect}>
					Disconnect
				</button>
			{/if}

			<button class="settings-btn" onclick={clearApiKey}>
				Change API Key
			</button>
		</section>

		{#if client?.isConnected}
			<section class="conversation">
				<div class="messages">
					{#each client.messages as message, i (i)}
						<div class="message {message.role} {message.isTranscription ? 'transcription' : ''}">
							<span class="role">
								{message.role === 'user' ? 'You' : 'Assistant'}
								{#if message.isTranscription}
									<span class="transcription-badge">transcribed</span>
								{/if}
							</span>
							<p>{message.content}</p>
							<time>{message.timestamp.toLocaleTimeString()}</time>
						</div>
					{/each}

					{#if client.isSpeaking}
						<div class="message model speaking">
							<span class="role">Assistant</span>
							<p class="speaking-indicator">
								<span></span><span></span><span></span>
							</p>
						</div>
					{/if}
				</div>

				<div class="input-area">
					<div class="voice-controls">
						<button
							class="mic-btn {client.isListening ? 'listening' : ''}"
							onclick={toggleListening}
							title={client.isListening ? 'Stop listening' : 'Start listening'}
						>
							{#if client.isListening}
								<svg viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="6" width="12" height="12" rx="2"/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
									<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
								</svg>
							{/if}
						</button>

						{#if client.isListening}
							<span class="status listening">Listening...</span>
						{:else if client.isSpeaking}
							<span class="status speaking">Speaking...</span>
						{:else}
							<span class="status">Click mic or type below</span>
						{/if}
					</div>

					<div class="text-input">
						<input
							type="text"
							bind:value={textInput}
							onkeydown={handleKeydown}
							placeholder="Type a message..."
						/>
						<button onclick={sendMessage} disabled={!textInput.trim()}>
							Send
						</button>
					</div>
				</div>
			</section>
		{/if}

		{#if client?.error}
			<div class="error">
				{client.error}
			</div>
		{/if}
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		min-height: 100vh;
		color: #fff;
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	header h1 {
		font-size: 2rem;
		margin: 0;
		background: linear-gradient(90deg, #00d4ff, #00ff88);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	header p {
		color: #888;
		margin-top: 0.5rem;
	}

	header .mcp-info {
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	header .mcp-info a {
		color: #00d4ff;
		text-decoration: none;
	}

	header .mcp-info a:hover {
		text-decoration: underline;
	}

	.api-key-section {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.api-key-section h2 {
		margin-top: 0;
	}

	.api-key-input {
		display: flex;
		gap: 0.5rem;
		max-width: 500px;
		margin: 1rem auto;
	}

	.api-key-input input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		color: #fff;
		font-size: 1rem;
	}

	.hint {
		color: #666;
		font-size: 0.9rem;
	}

	.hint a {
		color: #00d4ff;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		align-items: center;
		margin-bottom: 2rem;
	}

	.voice-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.voice-selector label {
		color: #888;
		font-size: 0.9rem;
	}

	.voice-selector select {
		padding: 0.5rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		color: #fff;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.voice-selector select:focus {
		outline: none;
		border-color: #00d4ff;
	}

	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.connect-btn {
		background: linear-gradient(90deg, #00d4ff, #00ff88);
		color: #000;
		font-weight: 600;
	}

	.connect-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.disconnect-btn {
		background: #ff4444;
		color: #fff;
	}

	.settings-btn {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.conversation {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 1rem;
		overflow: hidden;
	}

	.messages {
		max-height: 400px;
		overflow-y: auto;
		padding: 1rem;
	}

	.message {
		margin-bottom: 1rem;
		padding: 1rem;
		border-radius: 0.75rem;
		max-width: 80%;
	}

	.message.user {
		background: rgba(0, 212, 255, 0.2);
		margin-left: auto;
	}

	.message.model {
		background: rgba(0, 255, 136, 0.2);
	}

	.message .role {
		font-size: 0.8rem;
		font-weight: 600;
		color: #888;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.transcription-badge {
		font-size: 0.65rem;
		font-weight: 400;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
		color: #aaa;
	}

	.message.transcription {
		opacity: 0.85;
	}

	.message p {
		margin: 0.5rem 0;
	}

	.message time {
		font-size: 0.75rem;
		color: #666;
	}

	.speaking-indicator {
		display: flex;
		gap: 4px;
		padding: 0.5rem 0;
	}

	.speaking-indicator span {
		width: 8px;
		height: 8px;
		background: #00ff88;
		border-radius: 50%;
		animation: bounce 1.4s infinite ease-in-out;
	}

	.speaking-indicator span:nth-child(1) { animation-delay: -0.32s; }
	.speaking-indicator span:nth-child(2) { animation-delay: -0.16s; }

	@keyframes bounce {
		0%, 80%, 100% { transform: scale(0); }
		40% { transform: scale(1); }
	}

	.input-area {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: 1rem;
	}

	.voice-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.mic-btn {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.mic-btn svg {
		width: 28px;
		height: 28px;
	}

	.mic-btn.listening {
		background: #ff4444;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
		70% { box-shadow: 0 0 0 20px rgba(255, 68, 68, 0); }
		100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
	}

	.status {
		color: #888;
		font-size: 0.9rem;
	}

	.status.listening {
		color: #ff4444;
	}

	.status.speaking {
		color: #00ff88;
	}

	.text-input {
		display: flex;
		gap: 0.5rem;
	}

	.text-input input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		color: #fff;
		font-size: 1rem;
	}

	.text-input input::placeholder {
		color: #666;
	}

	.text-input button {
		background: linear-gradient(90deg, #00d4ff, #00ff88);
		color: #000;
		font-weight: 600;
	}

	.error {
		background: rgba(255, 68, 68, 0.2);
		border: 1px solid #ff4444;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-top: 1rem;
		text-align: center;
	}
</style>
