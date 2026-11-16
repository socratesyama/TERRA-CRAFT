/** URL に載せるための圧縮。deflate-raw + base64url。非対応環境では無圧縮で保存する。 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(
  input: Uint8Array,
  stream: { writable: WritableStream; readable: ReadableStream }
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  writer.write(input as unknown as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const buf = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buf);
}

export async function compressText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    const packed = await pipe(bytes, new CompressionStream('deflate-raw'));
    return 'z' + toBase64Url(packed);
  }
  return 'r' + toBase64Url(bytes);
}

export async function decompressText(encoded: string): Promise<string> {
  const mode = encoded[0];
  const body = fromBase64Url(encoded.slice(1));
  if (mode === 'z') {
    const raw = await pipe(body, new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(raw);
  }
  if (mode === 'r') return new TextDecoder().decode(body);
  throw new Error('unknown encoding');
}
