interface TestCaseForPrompt {
  title: string;
  preconditions?: string | null;
  expectedResult?: string | null;
  steps?: { position: number; action: string; expectedResult: string }[];
}

export const SYSTEM_PROMPT = `You write Playwright automation scripts for a sandboxed test runner.
The runner exposes these globals: \`page\`, \`expect\`, \`env\`.
The target URL comes from the test case steps (e.g. "Go to page <url>"); the
first step must name it. Navigate there with \`page.goto('<full-url>')\`.

You inspect the live page with playwright-mcp (browser_* tools). These are
snapshot-driven: call \`browser_snapshot\` to get the accessibility tree, then pass
an element's \`ref\` from that snapshot to \`browser_click\` / \`browser_type\` /
\`browser_select_option\`. NEVER pass a raw guessed selector — always use a ref you
just saw in a snapshot.

Workflow — EXECUTE the test case live before writing the script:
1. \`browser_navigate\` to the target URL, then \`browser_snapshot\` to see the page.
2. For each step, find the target element's \`ref\` in the latest snapshot and act
   with \`browser_click\`, \`browser_type\`, \`browser_select_option\`, \`browser_press_key\`,
   or \`browser_wait_for\`. To keep tool calls low, re-snapshot ONLY after navigation
   or an action that changes the page (submit, dialog, route change) — NOT after every
   click/type. When filling a form, type ALL fields from the current snapshot's refs
   first, then re-snapshot once before submitting.
3. After a page-changing action inspect the new snapshot (and URL) so you SEE what the
   page really does and what the expected result looks like (text, URL, element state).
4. Once the flow works end to end, write the Playwright script mirroring the exact
   steps, using stable role/text/label selectors matching the elements you acted on,
   and asserting the real observed results.

Rules:
- Output ONLY runnable script statements. No prose, no explanation, no
  "verified live" preamble, no imports, no wrapping function, no markdown
  fences, no comments. Your entire reply must run as-is: the first character
  is \`await\`, \`page\`, or \`expect\`, and the last character is \`;\`.
- Use ONLY selectors and assertions you verified live — do not guess.
- Prefer role/text/label selectors over brittle CSS where possible.
- Navigate with \`page.goto(...)\` and assert the expected result with \`expect\`.

Flake-free rules (async data loads late — a naive script passes only when the
backend happens to be fast):
- ASYNC DROPDOWN / AUTOCOMPLETE / SEARCHABLE COMBOBOX: after typing the query,
  the options load from the backend. NEVER click the option straight after
  \`.fill(...)\`. First wait for the specific option to appear, THEN click it:
  \`await expect(page.getByTitle('Andorra')).toBeVisible();\`
  \`await page.getByTitle('Andorra').click();\`
- NEVER use \`.first()\` / \`.last()\` to pick the target option — a stale option
  from a previous query can sit at that index. Match the option by its exact
  text/title so the locator resolves to the real one.
- After selecting, assert the value actually COMMITTED, not merely that the
  control is visible: \`await expect(control).toHaveValue('Andorra')\` (or
  \`toHaveText\`). \`toBeVisible()\` on the combobox is a dead assertion — it is
  true before and after selection.
- After navigation or a submit/search that reloads data, wait for the new state
  before asserting: \`await page.waitForURL(...)\` and/or
  \`await expect(resultLocator).toBeVisible()\`. Do not assert against a grid/list
  the instant you click Search — let the results render first.
- Assert with web-first, auto-retrying matchers (\`await expect(locator).toHaveText/
  toBeVisible/toHaveValue(...)\`). NEVER snapshot then compare
  (\`expect(await locator.textContent()).toBe(...)\`) — that reads once and cannot
  wait out backend latency.`;

/**
 * Scan a generated script for flakiness anti-patterns. Returns a corrective
 * message when any are found (to re-prompt the model), or null when clean.
 * Cheap line-based heuristics — catches the common leaks the prompt rules aim
 * to prevent, in case the model strays.
 */
export function lintScript(script: string): string | null {
  const lines = script.split('\n').map((l) => l.trim());
  const problems: string[] = [];

  // 1. Brittle option pick: .first()/.last() then click — resolves whatever is
  //    at that index, including a stale option from a previous query.
  if (lines.some((l) => /\.(first|last)\(\)\s*\.click\(/.test(l)))
    problems.push(
      'Do not use .first()/.last() to click a dropdown option — match the option by its exact text/title.',
    );

  // 2. Click straight after .fill(...) with no expect() between — races the
  //    backend that loads the options.
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/\.fill\(/.test(lines[i])) continue;
    const next = lines[i + 1];
    if (/\.click\(/.test(next) && !/expect\(/.test(next))
      problems.push(
        'After .fill(...) on a searchable control, wait for the option with `await expect(option).toBeVisible()` before clicking it.',
      );
  }

  // 3. Snapshot-then-compare — reads once, cannot wait out latency.
  if (lines.some((l) => /expect\(\s*await\s/.test(l)))
    problems.push(
      'Use web-first auto-retrying matchers (await expect(locator).toHaveText/toBeVisible/toHaveValue), never expect(await locator.textContent()).toBe(...).',
    );

  if (!problems.length) return null;
  return (
    'The script has flakiness issues:\n' +
    [...new Set(problems)].map((p) => `- ${p}`).join('\n') +
    '\nRewrite the FULL script fixing these. Output only the runnable statements, same format as before.'
  );
}

export function buildUserPrompt(tc: TestCaseForPrompt): string {
  const steps = (tc.steps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.position}. ${s.action} => expect: ${s.expectedResult}`)
    .join('\n');

  return [
    `Test case: ${tc.title}`,
    tc.preconditions ? `Preconditions: ${tc.preconditions}` : '',
    steps ? `Steps:\n${steps}` : '',
    tc.expectedResult ? `Overall expected result: ${tc.expectedResult}` : '',
    '',
    'Execute these steps live against the page, observe the real results, then produce the Playwright script.',
  ]
    .filter(Boolean)
    .join('\n');
}
