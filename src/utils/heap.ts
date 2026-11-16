/** 数値キーの最小ヒープ。水面計算と道路探索で使う。 */
export class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;

  constructor(capacity: number) {
    this.keys = new Float64Array(capacity + 1);
    this.vals = new Int32Array(capacity + 1);
  }

  clear(): void {
    this.size = 0;
  }

  push(key: number, val: number): void {
    if (this.size + 1 >= this.keys.length) this.grow();
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.vals[i] = this.vals[p];
      i = p;
    }
    this.keys[i] = key;
    this.vals[i] = val;
  }

  /** 最小のキーを持つ値を取り出す。popKey に直前のキーが入る。 */
  popKey = 0;
  pop(): number {
    const topVal = this.vals[0];
    this.popKey = this.keys[0];
    const n = --this.size;
    if (n > 0) {
      const key = this.keys[n];
      const val = this.vals[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= key) break;
        this.keys[i] = this.keys[c];
        this.vals[i] = this.vals[c];
        i = c;
      }
      this.keys[i] = key;
      this.vals[i] = val;
    }
    return topVal;
  }

  private grow(): void {
    const cap = this.keys.length * 2;
    const nk = new Float64Array(cap);
    const nv = new Int32Array(cap);
    nk.set(this.keys);
    nv.set(this.vals);
    this.keys = nk;
    this.vals = nv;
  }
}
