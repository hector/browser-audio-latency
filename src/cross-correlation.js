const DSP = require("dsp.js");
const {addPadding} = require("./utils");

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

  const fft1 = new DSP.FFT(l, SAMPLING_RATE);
  fft1.forward(sig1arr);

  const fft2 = new DSP.FFT(l, SAMPLING_RATE);
  fft2.forward(sig2arr);

  const realp = new Array(l)
    .fill(0)
    .map((_, i) => fft1.real[i] * fft2.real[i] + fft1.imag[i] * fft2.imag[i]);
  const imagp = new Array(l)
    .fill(0)
    .map((_, i) => -fft1.real[i] * fft2.imag[i] + fft2.real[i] * fft1.imag[i]);
  // note we have taken the complex conjugate of fft2.

  const fftp = new DSP.FFT(l, SAMPLING_RATE);
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

module.exports = {
  crossCorrelation,
  myCrossCorrelation,
};
