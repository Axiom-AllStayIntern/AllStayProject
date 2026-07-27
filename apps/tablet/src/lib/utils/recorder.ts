let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let resolveStop: ((blob: Blob) => void) | null = null;
let activeStream: MediaStream | null = null;

function finalize(mimeType: string) {
	const blob = new Blob(chunks, { type: mimeType });
	activeStream?.getTracks().forEach((t) => t.stop());
	activeStream = null;
	mediaRecorder = null;
	chunks = [];
	resolveStop?.(blob);
	resolveStop = null;
}

export async function startRecording(): Promise<void> {
	if (mediaRecorder) throw new Error('Already recording');

	try {
		activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (err) {
		if (err instanceof DOMException && err.name === 'NotAllowedError') {
			throw new Error('Microphone permission denied. Please allow microphone access and try again.');
		}
		throw new Error('Microphone not available. Please check your device and browser settings.');
	}

	const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
	chunks = [];
	mediaRecorder = new MediaRecorder(activeStream, { mimeType });
	mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
	mediaRecorder.onstop = () => finalize(mimeType);
	mediaRecorder.start();
}

export function stopRecording(): Promise<Blob> {
	return new Promise((resolve, reject) => {
		if (!mediaRecorder || mediaRecorder.state === 'inactive') {
			reject(new Error('Not recording'));
			return;
		}
		resolveStop = resolve;
		mediaRecorder.stop();
	});
}

export function isRecording(): boolean {
	return mediaRecorder !== null && mediaRecorder.state === 'recording';
}
