function releaseCanvas(canvas) {
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }
}
module.exports = { releaseCanvas };
