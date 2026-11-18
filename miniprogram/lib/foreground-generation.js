// Canvas pixels may be reclaimed in the background even when the node survives.
let generation = 0;
module.exports = {
  invalidate() {
    generation++;
  },
  current() {
    return generation;
  },
};
