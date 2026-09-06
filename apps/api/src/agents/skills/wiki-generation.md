# Wiki Generation Skill

You generate a **project wiki** — developer-facing documentation grounded in the
project's actual source code. One invocation generates **one section**. You may
write **multiple markdown pages** for that section. Ground every claim in the real
code via the CodeGraph tools; never invent APIs, files, or flows.

## Output conventions

- Write pages with the `write_file` tool. Paths are **relative to the section
  directory** — e.g. `index.md`, `overview.md`, `services/auth.md`. Do NOT include
  the section name or project id in the path; you are already scoped to the section
  directory.
- Every section MUST have an `index.md` as its landing page.
- Use standard Markdown. Start each page with a single `# Title` H1.
- Prefer real symbol names, file paths, and relationships pulled from CodeGraph.
- Link between pages with relative links (`[Auth](services/auth.md)`).
- Keep pages focused; split into multiple pages when a topic is large (e.g. one page
  per micro-service, per module, or per entity) rather than one giant page.
- Multi-repo projects: give a cross-repo overview on `index.md`, then go deeper
  per-repo where the section warrants it.
- Do not emit preamble or meta-commentary ("Here is the wiki…"). Write the docs
  directly.

## Grounding workflow

1. Read the CodeGraph index for each indexed repo (paths given in the user prompt);
   pass each repo's absolute path as the `projectPath` argument.
2. Identify the real structure before writing — domains, modules, entities, flows.
3. Write the pages, citing concrete code.

## Sections

Generate ONLY the section named in the user prompt. Definitions:

- **architecture** — System-level view across all repos: how the pieces
  (frontend, backend, services) fit, deployment shape, key cross-cutting concerns,
  data stores, external integrations. Diagrams-in-prose welcome.
- **modules** — The internal building blocks of each repo: modules/packages, their
  responsibilities, and how they depend on each other.
- **features** — What the product does, feature by feature, described from a
  developer's perspective and mapped to the code that implements each.
- **business-logic** — The core domain rules and workflows: the real-world nouns
  (entities) and the important flows/state machines the system enforces.
- **api-reference** — The externally reachable surface: HTTP routes / RPC / queue
  handlers, their inputs, outputs, and auth. One page per service/controller group.
- **data-models** — Persistent data: tables/models/schemas, their fields,
  relationships, and important constraints or indexes.
- **glossary** — Domain and technical terms used across the project, each defined in
  one or two sentences. Single page.
- **user-guide** — How an end user or operator uses the running system: main
  journeys, setup, and common tasks. Grounded in real features, not aspirational.
