// Position of item in list, counting from 1 (first element is position 1). Returns 0 when absent.
function positionOf(list, item) {
  return list.indexOf(item) + 1;
}

module.exports = { positionOf };
