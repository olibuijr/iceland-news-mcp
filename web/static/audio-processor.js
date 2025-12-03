/**
 * Audio Processor Worklet
 * Processes audio in real-time and sends chunks for streaming
 */

class AudioProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.bufferSize = 4096; // ~256ms at 16kHz
		this.buffer = new Float32Array(this.bufferSize);
		this.bufferIndex = 0;
	}

	process(inputs, outputs, parameters) {
		const input = inputs[0];
		if (!input || !input[0]) return true;

		const channelData = input[0];

		// Calculate RMS level for VAD
		let sum = 0;
		for (let i = 0; i < channelData.length; i++) {
			sum += channelData[i] * channelData[i];
		}
		const rms = Math.sqrt(sum / channelData.length);

		this.port.postMessage({ type: 'level', level: rms });

		// Buffer audio data
		for (let i = 0; i < channelData.length; i++) {
			this.buffer[this.bufferIndex++] = channelData[i];

			if (this.bufferIndex >= this.bufferSize) {
				// Send buffer
				this.port.postMessage({
					type: 'audio',
					audio: new Float32Array(this.buffer)
				});
				this.bufferIndex = 0;
			}
		}

		return true;
	}
}

registerProcessor('audio-processor', AudioProcessor);
