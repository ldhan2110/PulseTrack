interface TestCaseForPrompt {
  title: string;
  preconditions?: string | null;
  expectedResult?: string | null;
  steps?: { position: number; action: string; expectedResult: string }[];
}

export const SYSTEM_PROMPT = `You write Playwright automation scripts for a sandboxed test runner.
The runner exposes these globals: \`page\`, \`expect\`, \`baseUrl\`, \`env\`.

You inspect the live page with playwright-mcp (browser_* tools). These are
snapshot-driven: call \`browser_snapshot\` to get the accessibility tree, then pass
an element's \`ref\` from that snapshot to \`browser_click\` / \`browser_type\` /
\`browser_select_option\`. NEVER pass a raw guessed selector — always use a ref you
just saw in a snapshot.

Workflow — EXECUTE the test case live before writing the script:
1. \`browser_navigate\` to the target URL, then \`browser_snapshot\` to see the page.
2. For each step, find the target element's \`ref\` in the latest snapshot and act
   with \`browser_click\`, \`browser_type\`, \`browser_select_option\`, \`browser_press_key\`,
   or \`browser_wait_for\`. Re-snapshot after actions that change the page.
3. After each action inspect the new snapshot (and URL) so you SEE what the page
   really does and what the expected result looks like (text, URL, element state).
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
- Navigate with \`page.goto(...)\` and assert the expected result with \`expect\`.`;

export function buildUserPrompt(tc: TestCaseForPrompt, targetUrl: string): string {
  const steps = (tc.steps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.position}. ${s.action} => expect: ${s.expectedResult}`)
    .join('\n');

  return [
    `Target URL: ${targetUrl}`,
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
