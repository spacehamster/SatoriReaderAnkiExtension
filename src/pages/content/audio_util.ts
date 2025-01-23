import MPEGMode from 'lamejs/src/js/MPEGMode';
import Lame from 'lamejs/src/js/Lame';
import BitStream from 'lamejs/src/js/BitStream';

import lamejs from 'lamejs';

(window as any).MPEGMode = MPEGMode;
(window as any).Lame = Lame;
(window as any).BitStream = BitStream;


function blobToBase64(blob: Blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64.split(',')[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
function audioBufferToWavBlob(buffer: AudioBuffer) {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numberOfChannels * 2 + 44;
  const wavBuffer = new ArrayBuffer(length);
  const view = new DataView(wavBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length - 44, true);

  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
function writeString(view: DataView<ArrayBuffer>, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
const sampleChannel = (channelData: Float32Array, start: number, size: number) => {
  const sampleChunk = new Int16Array(size);
  for (let j = 0; j < size; j++) {
    let v = channelData[start + j];
    v = v < 0 ? v * 32768 : v * 32767;
    v = Math.max(-32768, Math.min(32768, v))
    sampleChunk[j] = v;
  }
  return sampleChunk;
}
function encodeMp3(audioBuffer: AudioBuffer) {
  console.log(`Encoding mp3. ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate} samplerate, 128 bitrate`)
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128); // 128 kbps bitrate
  let mp3Data = [];
  const samplesPerFrame = 1152;
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = numChannels > 1 ?
    audioBuffer.getChannelData(1) :
    null;
  for (let i = 0; i < leftChannel.length; i += samplesPerFrame) {
    const leftSampleChunk = sampleChannel(leftChannel, i, samplesPerFrame);
    const rightSampleChunk = rightChannel ?
      sampleChannel(leftChannel, i, samplesPerFrame) :
      null;
    const mp3Chunk = mp3Encoder.encodeBuffer(leftSampleChunk, rightSampleChunk);
    if (mp3Chunk.length > 0) {
      mp3Data.push(mp3Chunk);
    }
  }
  // Flush the MP3 encoder
  const flushChunk = mp3Encoder.flush();
  if (flushChunk.length > 0) {
    mp3Data.push(flushChunk);
  }

  // Create a Blob from the MP3 data
  return new Blob(mp3Data, { type: "audio/mp3" });
}

export async function fetchAudioClip(url: string, startTime: number, endTime?: number) {
  //'https://content.cdn.satorireader.com/article-audio/tu8qfhln1d1jxm94/inline/kiki-mimi-rajio-episode-12-edition-n.mp3'
  console.log(`Fetching audio clip for ${url}, startTime: ${startTime}, endTime: ${endTime}`);
  const base64 = await chrome.runtime.sendMessage({ command: "download", url: url }) as string;
  const arrayBuffer = base64ToArrayBuffer(base64);
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const duration = endTime ? endTime - startTime : audioBuffer.duration - startTime;
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor((startTime + duration) * sampleRate);
  const clipBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    endSample - startSample,
    sampleRate
  );
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = clipBuffer.getChannelData(channel);
    outputData.set(inputData.subarray(startSample, endSample));
  }
  let mp3Blob = encodeMp3(clipBuffer);
  let mp3Base64 = await blobToBase64(mp3Blob);
  return mp3Base64;
}