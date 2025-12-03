// Gemini Live API WebSocket client for real-time voice conversation
// Following the official documentation: https://ai.google.dev/gemini-api/docs/live

const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// Available voices from Google's TTS - these work with Gemini Live native audio
export const AVAILABLE_VOICES = [
	{ id: 'Puck', name: 'Puck', description: 'Warm and friendly' },
	{ id: 'Charon', name: 'Charon', description: 'Deep and authoritative' },
	{ id: 'Kore', name: 'Kore', description: 'Bright and clear' },
	{ id: 'Fenrir', name: 'Fenrir', description: 'Strong and confident' },
	{ id: 'Aoede', name: 'Aoede', description: 'Soft and melodic' },
] as const;

export type VoiceId = typeof AVAILABLE_VOICES[number]['id'];

export interface Message {
	role: 'user' | 'model';
	content: string;
	timestamp: Date;
	isTranscription?: boolean;
}

export interface GeminiLiveConfig {
	apiKey: string;
	model?: string;
	systemInstruction?: string;
	voice?: VoiceId;
	enableInputTranscription?: boolean;
	enableOutputTranscription?: boolean;
	whisperServiceUrl?: string; // URL for Icelandic Whisper STT service
	newsApiUrl?: string; // URL for news API
}

// Tool definitions for Gemini function calling
const NEWS_TOOLS = {
	functionDeclarations: [
		{
			name: 'get_all_news',
			description: 'Sækir nýjustu fréttir frá öllum helstu fréttamiðlum á Íslandi (RÚV, Morgunblaðið, Heimildin). Notaðu þetta þegar notandinn biður um almenna fréttayfirlit.',
			parameters: {
				type: 'object',
				properties: {
					limit: {
						type: 'number',
						description: 'Hámarksfjöldi frétta sem á að sækja (sjálfgefið 5)'
					}
				}
			}
		},
		{
			name: 'get_news_by_source',
			description: 'Sækir fréttir frá tilteknum fréttamiðli. Notaðu þetta þegar notandinn biður um fréttir frá ákveðnum miðli.',
			parameters: {
				type: 'object',
				properties: {
					source: {
						type: 'string',
						description: 'Heimildin: ruv, mbl, visir, heimildin',
						enum: ['ruv', 'mbl', 'visir', 'heimildin']
					},
					feed: {
						type: 'string',
						description: 'Flokkur frétta: frettir (allar), innlent, erlent, ithrottir/sport, vidskipti, menning'
					},
					limit: {
						type: 'number',
						description: 'Hámarksfjöldi frétta'
					}
				},
				required: ['source']
			}
		},
		{
			name: 'get_news_by_category',
			description: 'Sækir fréttir eftir flokkum frá öllum miðlum. Notaðu þetta fyrir: íþróttafréttir, innlendar fréttir, erlendar fréttir, viðskiptafréttir, menningarfréttir.',
			parameters: {
				type: 'object',
				properties: {
					category: {
						type: 'string',
						description: 'Flokkur frétta: ithrottir/sport, innlent, erlent, vidskipti, menning',
						enum: ['ithrottir', 'sport', 'innlent', 'erlent', 'vidskipti', 'menning']
					},
					limit: {
						type: 'number',
						description: 'Hámarksfjöldi frétta'
					}
				},
				required: ['category']
			}
		}
	]
};

export class GeminiLiveClient {
	private ws: WebSocket | null = null;
	private inputAudioContext: AudioContext | null = null;
	private outputAudioContext: AudioContext | null = null;
	private mediaStream: MediaStream | null = null;
	private audioWorklet: AudioWorkletNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;

	// Reactive state using Svelte 5 runes
	messages = $state<Message[]>([]);
	isConnected = $state(false);
	isListening = $state(false);
	isSpeaking = $state(false);
	error = $state<string | null>(null);

	private config: GeminiLiveConfig;
	private audioQueue: Int16Array[] = [];
	private isPlaying = false;
	private currentAudioSource: AudioBufferSourceNode | null = null;

	// Track current transcription messages to accumulate text
	private currentOutputTranscription: Message | null = null;
	private currentInputTranscription: Message | null = null;

	// Audio buffer for Whisper transcription
	private audioBuffer: Int16Array[] = [];
	private isTranscribing = false;

	constructor(config: GeminiLiveConfig) {
		this.config = {
			// Use the latest native audio model from docs
			model: 'gemini-2.5-flash-native-audio-preview-09-2025',
			voice: 'Puck',
			enableInputTranscription: true,
			enableOutputTranscription: true,
			whisperServiceUrl: '/api/transcribe', // Proxied through SvelteKit server
			newsApiUrl: '/api/news', // News API endpoint
			...config
		};
	}

	async connect(): Promise<void> {
		try {
			this.error = null;

			const url = `${GEMINI_LIVE_URL}?key=${this.config.apiKey}`;
			this.ws = new WebSocket(url);

			this.ws.onopen = () => {
				this.isConnected = true;
				this.sendSetup();
			};

			this.ws.onmessage = async (event) => {
				await this.handleMessage(event);
			};

			this.ws.onerror = (event) => {
				console.error('WebSocket error:', event);
				this.error = 'Connection error';
			};

			this.ws.onclose = (event) => {
				console.log('WebSocket closed:', event.code, event.reason);
				this.isConnected = false;
				this.isListening = false;
				this.cleanup();
			};
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to connect';
			throw err;
		}
	}

	private sendSetup(): void {
		if (!this.ws) return;

		// Setup message following the official docs structure
		const setupMessage: Record<string, unknown> = {
			setup: {
				model: `models/${this.config.model}`,
				generationConfig: {
					responseModalities: ['AUDIO'],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: {
								voiceName: this.config.voice
							}
						}
					}
				},
				systemInstruction: {
					parts: [{
						text: this.config.systemInstruction ||
							'You are a helpful assistant that provides information about Icelandic news. ' +
							'Respond in a conversational manner. Keep responses concise but informative. ' +
							'You can speak in both Icelandic and English depending on the user\'s language.'
					}]
				},
				// Configure automatic VAD (Voice Activity Detection) - server-side
				// Using defaults - the server handles interruption detection automatically
				realtimeInputConfig: {
					automaticActivityDetection: {
						disabled: false
					}
				},
				// Add tools for news fetching
				tools: [NEWS_TOOLS]
			}
		};

		// Add output transcription config if enabled
		// Note: Input transcription is now handled by Whisper service for Icelandic support
		if (this.config.enableOutputTranscription) {
			(setupMessage.setup as Record<string, unknown>).outputAudioTranscription = {};
		}

		console.log('Sending setup with tools:', JSON.stringify(setupMessage, null, 2));
		this.ws.send(JSON.stringify(setupMessage));
	}

	private async handleMessage(event: MessageEvent): Promise<void> {
		try {
			let data;

			if (event.data instanceof Blob) {
				const text = await event.data.text();
				data = JSON.parse(text);
			} else {
				data = JSON.parse(event.data);
			}

			console.debug('Received message:', Object.keys(data));

			if (data.serverContent) {
				const content = data.serverContent;

				// Handle server-side VAD interruption
				// When the server detects user speaking, it cancels ongoing generation
				if (content.interrupted) {
					console.log('Server detected interruption - stopping playback');
					this.interrupt();
					// Reset transcription tracking on interruption
					this.currentOutputTranscription = null;
					this.currentInputTranscription = null;
				}

				// Handle model audio/text response
				if (content.modelTurn?.parts) {
					for (const part of content.modelTurn.parts) {
						if (part.inlineData?.mimeType?.startsWith('audio/')) {
							// Decode and play audio
							const audioData = this.base64ToInt16Array(part.inlineData.data);
							this.queueAudio(audioData);
						}

						if (part.text) {
							this.messages.push({
								role: 'model',
								content: part.text,
								timestamp: new Date()
							});
						}
					}
				}

				// Handle output transcription (what the model said)
				// Accumulate into single message instead of creating many
				if (content.outputTranscription?.text) {
					const text = content.outputTranscription.text;
					if (this.currentOutputTranscription) {
						// Append to existing transcription
						this.currentOutputTranscription.content += ' ' + text;
						// Trigger reactivity by reassigning array
						this.messages = [...this.messages];
					} else {
						// Create new transcription message
						const msg: Message = {
							role: 'model',
							content: text,
							timestamp: new Date(),
							isTranscription: true
						};
						this.currentOutputTranscription = msg;
						this.messages.push(msg);
					}
				}

				// Note: Input transcription is now handled by Whisper service for Icelandic support
				// Gemini's input transcription is disabled

				if (content.turnComplete) {
					this.isSpeaking = false;
					// Reset output transcription tracking for next turn
					this.currentOutputTranscription = null;
				}
			}

			if (data.setupComplete) {
				console.log('Gemini Live setup complete');
			}

			// Handle tool calls for news fetching
			if (data.toolCall) {
				console.log('Tool call received:', data.toolCall);
				await this.handleToolCall(data.toolCall);
			}

		} catch (err) {
			console.error('Error handling message:', err);
		}
	}

	private base64ToInt16Array(base64: string): Int16Array {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return new Int16Array(bytes.buffer);
	}

	private async handleToolCall(toolCall: { functionCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> }): Promise<void> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const responses: Array<{ id: string; response: { output: unknown } }> = [];

		for (const call of toolCall.functionCalls) {
			console.log(`Executing tool: ${call.name}`, call.args);

			try {
				let result: unknown;

				switch (call.name) {
					case 'get_all_news': {
						const response = await fetch(this.config.newsApiUrl!, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'get_all_news',
								limit: call.args.limit || 5
							})
						});
						result = await response.json();
						break;
					}

					case 'get_news_by_source': {
						const response = await fetch(this.config.newsApiUrl!, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'get_news',
								source: call.args.source,
								feed: call.args.feed || 'frettir',
								limit: call.args.limit || 5
							})
						});
						result = await response.json();
						break;
					}

					case 'get_news_by_category': {
						const response = await fetch(this.config.newsApiUrl!, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'get_news_by_category',
								category: call.args.category,
								limit: call.args.limit || 5
							})
						});
						result = await response.json();
						break;
					}

					default:
						result = { error: `Unknown tool: ${call.name}` };
				}

				console.log(`Tool ${call.name} result:`, result);

				// Format news for speech
				if (result && typeof result === 'object' && 'news' in result) {
					const news = (result as { news: Array<{ title: string; source: string; description: string }> }).news;
					const formattedNews = news.map((item, i) =>
						`Frétt ${i + 1} frá ${item.source}: ${item.title}. ${item.description.slice(0, 200)}`
					).join('\n\n');
					result = { news: formattedNews, count: news.length };
				}

				responses.push({
					id: call.id,
					response: { output: result }
				});
			} catch (error) {
				console.error(`Error executing tool ${call.name}:`, error);
				responses.push({
					id: call.id,
					response: { output: { error: error instanceof Error ? error.message : 'Unknown error' } }
				});
			}
		}

		// Send tool responses back to Gemini
		const toolResponse = {
			toolResponse: {
				functionResponses: responses
			}
		};

		console.log('Sending tool response:', toolResponse);
		this.ws.send(JSON.stringify(toolResponse));
	}

	// Track scheduled audio end time for seamless playback
	private nextPlayTime = 0;
	private scheduledSources: AudioBufferSourceNode[] = [];

	private queueAudio(audioData: Int16Array): void {
		this.scheduleAudioChunk(audioData);
	}

	private scheduleAudioChunk(audioData: Int16Array): void {
		// Output audio is always 24kHz per the docs
		if (!this.outputAudioContext) {
			this.outputAudioContext = new AudioContext({ sampleRate: 24000 });
		}

		// Resume context if suspended (browser autoplay policy)
		if (this.outputAudioContext.state === 'suspended') {
			this.outputAudioContext.resume();
		}

		// Clear audio buffer when AI starts speaking to prevent feedback loop
		// This discards any audio captured that might be the AI's own voice
		if (!this.isPlaying) {
			this.audioBuffer = [];
		}

		this.isPlaying = true;
		this.isSpeaking = true;

		// Convert Int16 to Float32 for Web Audio API
		const float32Data = new Float32Array(audioData.length);
		for (let i = 0; i < audioData.length; i++) {
			float32Data[i] = audioData[i] / 32768;
		}

		const audioBuffer = this.outputAudioContext.createBuffer(1, float32Data.length, 24000);
		audioBuffer.copyToChannel(float32Data, 0);

		const source = this.outputAudioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.outputAudioContext.destination);

		// Schedule this chunk right after the previous one ends
		const currentTime = this.outputAudioContext.currentTime;
		const startTime = Math.max(currentTime, this.nextPlayTime);

		// Update next play time to be when this chunk ends
		this.nextPlayTime = startTime + audioBuffer.duration;

		source.onended = () => {
			// Remove from tracked sources
			const idx = this.scheduledSources.indexOf(source);
			if (idx > -1) this.scheduledSources.splice(idx, 1);

			// If no more scheduled audio, mark as not playing
			if (this.scheduledSources.length === 0) {
				this.isPlaying = false;
				// Small delay before marking as not speaking to handle gaps
				setTimeout(() => {
					if (this.scheduledSources.length === 0) {
						this.isSpeaking = false;
					}
				}, 200);
			}
		};

		this.scheduledSources.push(source);
		this.currentAudioSource = source;
		source.start(startTime);
	}

	// Interrupt current playback - called when server sends interrupted or user speaks
	interrupt(): void {
		// Stop all scheduled audio sources
		for (const source of this.scheduledSources) {
			try {
				source.stop();
			} catch {
				// Already stopped
			}
		}
		this.scheduledSources = [];
		this.currentAudioSource = null;

		// Reset playback timing
		this.nextPlayTime = 0;

		// Clear the audio queue
		this.audioQueue = [];
		this.isPlaying = false;
		this.isSpeaking = false;
	}

	async startListening(): Promise<void> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('Not connected');
		}

		try {
			// Get audio at device's native sample rate
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			// Use device's native sample rate
			this.inputAudioContext = new AudioContext();
			const nativeSampleRate = this.inputAudioContext.sampleRate;
			console.log('Native sample rate:', nativeSampleRate);

			// Calculate resampling ratio (native rate -> 16kHz)
			const resampleRatio = nativeSampleRate / 16000;
			console.log('Resample ratio:', resampleRatio);

			// Audio worklet that resamples to 16kHz with VAD (Voice Activity Detection)
			await this.inputAudioContext.audioWorklet.addModule(
				URL.createObjectURL(new Blob([`
					class AudioProcessor extends AudioWorkletProcessor {
						constructor(options) {
							super();
							this.resampleRatio = options.processorOptions.resampleRatio;
							this.sampleRate = options.processorOptions.sampleRate;

							// Output buffer: 512 samples at 16kHz = 32ms
							this.outputBufferSize = 512;
							this.outputBuffer = [];

							// For averaging-based downsampling
							this.sampleSum = 0;
							this.sampleCount = 0;
							this.samplesNeeded = Math.floor(this.resampleRatio);

							// VAD (Voice Activity Detection)
							// process() is called with 128 samples, so at 48kHz that's ~2.67ms per call
							// We need to accumulate samples to measure over longer periods
							this.speechThreshold = 0.01; // RMS threshold for speech detection (lowered for sensitivity)
							this.isSpeaking = false;

							// Track time in samples
							this.samplesPerMs = this.sampleRate / 1000;
							this.silenceSamples = 0;
							this.speechSamples = 0;

							// Time thresholds in milliseconds
							this.silenceTimeMs = 800; // 800ms of silence to trigger end
							this.speechTimeMs = 50;   // 50ms of speech to trigger start (faster response)

							// Smoothed RMS for more stable detection
							this.smoothedRms = 0;
							this.smoothingFactor = 0.2; // Less smoothing for faster response

							// Debug logging
							this.debugCounter = 0;
						}

						process(inputs) {
							const input = inputs[0];
							if (!input || !input[0] || input[0].length === 0) {
								return true;
							}

							const channelData = input[0];
							const frameLength = channelData.length;

							// Calculate RMS (Root Mean Square) for VAD
							let sumSquares = 0;
							for (let i = 0; i < frameLength; i++) {
								sumSquares += channelData[i] * channelData[i];
							}
							const rms = Math.sqrt(sumSquares / frameLength);

							// Smooth the RMS to avoid rapid fluctuations
							this.smoothedRms = this.smoothingFactor * rms + (1 - this.smoothingFactor) * this.smoothedRms;

							// Downsample by averaging groups of samples
							for (let i = 0; i < frameLength; i++) {
								this.sampleSum += channelData[i];
								this.sampleCount++;

								if (this.sampleCount >= this.samplesNeeded) {
									const avgSample = this.sampleSum / this.sampleCount;
									const clampedSample = Math.max(-1, Math.min(1, avgSample));
									this.outputBuffer.push(Math.round(clampedSample * 32767));

									this.sampleSum = 0;
									this.sampleCount = 0;

									if (this.outputBuffer.length >= this.outputBufferSize) {
										const int16Data = new Int16Array(this.outputBuffer);
										this.port.postMessage({ type: 'audio', data: int16Data });
										this.outputBuffer = [];
									}
								}
							}

							// VAD logic with time-based detection
							const isSpeechFrame = this.smoothedRms > this.speechThreshold;

							// Debug logging every ~500ms (at 48kHz with 128 samples per frame = ~187 frames per second)
							this.debugCounter++;
							if (this.debugCounter % 100 === 0) {
								console.log('VAD Debug:', {
									rms: this.smoothedRms.toFixed(4),
									threshold: this.speechThreshold,
									isSpeechFrame,
									isSpeaking: this.isSpeaking,
									speechMs: (this.speechSamples / this.samplesPerMs).toFixed(0),
									silenceMs: (this.silenceSamples / this.samplesPerMs).toFixed(0)
								});
							}

							if (isSpeechFrame) {
								this.speechSamples += frameLength;
								this.silenceSamples = 0;

								if (!this.isSpeaking && this.speechSamples > this.speechTimeMs * this.samplesPerMs) {
									this.isSpeaking = true;
									console.log('VAD: Speech STARTED - triggering');
									this.port.postMessage({ type: 'vad', speaking: true });
								}
							} else {
								this.silenceSamples += frameLength;
								// Don't reset speechSamples immediately - allow brief pauses

								if (this.isSpeaking && this.silenceSamples > this.silenceTimeMs * this.samplesPerMs) {
									this.isSpeaking = false;
									this.speechSamples = 0;
									console.log('VAD: Speech ENDED - triggering transcription');
									this.port.postMessage({ type: 'vad', speaking: false });
								}
							}

							return true;
						}
					}
					registerProcessor('audio-processor', AudioProcessor);
				`], { type: 'application/javascript' }))
			);

			this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
			this.audioWorklet = new AudioWorkletNode(this.inputAudioContext, 'audio-processor', {
				processorOptions: {
					resampleRatio: resampleRatio,
					sampleRate: nativeSampleRate
				}
			});

			this.audioWorklet.port.onmessage = (event) => {
				const msg = event.data;
				if (msg.type === 'audio') {
					this.sendAudio(msg.data);
				} else if (msg.type === 'vad') {
					this.handleVAD(msg.speaking);
				}
			};

			this.sourceNode.connect(this.audioWorklet);
			this.isListening = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to start microphone';
			throw err;
		}
	}

	stopListening(): void {
		// Transcribe any remaining buffered audio
		if (this.audioBuffer.length > 0) {
			this.transcribeBufferedAudio();
		}

		if (this.audioWorklet) {
			this.audioWorklet.disconnect();
			this.audioWorklet = null;
		}

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach(track => track.stop());
			this.mediaStream = null;
		}

		this.isListening = false;
	}

	private handleVAD(speaking: boolean): void {
		if (speaking) {
			console.log('VAD: Speech started');
			// If AI is speaking when user starts talking, interrupt it
			if (this.isSpeaking || this.isPlaying) {
				console.log('VAD: User interrupting AI');
				this.interrupt();
			}
		} else {
			console.log('VAD: Speech ended');
			// Only transcribe if AI is not speaking (to avoid picking up AI voice)
			if (!this.isSpeaking && !this.isPlaying) {
				console.log('VAD: Triggering transcription...');
				this.transcribeBufferedAudio();
			} else {
				console.log('VAD: Skipping transcription - AI is speaking');
			}
		}
	}

	private sendAudio(audioData: Int16Array): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		// Always buffer audio for Whisper transcription
		// We'll handle the feedback loop by clearing buffer when AI starts speaking
		this.audioBuffer.push(audioData);

		// Limit buffer size to prevent memory issues (max ~30 seconds at 16kHz)
		const maxChunks = Math.ceil((16000 * 30) / 512); // ~937 chunks
		if (this.audioBuffer.length > maxChunks) {
			this.audioBuffer = this.audioBuffer.slice(-maxChunks);
		}
	}

	private async transcribeBufferedAudio(): Promise<void> {
		if (this.audioBuffer.length === 0 || this.isTranscribing) return;

		this.isTranscribing = true;

		try {
			// Concatenate all buffered audio
			const totalLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
			const combinedAudio = new Int16Array(totalLength);
			let offset = 0;
			for (const chunk of this.audioBuffer) {
				combinedAudio.set(chunk, offset);
				offset += chunk.length;
			}

			// Clear buffer
			this.audioBuffer = [];

			// Skip if too short (less than 0.3 seconds at 16kHz)
			if (combinedAudio.length < 4800) {
				console.log('VAD: Audio too short, skipping:', combinedAudio.length, 'samples');
				this.isTranscribing = false;
				return;
			}

			console.log('VAD: Sending', combinedAudio.length, 'samples to Whisper (', (combinedAudio.length / 16000).toFixed(2), 'seconds)');

			// Convert to base64
			const base64Audio = this.int16ArrayToBase64(combinedAudio);

			// Send to Whisper service (proxied through SvelteKit)
			const response = await fetch(this.config.whisperServiceUrl!, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					audio_data: base64Audio,
					sample_rate: 16000
				})
			});

			if (!response.ok) {
				throw new Error(`Whisper service error: ${response.status}`);
			}

			const result = await response.json();
			const transcription = result.text?.trim();

			if (transcription) {
				console.log('Whisper transcription:', transcription);

				// Add user message
				this.messages.push({
					role: 'user',
					content: transcription,
					timestamp: new Date(),
					isTranscription: true
				});

				// Send transcribed text to Gemini
				this.sendTextToGemini(transcription);
			}
		} catch (err) {
			console.error('Transcription error:', err);
			this.error = err instanceof Error ? err.message : 'Transcription failed';
		} finally {
			this.isTranscribing = false;
		}
	}

	private sendTextToGemini(text: string): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		// Use clientContent format from the docs
		const message = {
			clientContent: {
				turns: [{
					role: 'user',
					parts: [{ text }]
				}],
				turnComplete: true
			}
		};

		this.ws.send(JSON.stringify(message));
	}

	private int16ArrayToBase64(int16Array: Int16Array): string {
		const bytes = new Uint8Array(int16Array.buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	sendText(text: string): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		this.messages.push({
			role: 'user',
			content: text,
			timestamp: new Date()
		});

		// Use clientContent format from the docs - turns must be an array of turn objects
		const message = {
			clientContent: {
				turns: [{
					role: 'user',
					parts: [{ text }]
				}],
				turnComplete: true
			}
		};

		this.ws.send(JSON.stringify(message));
	}

	disconnect(): void {
		this.stopListening();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.cleanup();
	}

	private cleanup(): void {
		if (this.inputAudioContext) {
			this.inputAudioContext.close();
			this.inputAudioContext = null;
		}

		if (this.outputAudioContext) {
			this.outputAudioContext.close();
			this.outputAudioContext = null;
		}

		this.audioQueue = [];
		this.isPlaying = false;
		this.isConnected = false;
		this.isListening = false;
		this.isSpeaking = false;
	}
}
