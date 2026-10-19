const apiKey = "EXAMPLE_NOT_A_REAL_KEY";

function run(userInput) {
  return eval(userInput);
}

function load(el, html) {
  el.innerHTML = html;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) {}
}

module.exports = { run, load, safeParse, apiKey };
