import { useEffect, useState } from 'react';
import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';
import { URL_LIMIT, buildShareUrl, encodeWithinLimit } from '../utils/url.ts';

export function ShareModal() {
  const open = useUi((s) => s.shareOpen);
  const set = useUi((s) => s.set);
  const getShare = useWorld((s) => s.getShare);
  const [url, setUrl] = useState('');
  const [trimmed, setTrimmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    let alive = true;
    void (async () => {
      const state = await getShare();
      const { encoded, trimmed: t } = await encodeWithinLimit(state);
      if (!alive) return;
      const u = buildShareUrl(location.href, encoded);
      setUrl(u);
      setTrimmed(t);
      history.replaceState(null, '', `#w=${encoded}`);
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ shareOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      set({ shared: true });
    } catch {
      const el = document.getElementById('share-url') as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div className="modal-back" onClick={() => set({ shareOpen: false })}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="共有" onClick={(e) => e.stopPropagation()}>
        <h2>この世界を共有する</h2>
        <p>地形・降水量・気温・これまでの干渉を、URL だけで再現できる。サーバーには何も送らない。</p>
        <input id="share-url" className="url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <p className="note">
          {url ? `${url.length.toLocaleString('ja-JP')} 文字（上限 ${URL_LIMIT.toLocaleString('ja-JP')} 文字 + 本体のアドレス）` : '作成中…'}
        </p>
        {trimmed ? <p className="note">長いため、線の点を間引き、古い干渉を省いた。復元される世界は少し違うかもしれない。</p> : null}
        <div className="row">
          <button className="btn primary" disabled={!url} onClick={() => void copy()}>
            {copied ? 'コピーした' : 'URL をコピー'}
          </button>
          <button className="btn" onClick={() => set({ shareOpen: false })}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
