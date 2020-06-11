const Tone = require("tone");
const { addPadding } = require("./utils");

class Audio {
  audioContext;
  microphoneStream;

  constructor() {
    this.initAudioContext();
    Tone.start();
  }

  async initAudioContext() {
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
  }

  async checkMicrophoneAccess(sampleRate = 44100) {
    // if (this.microphoneStream) return true; // we already obtained access
    // https://blog.addpipe.com/audio-constraints-getusermedia/
    const constraints = {
      sampleRate,
      sampleSize: 16,
      channelCount: 1,
      volume: 1,
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    };
    this.microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });
  }

  createOfflineAudioContext(length = 16) {
    return new OfflineAudioContext({
      numberOfChannels: 1,
      length,
      sampleRate: this.audioContext.sampleRate,
    });
  }

  async readAudio(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(buffer);
    return audioBuffer;
  }

  async playAndRecord(fromBuffer) {
    const channel = new Tone.Channel(0, 0);
    const player = new Tone.Player(fromBuffer);
    channel.toDestination();
    player.sync().start(0).chain(channel);

    await this.checkMicrophoneAccess(fromBuffer.sampleRate);
    const recorder = new MediaRecorder(this.microphoneStream);
    let startRecordingTime = 0; // audio context time
    let startPlayingTime = 0; // audio context time

    // Save the exact time when the playing starts
    Tone.Transport.once("start", (time) => {
      startPlayingTime = time;
    });
    // Stop recording when playing stops
    Tone.Transport.once("stop", (time) => {
      Tone.Draw.schedule(recorder.stop(), time);
    });

    const blobs = [];
    recorder.addEventListener("start", (event) => {
      // event.timeStamp is uses the performance.now() clock which is different than the
      // audio clock, so we need to transform from one to the other
      const DOMClockTime = performance.now();
      const audioClockTime = Tone.context.currentTime;
      const clocksDifference = DOMClockTime / 1000 - audioClockTime;
      const eventTimestampAudio = event.timeStamp / 1000 - clocksDifference;
      startRecordingTime = eventTimestampAudio;
      // now that we are recording, start playing
      const now = Tone.now()
      Tone.Transport.start(now);
      Tone.Transport.stop(now + player.buffer.duration * 1.1);
    });
    recorder.addEventListener("dataavailable", (event) => {
      blobs.push(event.data);
    });
    // Start recording
    recorder.start();
    // Wait recording to finish
    await new Promise((resolve) => recorder.addEventListener("stop", resolve));

    channel.dispose();
    player.dispose();

    const blob = new Blob(blobs, { type: blobs[0].type });
    // this buffer is encoded (format depends on the browser)
    const recordedBuffer = await blob.arrayBuffer();
    const recordedAudioBuffer = await this.audioContext.decodeAudioData(
      recordedBuffer
    );

    // Latency between when recorder starts and playing audio starts
    const latency = startPlayingTime - startRecordingTime;
    return {buffer: recordedAudioBuffer, latency}
  }

  playBuffer(buffer) {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
    source.stop(this.audioContext.currentTime + buffer.length);
  }

  async generateChirp(length = 88200, fromFreq = 440, toFreq = 1500) {
    const offlineAudioContext = this.createOfflineAudioContext(length);
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

  // delays are in samples
  simulateRecording(fromBuffer, startDelay = 4410, endDelay = 4410) {
    const offlineAudioContext = this.createOfflineAudioContext();
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

    return {buffer, latency: 0};
  }
}

module.exports = Audio;
