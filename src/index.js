import { run } from "./latency-test";

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-run").onclick = run;
});
