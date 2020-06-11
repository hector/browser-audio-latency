const {addPadding} = require("./utils");

class Audio {
    audioContext;
    microphoneStream;

    constructor() {
        this.initAudioContext();
    }
    
    async initAudioContext() {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
    }
    
    async checkMicrophoneAccess() {
      if (this.microphoneStream) return true; // we already obtained access
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
        this.microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: constraints,
        });
        return true;
      } catch (error) {
        return false;
      }
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
    
      return buffer;
    }
}

module.exports = Audio;