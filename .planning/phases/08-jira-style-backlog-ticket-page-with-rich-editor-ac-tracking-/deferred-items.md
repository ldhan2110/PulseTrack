# Deferred Items

## Pre-existing Build Errors (out of scope)

These errors existed before Plan 08-04 work began and are not caused by any changes in this plan.

1. `apps/web/src/components/members/AddMemberDialog.tsx:155` — `Property 'name' does not exist on type 'UserSearchResult'`
2. `apps/web/src/pages/BugsPage.tsx:26` — Role comparison uses uppercase strings (`'PM'`, `'BA'`, `'QC'`) but `ProjectRole` type uses lowercase (`'pm'`, `'ba'`, `'qc'`)

These should be fixed in a separate plan or quick task.
