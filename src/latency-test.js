const Audio = require("./audio");
const { crossCorrelation, myCrossCorrelation } = require("./cross-correlation");
const { draw } = require("./graph");
const { addPadding } = require("./utils");

async function run() {
  const crossCorrelationOption = document.querySelector("#cross-correlation")
    .selectedOptions[0].value;
  const sourceOption = document.querySelector("#source").selectedOptions[0]
    .value;

  const audio = new Audio();

  const chirpBuffer = await audio.generateChirp(32768);
  const fs = chirpBuffer.sampleRate;

  let recordingBuffer;
  if (sourceOption === "simulate") {
    recordingBuffer = audio.simulateRecording(
      chirpBuffer,
      fs * 0.25,
      fs * 0.25
    );
    audio.playBuffer(chirpBuffer);
  } else {
    // microphone
    recordingBuffer = audio.simulateRecording(
      chirpBuffer,
      fs * 0.25,
      fs * 0.25
    );
  }

  const chirpData = chirpBuffer.getChannelData(0);
  const recordingData = recordingBuffer.getChannelData(0);

  if (chirpBuffer.sampleRate !== recordingBuffer.sampleRate)
    throw new Error("different sample rates");

  let crossCorrelationFunction;
  if (crossCorrelationOption === "sample")
    crossCorrelationFunction = () =>
      myCrossCorrelation(chirpData, recordingData);
  // fft
  else
    crossCorrelationFunction = () => {
      const paddedChirpData = addPadding(chirpData, {
        value: 0,
        rightPadding: recordingData.length - chirpData.length,
      });
      return crossCorrelation(paddedChirpData, recordingData);
    };

  const startTime = performance.now();
  const { xcorr, iMax } = crossCorrelationFunction();
  const latency = (iMax * 1000) / chirpBuffer.sampleRate; // ms

  const endTime = performance.now();

  document.querySelector("#latency").innerHTML = `Latency: ${latency}ms`;
  document.querySelector("#computation-time").innerHTML = `Computation time: ${
    endTime - startTime
  }ms`;
  draw(Array.from(xcorr), iMax);
  console.log("Done");
}

module.exports = {
  run,
};
