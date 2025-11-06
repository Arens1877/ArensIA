
// Audio Decoding
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Audio Encoding
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// File Conversion
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Video Frame Extraction
export const extractFramesFromVideo = async (videoFile: File, framesPerSecond: number): Promise<string[]> => {
    return new Promise((resolve) => {
        const frames: string[] = [];
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            resolve([]);
            return;
        }

        video.src = URL.createObjectURL(videoFile);
        video.muted = true;

        video.onloadeddata = async () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;
            const interval = 1 / framesPerSecond;

            for (let time = 0; time < duration; time += interval) {
                video.currentTime = time;
                await new Promise(r => video.onseeked = r);
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
                frames.push(base64Data);
            }
            URL.revokeObjectURL(video.src);
            resolve(frames);
        };
        video.load();
    });
};
