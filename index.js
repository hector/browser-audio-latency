let audioContext;
let microphoneStream;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-run").onclick = run;
});

async function initAudioContext() {
  audioContext = new AudioContext();
  await audioContext.resume();
}

async function checkMicrophoneAccess() {
  if (microphoneStream) return true; // we already obtained access
  try {
    // https://blog.addpipe.com/audio-constraints-getusermedia/
    const constraints = {
      sampleRate: 44100,
      sampleSize: 16,
      channelCount: {exact: 1},
      volume: 1,
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    };
    microphoneStream = await navigator.mediaDevices.getUserMedia({audio: constraints});
    return true;
  } catch (error) {
    return false;
  }
}

function createOfflineAudioContext(length = 16) {
  return new OfflineAudioContext({
    numberOfChannels: 1,
    length,
    sampleRate: audioContext.sampleRate,
  });
}

async function readAudio(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  return audioBuffer;
}

function playBuffer(buffer) {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  source.stop(audioContext.currentTime + buffer.length);
}

async function generateChirp(length = 88200, fromFreq = 440, toFreq = 1500) {
  const offlineAudioContext = createOfflineAudioContext(length);
  const chirpDuration = offlineAudioContext.length / offlineAudioContext.sampleRate;
  const osc = offlineAudioContext.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = fromFreq; // Hz
  osc.frequency.exponentialRampToValueAtTime(toFreq, chirpDuration);
  osc.connect(offlineAudioContext.destination); // connect it to the destination
  osc.start(); // start the oscillator
  const promise = new Promise(resolve => {
    offlineAudioContext.oncomplete = e => resolve(e.renderedBuffer);
    offlineAudioContext.startRendering();
  });
  return promise;
}

// delays are in samples
function simulateRecording(fromBuffer, startDelay = 4410, endDelay = 4410) {
  startDelay = Math.round(startDelay);
  endDelay = Math.round(endDelay);

  const offlineAudioContext = createOfflineAudioContext();
  const buffer = offlineAudioContext.createBuffer(
    fromBuffer.numberOfChannels, 
    fromBuffer.length + startDelay + endDelay,
    fromBuffer.sampleRate
  );

  // Fill the buffer
  for (let channel = 0; channel < fromBuffer.numberOfChannels; channel++) {
    // This gives us the actual array that contains the data
    const fromBufferData = fromBuffer.getChannelData(channel);
    const bufferData = buffer.getChannelData(channel);
    for (let i = 0; i < startDelay; i++) bufferData[i] = 0;
    for (let i = 0, len = fromBufferData.length; i < len; i++) {
      bufferData[startDelay + i] = fromBufferData[i];
    }
    for (let i = fromBufferData.length + startDelay, len = bufferData.length; i < len; i++) bufferData[i] = 0;
  }

  // Noise
  // Math.random() is in [0; 1.0]
  // audio needs to be in [-1.0; 1.0]
  // nowBuffering[i] = Math.random() * 2 - 1;

  return buffer;
}

async function run() {
  await initAudioContext();
  const chirpBuffer = await generateChirp(32768);
  const fs = chirpBuffer.sampleRate;
  playBuffer(chirpBuffer);
  const recordingBuffer = simulateRecording(chirpBuffer, fs * 0.25, fs * 0.25);
  // playBuffer(recordingBuffer);

  // const chirpBuffer = await readAudio("chirp.wav");
  // const recordingBuffer = await readAudio("chirp-delayed-100ms.wav");
  const chirpData = chirpBuffer.getChannelData(0);
  const recordingData = recordingBuffer.getChannelData(0);
  
  if (chirpBuffer.sampleRate !== recordingBuffer.sampleRate)
    throw new Error("different sample rates");
  
  const startTime = performance.now();
  const chirpBufferLength = chirpBuffer.length;
  const sums = [];
  let sum;
  let min = 0;
  let minSum = Infinity;
  for (
    let i = 0, len = recordingBuffer.length - chirpBufferLength;
    i <= len;
    i++
  ) {
    // console.log(i);
    sum = myCorrelation(chirpData, recordingData.subarray(i, i + chirpBufferLength));
    // sum = ss.sampleCorrelation(chirpData, recordingData.subarray(i, i + chirpBufferLength));
    // sum = spearmanCorrelation(chirpData, recordingData.subarray(i, i + chirpBufferLength));
    if (sum < minSum) {
      minSum = sum;
      min = i;
    }
    sums.push(sum);
  }

  const latency = (min * 1000) / chirpBuffer.sampleRate; // ms
  const endTime = performance.now();

  console.log("Compute time", endTime - startTime, "ms");
  console.log("Latency", latency, "ms");
  draw(sums, min);
  console.log("Done");
}

function myCorrelation(x, y) {
  let sum = 0;
  for (let j = 0, len = x.length; j < len; j++) {
    sum += Math.abs(x[j] - y[j]);
  }
  return sum;
}

function spearmanCorrelation(x, y){
  N=x.length;
  order=[];
  sum=0;

  for(i=0;i<N;i++){
      order.push([x[i], y[i]]);
  }

  order.sort(function(a,b){
      return a[0]-b[0]
  });

  for(i=0;i<N;i++){
      order[i].push(i+1);
  }

  order.sort(function(a,b){
      return a[1]-b[1]
  });

  for(i=0;i<N;i++){
      order[i].push(i+1);
  }
  for(i=0;i<N;i++){
      sum+=Math.pow((order[i][2])-(order[i][3]), 2);

  }

  r=1-(6*sum/(N*(N*N-1)));

  return r;
}

function draw(data, min = undefined) {
  const dataPoints = data.map((v) => ({ y: v }));
  if (min)
    dataPoints[min] = {
      y: data[min],
      indexLabel: "\u2193 lowest",
      markerColor: "DarkSlateGrey",
      markerType: "cross",
    };
  const chart = new CanvasJS.Chart("chartContainer", {
    animationEnabled: true,
    theme: "light2",
    title: {
      text: "Correlation",
    },
    axisY: {
      includeZero: false,
    },
    data: [
      {
        type: "line",
        indexLabelFontSize: 16,
        dataPoints,
      },
    ],
  });
  chart.render();
}
