const latencyTest = require("./src/latency-test");

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-run").onclick = latencyTest.run;
});
