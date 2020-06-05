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
      channelCount: { exact: 1 },
      volume: 1,
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    };
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });
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
  const chirpDuration =
    offlineAudioContext.length / offlineAudioContext.sampleRate;
  const osc = offlineAudioContext.createOscillator();
  osc.type = "sine";
  osc.frequency.value = fromFreq; // Hz
  osc.frequency.exponentialRampToValueAtTime(toFreq, chirpDuration);
  osc.connect(offlineAudioContext.destination); // connect it to the destination
  osc.start(); // start the oscillator
  const promise = new Promise((resolve) => {
    offlineAudioContext.oncomplete = (e) => resolve(e.renderedBuffer);
    offlineAudioContext.startRendering();
  });
  return promise;
}

function addPadding(fromArray, { value, leftPadding, rightPadding } = {}) {
  if (!value) value = 0;
  if (!leftPadding) leftPadding = 0;
  if (!rightPadding) rightPadding = 0;

  const array = new Float32Array(fromArray.length + leftPadding + rightPadding);

  // left padding
  for (let i = 0; i < leftPadding; i++) array[i] = value;
  // content
  for (let i = 0, len = fromArray.length; i < len; i++)
    array[leftPadding + i] = fromArray[i];
  // right padding
  for (let i = fromArray.length + leftPadding, len = array.length; i < len; i++)
    array[i] = value;
  // Noise
  // Math.random() is in [0; 1.0]
  // audio needs to be in [-1.0; 1.0]
  // nowBuffering[i] = Math.random() * 2 - 1;

  return array;
}

// delays are in samples
function simulateRecording(fromBuffer, startDelay = 4410, endDelay = 4410) {
  const offlineAudioContext = createOfflineAudioContext();
  const buffer = offlineAudioContext.createBuffer(
    fromBuffer.numberOfChannels,
    fromBuffer.length + startDelay + endDelay,
    fromBuffer.sampleRate
  );

  // Fill the buffer
  for (let channel = 0; channel < fromBuffer.numberOfChannels; channel++) {
    // This gives us the actual array that contains the data
    const fromBufferArray = fromBuffer.getChannelData(channel);
    const paddedBufferArray = addPadding(fromBufferArray, {
      value: 0,
      leftPadding: startDelay,
      rightPadding: endDelay,
    });
    buffer.copyToChannel(paddedBufferArray, channel, 0);
  }

  return buffer;
}

async function run() {
  await initAudioContext();

  // const chirpBuffer = await readAudio("chirp.wav");
  // const recordingBuffer = await readAudio("chirp-delayed-100ms.wav");

  const chirpBuffer = await generateChirp(32768);
  const fs = chirpBuffer.sampleRate;
  playBuffer(chirpBuffer);

  const recordingBuffer = simulateRecording(chirpBuffer, fs * 0.25, fs * 0.25);
  // playBuffer(recordingBuffer);
  const chirpData = chirpBuffer.getChannelData(0);
  const recordingData = recordingBuffer.getChannelData(0);

  if (chirpBuffer.sampleRate !== recordingBuffer.sampleRate)
    throw new Error("different sample rates");

  const startTime = performance.now();
  // const { xcorr, iMax } = myCrossCorrelation(chirpData, recordingData);
  const paddedChirpData = addPadding(chirpData, {
    value: 0,
    rightPadding: recordingData.length - chirpData.length,
  });
  const { xcorr, iMax } = crossCorrelation(paddedChirpData, recordingData);
  const latency = (iMax * 1000) / chirpBuffer.sampleRate; // ms
  console.log(iMax);

  const endTime = performance.now();

  console.log("Compute time", endTime - startTime, "ms");
  console.log("Latency", latency, "ms");
  draw(Array.from(xcorr), iMax);
  console.log("Done");
}

function myCrossCorrelation(x, y) {
  const xLength = x.length;
  const sums = [];
  let sum;
  let min = 0;
  let minSum = Infinity;
  for (let i = 0, len = y.length - xLength; i <= len; i++) {
    // console.log(i);
    sum = myCorrelation(x, y.subarray(i, i + xLength));
    // sum = spearmanCorrelation(chirpData, recordingData.subarray(i, i + xLength));
    if (sum < minSum) {
      minSum = sum;
      min = i;
    }
    sums.push(sum);
  }
  return { xcorr: sums, xcorrMax: sum[min], iMax: min };
}

function myCorrelation(x, y) {
  let sum = 0;
  for (let j = 0, len = x.length; j < len; j++) {
    sum += Math.abs(x[j] - y[j]);
  }
  return sum;
}

function spearmanCorrelation(x, y) {
  N = x.length;
  order = [];
  sum = 0;

  for (i = 0; i < N; i++) {
    order.push([x[i], y[i]]);
  }

  order.sort(function (a, b) {
    return a[0] - b[0];
  });

  for (i = 0; i < N; i++) {
    order[i].push(i + 1);
  }

  order.sort(function (a, b) {
    return a[1] - b[1];
  });

  for (i = 0; i < N; i++) {
    order[i].push(i + 1);
  }
  for (i = 0; i < N; i++) {
    sum += Math.pow(order[i][2] - order[i][3], 2);
  }

  r = 1 - (6 * sum) / (N * (N * N - 1));

  return r;
}

// Inspired from: https://github.com/adblockradio/xcorr
function crossCorrelation(sig1, sig2) {
  if (sig1.length !== sig2.length) {
    throw new Error(
      `Xcorr: signal have different lengths ${sig1.length} vs ${sig2.length}`
    );
  }

  if (sig1.length % 2 !== 0 || sig1.length === 0) {
    throw new Error("Xcorr: signals do no seem to be 16-bit PCM.");
  }

  // detect if the signal has not a length equal to a power of 2 (2, 4, 8, 16…), then pad the signals with zeroes.
  // to not mess with the results of ring correlation, it pads with zeros to reach a length equal the second next power of 2.
  const pow2 = Math.log(sig1.length) / Math.log(2);
  if (Math.ceil(pow2) !== pow2) {
    const paddingAmount = Math.round(
      Math.pow(2, Math.ceil(pow2) + 1) - Math.pow(2, pow2)
    );
    sig1 = addPadding(sig1, { value: 0, rightPadding: paddingAmount });
    sig2 = addPadding(sig2, { value: 0, rightPadding: paddingAmount });
  }

  // samples in each signal
  // const l = sig1.length / 2;
  const l = sig1.length;

  // convert Buffer to arrays.
  // const sig1arr = new Array(l).fill(0).map((_, i) => sig1.readInt16LE(2 * i));
  // const sig2arr = new Array(l).fill(0).map((_, i) => sig2.readInt16LE(2 * i));
  const sig1arr = sig1;
  const sig2arr = sig2;

  // compute RMS
  const rms1 = Math.sqrt(
    sig1arr.reduce((rms, sample) => rms + Math.pow(sample, 2), 0) / l
  );
  const rms2 = Math.sqrt(
    sig2arr.reduce((rms, sample) => rms + Math.pow(sample, 2), 0) / l
  );

  // arbitrary sampling rate
  const SAMPLING_RATE = 1;

  const fft1 = new FFT(l, SAMPLING_RATE);
  fft1.forward(sig1arr);

  const fft2 = new FFT(l, SAMPLING_RATE);
  fft2.forward(sig2arr);

  const realp = new Array(l)
    .fill(0)
    .map((_, i) => fft1.real[i] * fft2.real[i] + fft1.imag[i] * fft2.imag[i]);
  const imagp = new Array(l)
    .fill(0)
    .map((_, i) => -fft1.real[i] * fft2.imag[i] + fft2.real[i] * fft1.imag[i]);
  // note we have taken the complex conjugate of fft2.

  const fftp = new FFT(l, SAMPLING_RATE);
  const xcorr = fftp
    .inverse(realp, imagp)
    .map((coef) => coef / rms1 / rms2 / l); // normalize the module of xcorr to [0, 1]

  // index of the max amplitude of xcorr
  const iMax = xcorr.reduce(
    (indexTemporaryMax, testCoef, indexTestCoef) =>
      Math.abs(testCoef) > Math.abs(xcorr[indexTemporaryMax])
        ? indexTestCoef
        : indexTemporaryMax,
    0
  );

  return {
    xcorr,
    xcorrMax: xcorr[iMax],
    iMax: iMax < l / 2 ? iMax : iMax - l, // have iMax relative to index 0
  };
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
