let audioContext = new AudioContext();

document.addEventListener("DOMContentLoaded", function () {
  audioContext = new AudioContext();
  document.getElementById("btn-run").onclick = run;
});

async function readAudio(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  return audioBuffer;
}

async function run() {
  const chirpBuffer = await readAudio("chirp.wav");
  const recordingBuffer = await readAudio("chirp-delayed-100ms.wav");
  const chirpData = chirpBuffer.getChannelData(0);
  const recordingData = recordingBuffer.getChannelData(0);

  console.log(chirpBuffer);
  const sums = [];
  let sum;
  for (let i = 0; i < recordingBuffer.length - chirpBuffer.length + 1; i++) {
    sum = 0;
    for (let j = 0; j < chirpBuffer.length; j++) {
      sum += Math.abs(chirpBuffer[j] - recordingBuffer[i + j]);
    }
    sums.push(sum);
  }
}
