/** 画面の画像（data URL）を PNG として保存する */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function worldFilename(time: number): string {
  return `terra-craft-year${Math.round(time)}.png`;
}
