import { useWorld } from '../state/worldStore.ts';

/** 何をしたか、何が起きたかを時系列で。因果の連鎖は矢印でつなぐ。 */
export function EventLog() {
  const events = useWorld((s) => s.snap?.events);
  const list = events ? [...events].reverse() : [];
  return (
    <section className="log" aria-label="イベントログ">
      <h2>イベントログ</h2>
      {list.length === 0 ? (
        <p className="note">雨を降らせて時間を進めると、ここに世界の出来事が並ぶ。</p>
      ) : (
        <ol className="events" reversed>
          {list.map((e, i) => (
            <li key={`${e.year}-${i}`} className={e.kind === 'chain' ? 'event chain' : 'event'}>
              <span className="year">年 {e.year}</span>
              {e.chain ? (
                <span className="chain-steps">
                  {e.chain.map((c, k) => (
                    <span key={k} className="step">
                      {c}
                    </span>
                  ))}
                </span>
              ) : (
                <span>{e.message}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
