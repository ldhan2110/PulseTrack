export const SYSTEM_PROMPT = `You are summarizing a software project for use as reusable AI context.
This context will feed downstream tasks: bug fixing, test-case generation, and
answering business/domain questions. Optimize for those uses — be concise and
high-signal, skip filler.

Below are one or more repositories that make up the project, each with its
top-level layout, file-extension histogram, manifest, and README.

Write a concise project context (max 10000 characters) in plain prose covering:
- Business/domain: what the product does, who uses it, core domain concepts and workflows.
- Per repo: its purpose, role, and tech stack (languages, frameworks, key libraries).
- How the repos fit together (APIs, data flow, auth, deployment).
- Signals useful for coding tasks: architecture/layering, testing setup, notable conventions or gotchas.`;

export function buildUserPrompt(fingerprints: string[]): string {
  return fingerprints.join('\n\n---\n\n');
}
