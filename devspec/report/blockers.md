
## add-project-chat — section 6 verify (blocked 2026-09-17T03:58:13Z)
**Section:** 6. Chat drawer UI — `Verify: /devspec-verify add-project-chat`
**Reason:** app not running. agent-browser UI verify needs a live app at http://localhost:5173 (web) + http://localhost:3000 (api); both are down. Auth is Keycloak SSO and no test account exists in `devspec/improve/testing.md`, so even with the stack up the automated login can't proceed unattended.
**State of the work:** all section-6 components built (ChatDrawer, ConversationList, MessageThread, Composer, NewDmPicker), mounted in ProjectLayout header. `tsc` clean, `pnpm --filter @pm/web build` passes. Only the browser-driven visual verify is unrun.
**To resume:** start api + web, add `devspec/improve/testing.md` with a Keycloak test account + running URL, reset board `status: blocked → pending`, re-run `/devspec-verify add-project-chat`.
