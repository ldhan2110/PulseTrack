import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? '.');
const DEV = path.join(ROOT, 'devspec');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- parse tasks.yml (flat: 2-space change key, 4-space fields, single-line quoted notes) ----
function parseBoard(text) {
  const changes = {};
  let cur = null;
  for (const raw of text.split('\n')) {
    if (/^changes:\s*$/.test(raw)) continue;
    const key = raw.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (key) { cur = key[1]; changes[cur] = { id: cur }; continue; }
    const fld = raw.match(/^ {4}([A-Za-z_]+):\s*(.*)$/);
    if (fld && cur) {
      let [, k, v] = fld;
      v = v.trim();
      if (v.startsWith('"') && v.endsWith('"') && v.length > 1) v = v.slice(1, -1);
      else if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      changes[cur][k] = v;
    }
  }
  return changes;
}

// ---- sections done/total from a change's tasks_md ----
function sectionCounts(tasksMdRel) {
  try {
    const p = path.join(DEV, tasksMdRel);
    const t = fs.readFileSync(p, 'utf8');
    const lines = t.split('\n');
    const sections = [];
    let s = null;
    for (const l of lines) {
      if (/^##\s+\d+\./.test(l)) { s = { boxes: [], done: 0 }; sections.push(s); }
      else if (s) {
        const m = l.match(/^\s*-\s*\[([ xX])\]/);
        if (m) { s.boxes.push(m[1]); if (m[1].toLowerCase() === 'x') s.done++; }
      }
    }
    const total = sections.length;
    const done = sections.filter((x) => x.boxes.length > 0 && x.done === x.boxes.length).length;
    return { done, total };
  } catch { return null; }
}

// ---- runs.jsonl ----
function readRuns() {
  try {
    return fs.readFileSync(path.join(DEV, 'report/runs.jsonl'), 'utf8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  } catch { return []; }
}

// ---- blockers.md: ## blocks; open unless a status/resolved marker says otherwise ----
function readBlockers() {
  let text;
  try { text = fs.readFileSync(path.join(DEV, 'report/blockers.md'), 'utf8'); } catch { return []; }
  const blocks = [];
  let cur = null;
  for (const l of text.split('\n')) {
    const h = l.match(/^##\s+(.*)$/);
    if (h) { cur = { heading: h[1].trim(), body: [] }; blocks.push(cur); }
    else if (cur) cur.body.push(l);
  }
  return blocks.filter((b) => {
    // a dedicated status field line (e.g. "status: resolved" or "**status:** closed"),
    // NOT inline prose like "reset status: blocked -> pending"
    const st = b.body.map((l) => l.trim().match(/^\**status:\**\s*(\w+)/i)).find(Boolean);
    if (st) return st[1].toLowerCase() === 'open';
    return !/\b(resolved|closed)\b/.test(b.heading.toLowerCase());
  }).reverse();
}

const board = parseBoard(fs.readFileSync(path.join(DEV, 'changes/tasks.yml'), 'utf8'));
const list = Object.values(board);
for (const c of list) c.sc = c.tasks_md ? sectionCounts(c.tasks_md) : null;
const runs = readRuns();
const blockers = readBlockers();

const scStr = (c) => (c.sc ? `${c.sc.done}/${c.sc.total}` : '—');
const done = list.filter((c) => c.status === 'done');
const inprog = list.filter((c) => ['doing', 'pending', 'blocked'].includes(c.status));
const nDoing = list.filter((c) => c.status === 'doing').length;
const nBlocked = list.filter((c) => c.status === 'blocked').length;
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DevSpec Report</title><style>
:root{--bg:#0f1115;--card:#181b22;--fg:#e6e8eb;--muted:#9aa3af;--border:#2a2f3a;--ok:#22c55e;--doing:#eab308;--blocked:#ef4444;--pending:#64748b;--radius:10px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px}
.wrap{max-width:960px;margin:0 auto}h1{font-size:22px;margin:0 0 2px}.ts{color:var(--muted);font-size:12px;margin-bottom:18px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:26px 0 10px;border-bottom:1px solid var(--border);padding-bottom:6px}
.counts{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;margin:12px 0}
.counts b{font-size:20px}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin:8px 0}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.title{font-weight:600}.sc{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.badge{font-size:11px;padding:1px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.badge.done{background:rgba(34,197,94,.15);color:var(--ok)}.badge.doing{background:rgba(234,179,8,.15);color:var(--doing)}
.badge.blocked{background:rgba(239,68,68,.15);color:var(--blocked)}.badge.pending{background:rgba(100,116,139,.2);color:var(--pending)}
.notes{color:var(--muted);font-size:12.5px;margin-top:6px;white-space:pre-wrap}
.blocker{border-left:3px solid var(--blocked);padding-left:12px;margin:10px 0}
.blocker h3{margin:0 0 4px;font-size:14px}.blocker .b{color:var(--muted);font-size:12.5px;white-space:pre-wrap}
.hist{border-left:2px solid var(--border);padding-left:12px;margin:8px 0}
.hist .h{font-size:13px}.hist .s{color:var(--muted);font-size:12.5px;margin-top:2px;white-space:pre-wrap}
.empty{color:var(--muted);font-style:italic}
</style></head><body><div class="wrap">
<h1>DevSpec Report</h1>
<div class="ts">generated ${esc(new Date().toISOString())}</div>
<div class="counts">
  <span><b>${done.length}</b> done</span>
  <span><b>${nDoing}</b> in-progress</span>
  <span><b>${nBlocked}</b> blocked</span>
  <span><b>${list.length}</b> total</span>
</div>

<h2>Open Blockers</h2>
${blockers.length ? blockers.map((b) => `<div class="blocker"><h3>${esc(b.heading)}</h3><div class="b">${esc(b.body.join('\n').trim())}</div></div>`).join('') : '<p class="empty">no open blockers</p>'}

<h2>Implemented</h2>
${done.length ? done.map((c) => `<div class="card"><div class="row"><span class="title">${esc(c.title || c.id)}</span><span class="sc">${scStr(c)} ${badge('done')}</span></div></div>`).join('') : '<p class="empty">none yet</p>'}

<h2>In progress / Left</h2>
${inprog.length ? inprog.map((c) => `<div class="card"><div class="row"><span class="title">${esc(c.title || c.id)}</span><span class="sc">${scStr(c)} ${badge(c.status)}</span></div>${c.status === 'blocked' && c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}</div>`).join('') : '<p class="empty">nothing in flight</p>'}

<h2>History</h2>
${runs.length ? runs.map((r) => `<div class="hist"><div class="h">${esc(r.ts)} · ${esc(r.title || r.change_id)} ${badge(r.status)} · ${esc(r.sections_done)}/${esc(r.sections_total)}</div><div class="s">${esc(r.summary || '')}${r.blocked_reason ? '\n⛔ ' + esc(r.blocked_reason) : ''}</div></div>`).join('') : '<p class="empty">no runs recorded</p>'}
</div></body></html>`;

fs.writeFileSync(path.join(DEV, 'report/report.html'), html);
console.log(`report.html written — ${list.length} changes, ${done.length} done, ${nBlocked} blocked, ${blockers.length} open blockers, ${runs.length} runs`);
