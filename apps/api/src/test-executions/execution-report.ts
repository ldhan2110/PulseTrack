/** Shapes the report needs — a trimmed view over the persisted data. */
export interface ReportStep {
  name: string;
  status: string;
  duration: number;
}
export interface ReportCase {
  name: string;
  result: string;
  notes?: string | null;
  executedBy?: string | null;
  status?: string | null; // automation run status
  duration?: number | null;
  error?: string | null;
  steps: ReportStep[];
  /** data: URI of the latest pass/failure screenshot, if any. */
  screenshot?: string | null;
}
export interface ReportData {
  executionKey: string;
  name: string;
  status: string;
  assignee?: string | null;
  sprint?: string | null;
  createdAt?: string | null;
  cases: ReportCase[];
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const RESULT_COLOR: Record<string, string> = {
  PASS: '#16a34a',
  FAIL: '#dc2626',
  BLOCKED: '#d97706',
  SKIP: '#6b7280',
  NOT_RUN: '#9ca3af',
  IN_PROGRESS: '#ca8a04',
};

const RESULT_ORDER = ['PASS', 'FAIL', 'BLOCKED', 'SKIP', 'IN_PROGRESS', 'NOT_RUN'];

/** Build a self-contained HTML report for one execution. */
export function renderReportHtml(data: ReportData): string {
  const total = data.cases.length;
  const counts = data.cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.result] = (acc[c.result] ?? 0) + 1;
    return acc;
  }, {});
  const present = RESULT_ORDER.filter((r) => counts[r]);
  const passPct = total ? Math.round(((counts.PASS ?? 0) / total) * 100) : 0;

  // Stacked progress bar segments, in a stable order.
  const bar = present
    .map((r) => `<span style="width:${(counts[r] / total) * 100}%;background:${RESULT_COLOR[r]}"></span>`)
    .join('');

  // Stat pills.
  const pills = present
    .map(
      (r) => `<div class="pill">
        <span class="dot" style="background:${RESULT_COLOR[r]}"></span>
        <b>${counts[r]}</b> <span class="pill-l">${esc(r.replace('_', ' '))}</span>
      </div>`,
    )
    .join('');

  const metaChips = [
    data.sprint ? `Sprint · ${esc(data.sprint)}` : '',
    data.assignee ? `Assignee · ${esc(data.assignee)}` : '',
    data.createdAt ? `Created · ${esc(data.createdAt)}` : '',
  ]
    .filter(Boolean)
    .map((t) => `<span class="chip">${t}</span>`)
    .join('');

  const cards = data.cases
    .map((c, i) => {
      const color = RESULT_COLOR[c.result] ?? '#374151';
      const steps = c.steps.length
        ? `<div class="steps">${c.steps
            .map((s) => {
              const failed = s.status === 'failed';
              return `<div class="step">
                <span class="ico" style="color:${failed ? '#dc2626' : '#16a34a'}">${failed ? '✕' : '✓'}</span>
                <span class="step-n">${esc(s.name)}</span>
                <span class="dur">${s.duration}ms</span>
              </div>`;
            })
            .join('')}</div>`
        : '';
      const error = c.error ? `<pre class="error">${esc(c.error)}</pre>` : '';
      const shot = c.screenshot
        ? `<div class="shot-wrap"><img class="shot" src="${c.screenshot}" alt="screenshot" /></div>`
        : '';
      const notes = c.notes ? `<div class="notes">${esc(c.notes)}</div>` : '';
      const meta = [
        c.status ? esc(c.status) : '',
        c.duration != null ? `${(c.duration / 1000).toFixed(1)}s` : '',
        c.executedBy ? `by ${esc(c.executedBy)}` : '',
      ]
        .filter(Boolean)
        .join(' &middot; ');
      return `<section class="case" style="--accent:${color}">
        <div class="case-head">
          <span class="num">${i + 1}</span>
          <span class="badge" style="background:${color}">${esc(c.result.replace('_', ' '))}</span>
          <h3>${esc(c.name)}</h3>
        </div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
        ${notes}${steps}${error}${shot}
      </section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  :root { --bd:#e5e7eb; --mut:#6b7280; --ink:#111827; }
  * { box-sizing: border-box; }
  body { font: 14px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--ink); margin: 0; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 860px; margin: 0 auto; padding: 32px 28px 48px; }
  .cover { background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; border-radius: 14px; padding: 26px 28px; margin-bottom: 22px; }
  .cover .key { font: 700 12px/1 ui-monospace, monospace; letter-spacing: .06em; color: #93c5fd; text-transform: uppercase; }
  .cover h1 { font-size: 24px; font-weight: 700; margin: 8px 0 14px; letter-spacing: -.01em; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font-size: 12px; color: #cbd5e1; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); padding: 3px 10px; border-radius: 999px; }
  .score { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 10px; }
  .score b { font-size: 30px; font-weight: 800; letter-spacing: -.02em; }
  .score .of { color: var(--mut); font-size: 13px; }
  .track { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; display: flex; margin-bottom: 16px; }
  .track span { display: block; height: 100%; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; }
  .pill { display: inline-flex; align-items: center; gap: 7px; background: #fff; border: 1px solid var(--bd); border-radius: 10px; padding: 7px 12px; font-size: 13px; }
  .pill b { font-weight: 700; }
  .pill-l { color: var(--mut); text-transform: capitalize; }
  .dot { width: 9px; height: 9px; border-radius: 999px; }
  .case { background: #fff; border: 1px solid var(--bd); border-left: 4px solid var(--accent); border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; page-break-inside: avoid; }
  .case-head { display: flex; align-items: center; gap: 10px; }
  .num { font: 700 12px/1 ui-monospace, monospace; color: var(--mut); min-width: 18px; }
  .case h3 { font-size: 15px; font-weight: 600; margin: 0; flex: 1; }
  .badge { color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .04em; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
  .meta { color: var(--mut); font-size: 12px; margin: 6px 0 0 28px; }
  .notes { margin: 10px 0 0 28px; color: #374151; }
  .steps { margin: 12px 0 0 28px; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
  .step { display: flex; align-items: center; gap: 10px; padding: 6px 10px; font: 12px/1.4 ui-monospace, monospace; border-top: 1px solid #f1f5f9; }
  .step:first-child { border-top: 0; }
  .step .ico { font-weight: 700; }
  .step-n { flex: 1; word-break: break-word; }
  .step .dur { color: #94a3b8; }
  .error { margin: 12px 0 0 28px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; font: 12px/1.5 ui-monospace, monospace; }
  .shot-wrap { margin: 12px 0 0 28px; }
  .shot { max-width: 100%; border: 1px solid var(--bd); border-radius: 8px; display: block; }
  .empty { color: var(--mut); text-align: center; padding: 40px; }
  @page { margin: 14mm; }
</style></head><body>
  <div class="page">
    <div class="cover">
      <div class="key">${esc(data.executionKey) || 'EXECUTION'} &middot; ${esc(data.status)}</div>
      <h1>${esc(data.name)}</h1>
      <div class="chips">${metaChips}</div>
    </div>
    ${
      total
        ? `<div class="score"><b>${passPct}%</b><span class="of">passed &middot; ${total} case${total === 1 ? '' : 's'}</span></div>
    <div class="track">${bar}</div>
    <div class="pills">${pills}</div>
    ${cards}`
        : `<div class="empty">No cases in this execution.</div>`
    }
  </div>
</body></html>`;
}
