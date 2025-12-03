<script lang="ts">
	import { GeminiLiveClient } from '$lib/gemini-live-client.svelte';

	let client = $state<GeminiLiveClient | null>(null);
	let textInput = $state('');

	async function connect() {
		client = new GeminiLiveClient();
		await client.connect();
	}

	function disconnect() {
		if (client) {
			client.disconnect();
			client = null;
		}
	}

	function toggleListening() {
		if (!client) return;
		if (client.isRecording) {
			client.stopListening();
		} else {
			client.startListening();
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
		<p>Real-time voice conversation powered by Google Gemini + Whisper STT</p>
		<p class="mcp-info">
			Using <a href="https://github.com/olibuijr/iceland-news-mcp" target="_blank"
				>Iceland News MCP Server</a
			> for news data
		</p>
	</header>

	<section class="controls">
		{#if !client?.isConnected}
			<button class="connect-btn" onclick={connect} disabled={client?.status === 'connecting'}>
				{#if client?.status === 'connecting'}
					Connecting...
				{:else}
					Connect to Assistant
				{/if}
			</button>
		{:else}
			<button class="disconnect-btn" onclick={disconnect}>Disconnect</button>
		{/if}
	</section>

	{#if client?.isConnected}
		<section class="conversation">
			<div class="messages">
				{#each client.messages as message, i (i)}
					<div class="message {message.role}">
						<span class="role">
							{message.role === 'user' ? 'You' : 'Assistant'}
						</span>
						<p>{message.content}</p>
						<time>{message.timestamp.toLocaleTimeString()}</time>
					</div>
				{/each}

				{#if client.isSpeaking}
					<div class="message assistant speaking">
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
						class="voice-orb {client.status}"
						onclick={toggleListening}
						disabled={client.isSpeaking}
					>
						{#if client.isRecording}
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
								/>
								<path
									d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
								/>
							</svg>
						{:else if client.isSpeaking}
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
								/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
								/>
								<path
									d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
								/>
							</svg>
						{/if}
					</button>

					{#if client.isRecording}
						<span class="status listening">Listening... (auto-stops on silence)</span>
					{:else if client.isSpeaking}
						<span class="status speaking">Speaking...</span>
					{:else}
						<span class="status">Click mic or type below</span>
					{/if}
				</div>

				{#if client.isRecording}
					<div class="input-level">
						<div class="level-bar" style="width: {Math.min(100, client.inputLevel * 500)}%"></div>
					</div>
				{/if}

				<div class="text-input">
					<input
						type="text"
						bind:value={textInput}
						onkeydown={handleKeydown}
						placeholder="Type a message..."
						disabled={client.isSpeaking}
					/>
					<button onclick={sendMessage} disabled={!textInput.trim() || client.isSpeaking}>Send</button>
				</div>
			</div>
		</section>
	{/if}

	{#if client?.error}
		<div class="error">
			{client.error}
		</div>
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

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		align-items: center;
		margin-bottom: 2rem;
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

	.message.assistant {
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

	.speaking-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}
	.speaking-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
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

	.voice-orb {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s;
		padding: 0;
	}

	.voice-orb svg {
		width: 32px;
		height: 32px;
	}

	.voice-orb:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.05);
	}

	.voice-orb.listening {
		background: linear-gradient(135deg, #00d4ff, #0088ff);
		animation: pulse-blue 1.5s infinite;
	}

	.voice-orb.speaking {
		background: linear-gradient(135deg, #00ff88, #00cc66);
		animation: pulse-green 1.5s infinite;
	}

	@keyframes pulse-blue {
		0% {
			box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.7);
		}
		70% {
			box-shadow: 0 0 0 20px rgba(0, 212, 255, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(0, 212, 255, 0);
		}
	}

	@keyframes pulse-green {
		0% {
			box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.7);
		}
		70% {
			box-shadow: 0 0 0 20px rgba(0, 255, 136, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(0, 255, 136, 0);
		}
	}

	.status {
		color: #888;
		font-size: 0.9rem;
	}

	.status.listening {
		color: #00d4ff;
	}

	.status.speaking {
		color: #00ff88;
	}

	.input-level {
		height: 4px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.level-bar {
		height: 100%;
		background: linear-gradient(90deg, #00d4ff, #00ff88);
		transition: width 0.05s;
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

	.text-input input:disabled {
		opacity: 0.5;
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
