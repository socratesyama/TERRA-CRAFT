export function smoothHeight(
  height: Float32Array,
  size: number,
  passes: number
): void {
  let next = new Float32Array(height.length);
  for (let p = 0; p < passes; p++) {
    next.set(height);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        next[i] =
          (height[i] * 4 +
            height[i - 1] +
            height[i + 1] +
            height[i - size] +
            height[i + size]) /
          8;
      }
    }
    height.set(next);
  }
}
