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

module.exports = {
  addPadding,
};
