/**
 * Gemini Live Client - Minimal Latency Voice Conversation
 *
 * Streams audio directly to Gemini Live API for real-time conversation.
 * Optionally uses Whisper for accurate Icelandic transcription display.
 *
 * Architecture:
 * - Real-time audio streaming to Gemini (minimal latency)
 * - Optional parallel Whisper transcription (for accurate text display)
 * - VAD (Voice Activity Detection) for auto-stop
 */

export interface Message {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

export interface GeminiLiveConfig {
	whisperUrl?: string;
	useWhisperTranscript?: boolean; // Use Whisper for accurate transcript display
	vadSilenceThreshold?: number; // ms of silence before auto-stop
	sampleRate?: number;
}

// News fetching functions
async function fetchNews(source: string, feed: string = 'frettir', limit: number = 5): Promise<string> {
	try {
		const response = await fetch('/api/news', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'get_news', source, feed, limit })
		});
		const data = await response.json();
		if (data.news && Array.isArray(data.news)) {
			return data.news
				.map((item: { source: string; title: string; description: string }, i: number) =>
					`${i + 1}. ${item.title} (${item.source}): ${item.description.slice(0, 150)}`
				)
				.join('\n\n');
		}
		return 'Engar fréttir fundust.';
	} catch (error) {
		console.error('Error fetching news:', error);
		return 'Villa við að sækja fréttir.';
	}
}

async function searchNews(query: string, limit: number = 10): Promise<string> {
	try {
		const response = await fetch('/api/news', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'search_news', query, limit })
		});
		const data = await response.json();
		if (data.results && Array.isArray(data.results)) {
			return data.results
				.map((item: { source: string; title: string; description: string }, i: number) =>
					`${i + 1}. ${item.title} (${item.source}): ${item.description.slice(0, 150)}`
				)
				.join('\n\n');
		}
		return 'Engar fréttir fundust.';
	} catch (error) {
		console.error('Error searching news:', error);
		return 'Villa við að leita.';
	}
}

// Tool definitions
const tools = [
	{
		name: 'get_news',
		description: 'Fetch news from Icelandic sources: ruv, mbl, visir, dv, stundin, frettabladid, kjarninn, heimildin, icelandreview, grapevine, vedur',
		parameters: {
			type: 'object',
			properties: {
				source: { type: 'string', description: 'News source' },
				feed: { type: 'string', description: 'Feed type (default: frettir)' },
				limit: { type: 'number', description: 'Number of articles' }
			},
			required: ['source']
		}
	},
	{
		name: 'search_news',
		description: 'Search all Icelandic news sources for a keyword',
		parameters: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Search query' },
				limit: { type: 'number', description: 'Max results' }
			},
			required: ['query']
		}
	}
];

export class GeminiLiveClient {
	private config: GeminiLiveConfig;
	private ws: WebSocket | null = null;
	private audioContext: AudioContext | null = null;
	private mediaStream: MediaStream | null = null;
	private audioWorklet: AudioWorkletNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;

	// Audio playback
	private audioQueue: Float32Array[] = [];
	private isPlayingAudio = false;
	private playbackContext: AudioContext | null = null;

	// VAD
	private silenceStart: number = 0;
	private isSilent = true;

	// Whisper transcription (parallel)
	private recordedChunks: Float32Array[] = [];

	// Reactive state
	messages = $state<Message[]>([]);
	isConnected = $state(false);
	isRecording = $state(false);
	isProcessing = $state(false);
	isSpeaking = $state(false);
	error = $state<string | null>(null);
	status = $state<'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking'>('disconnected');
	inputLevel = $state(0);
	transcript = $state('');

	constructor(config: GeminiLiveConfig = {}) {
		this.config = {
			whisperUrl: 'http://192.168.8.191:7000',
			useWhisperTranscript: true,
			vadSilenceThreshold: 1500, // 1.5s silence = end of speech
			sampleRate: 16000,
			...config
		};
	}

	async connect(): Promise<void> {
		try {
			this.error = null;
			this.status = 'connecting';

			// Get API key
			const keyResponse = await fetch('/api/google/api-key');
			if (!keyResponse.ok) throw new Error('Failed to get API key');
			const { apiKey } = await keyResponse.json();

			// Connect to Gemini Live
			const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
			this.ws = new WebSocket(wsUrl);

			await new Promise<void>((resolve, reject) => {
				this.ws!.onopen = () => {
					this.sendSetup();
					resolve();
				};
				this.ws!.onerror = () => reject(new Error('WebSocket connection failed'));
				setTimeout(() => reject(new Error('Connection timeout')), 10000);
			});

			this.ws.onmessage = (e) => this.handleMessage(e.data);
			this.ws.onclose = () => {
				this.isConnected = false;
				this.status = 'disconnected';
			};

			// Setup audio
			this.playbackContext = new AudioContext({ sampleRate: 24000 });

			this.isConnected = true;
			this.status = 'connected';
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Connection failed';
			this.status = 'disconnected';
			throw err;
		}
	}

	private sendSetup(): void {
		if (!this.ws) return;

		this.ws.send(JSON.stringify({
			setup: {
				model: 'models/gemini-2.0-flash-exp',
				generation_config: {
					response_modalities: ['AUDIO'],
					speech_config: {
						voice_config: {
							prebuilt_voice_config: { voice_name: 'Kore' }
						}
					}
				},
				system_instruction: {
					parts: [{
						text: `You are a helpful Icelandic news assistant.

LANGUAGE: Always respond in the language the user speaks. Icelandic → Icelandic, English → English.

TOOLS: Use get_news and search_news to fetch current Icelandic news.

Be concise and natural in conversation.`
					}]
				},
				tools: [{ function_declarations: tools }]
			}
		}));
	}

	private async handleMessage(data: string | Blob): Promise<void> {
		try {
			const text = data instanceof Blob ? await data.text() : data;
			const msg = JSON.parse(text);

			if (msg.setupComplete) {
				console.log('Gemini setup complete');
				return;
			}

			if (msg.serverContent) {
				const content = msg.serverContent;

				if (content.modelTurn?.parts) {
					for (const part of content.modelTurn.parts) {
						if (part.text) {
							this.messages.push({
								role: 'assistant',
								content: part.text,
								timestamp: new Date()
							});
						}

						if (part.inlineData?.data) {
							// Decode base64 PCM audio
							const pcm = this.base64ToPcm(part.inlineData.data);
							this.audioQueue.push(pcm);
							this.playAudio();
						}
					}
				}

				if (content.turnComplete) {
					this.isSpeaking = false;
					this.status = 'connected';
				}
			}

			if (msg.toolCall) {
				await this.handleToolCall(msg.toolCall);
			}
		} catch (error) {
			console.error('Message handling error:', error);
		}
	}

	private base64ToPcm(base64: string): Float32Array {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		// Convert to Int16 then Float32
		const int16 = new Int16Array(bytes.buffer);
		const float32 = new Float32Array(int16.length);
		for (let i = 0; i < int16.length; i++) {
			float32[i] = int16[i] / 32768;
		}
		return float32;
	}

	private async playAudio(): Promise<void> {
		if (this.isPlayingAudio || this.audioQueue.length === 0 || !this.playbackContext) return;

		this.isPlayingAudio = true;
		this.isSpeaking = true;
		this.status = 'speaking';

		while (this.audioQueue.length > 0) {
			const pcm = this.audioQueue.shift()!;
			const buffer = this.playbackContext.createBuffer(1, pcm.length, 24000);
			buffer.copyToChannel(new Float32Array(pcm), 0);

			const source = this.playbackContext.createBufferSource();
			source.buffer = buffer;
			source.connect(this.playbackContext.destination);

			await new Promise<void>(resolve => {
				source.onended = () => resolve();
				source.start();
			});
		}

		this.isPlayingAudio = false;
		if (this.audioQueue.length === 0) {
			this.isSpeaking = false;
			this.status = 'connected';
		}
	}

	private async handleToolCall(toolCall: any): Promise<void> {
		const responses: any[] = [];

		for (const call of toolCall.functionCalls || []) {
			let result: string;

			if (call.name === 'get_news') {
				result = await fetchNews(call.args.source, call.args.feed, call.args.limit);
			} else if (call.name === 'search_news') {
				result = await searchNews(call.args.query, call.args.limit);
			} else {
				result = 'Unknown tool';
			}

			responses.push({
				id: call.id,
				name: call.name,
				response: { result }
			});
		}

		if (this.ws && responses.length > 0) {
			this.ws.send(JSON.stringify({
				toolResponse: { functionResponses: responses }
			}));
		}
	}

	async startListening(): Promise<void> {
		if (this.isRecording) return;

		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: this.config.sampleRate,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

			// Load audio worklet for processing
			await this.audioContext.audioWorklet.addModule('/audio-processor.js');

			this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
			this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');

			this.audioWorklet.port.onmessage = (e) => {
				if (e.data.type === 'audio') {
					this.processAudioChunk(e.data.audio);
				} else if (e.data.type === 'level') {
					this.inputLevel = e.data.level;
					this.checkVAD(e.data.level);
				}
			};

			this.sourceNode.connect(this.audioWorklet);
			this.recordedChunks = [];
			this.isRecording = true;
			this.status = 'listening';
			this.silenceStart = 0;
			this.isSilent = true;

		} catch (error) {
			console.error('Microphone error:', error);
			this.error = 'Microphone access failed';
		}
	}

	private processAudioChunk(float32Audio: Float32Array): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		// Store for Whisper
		if (this.config.useWhisperTranscript) {
			this.recordedChunks.push(new Float32Array(float32Audio));
		}

		// Convert to base64 PCM for Gemini
		const int16 = new Int16Array(float32Audio.length);
		for (let i = 0; i < float32Audio.length; i++) {
			const s = Math.max(-1, Math.min(1, float32Audio[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}

		const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));

		// Stream to Gemini
		this.ws.send(JSON.stringify({
			realtimeInput: {
				mediaChunks: [{
					mimeType: 'audio/pcm;rate=16000',
					data: base64
				}]
			}
		}));
	}

	private checkVAD(level: number): void {
		const now = Date.now();
		const threshold = 0.01; // Silence threshold

		if (level < threshold) {
			if (!this.isSilent) {
				this.isSilent = true;
				this.silenceStart = now;
			} else if (this.silenceStart > 0 && now - this.silenceStart > this.config.vadSilenceThreshold!) {
				// Silence detected for threshold duration
				this.endTurn();
			}
		} else {
			this.isSilent = false;
			this.silenceStart = 0;
		}
	}

	private async endTurn(): Promise<void> {
		if (!this.isRecording) return;

		// Signal end of turn to Gemini
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({
				clientContent: { turnComplete: true }
			}));
		}

		// Get Whisper transcript in parallel
		if (this.config.useWhisperTranscript && this.recordedChunks.length > 0) {
			this.transcribeWithWhisper();
		}

		this.isSpeaking = true;
		this.status = 'speaking';
	}

	private async transcribeWithWhisper(): Promise<void> {
		try {
			// Combine chunks
			const totalLength = this.recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
			const combined = new Float32Array(totalLength);
			let offset = 0;
			for (const chunk of this.recordedChunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			// Convert to WAV
			const wavBlob = this.createWavBlob(combined);

			// Send to Whisper
			const formData = new FormData();
			formData.append('file', wavBlob, 'audio.wav');

			const response = await fetch(`${this.config.whisperUrl}/transcribe`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const { text } = await response.json();
				if (text && text.trim()) {
					this.transcript = text;
					this.messages.push({
						role: 'user',
						content: text,
						timestamp: new Date()
					});
				}
			}
		} catch (error) {
			console.error('Whisper transcription error:', error);
		}

		this.recordedChunks = [];
	}

	private createWavBlob(samples: Float32Array): Blob {
		const int16 = new Int16Array(samples.length);
		for (let i = 0; i < samples.length; i++) {
			const s = Math.max(-1, Math.min(1, samples[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}

		const buffer = new ArrayBuffer(44 + int16.length * 2);
		const view = new DataView(buffer);

		// WAV header
		const writeString = (o: number, s: string) => {
			for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
		};

		writeString(0, 'RIFF');
		view.setUint32(4, 36 + int16.length * 2, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, 16000, true);
		view.setUint32(28, 32000, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeString(36, 'data');
		view.setUint32(40, int16.length * 2, true);

		const pcmView = new Int16Array(buffer, 44);
		pcmView.set(int16);

		return new Blob([buffer], { type: 'audio/wav' });
	}

	stopListening(): void {
		if (!this.isRecording) return;

		this.endTurn();

		if (this.audioWorklet) {
			this.audioWorklet.disconnect();
			this.audioWorklet = null;
		}

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach(t => t.stop());
			this.mediaStream = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.isRecording = false;
	}

	// Text input
	sendText(text: string): void {
		if (!text.trim() || !this.ws) return;

		this.messages.push({
			role: 'user',
			content: text,
			timestamp: new Date()
		});

		this.ws.send(JSON.stringify({
			clientContent: {
				turns: [{ role: 'user', parts: [{ text }] }],
				turnComplete: true
			}
		}));

		this.isSpeaking = true;
		this.status = 'speaking';
	}

	async disconnect(): Promise<void> {
		this.stopListening();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		if (this.playbackContext) {
			await this.playbackContext.close();
			this.playbackContext = null;
		}

		this.isConnected = false;
		this.status = 'disconnected';
	}
}
