# Tasks: external-profile

## 1. Reusable auth helpers + sanitizer [req-3][req-4]
- [x] 1.1 [backend] Export `AuthService` from `apps/api/src/auth/auth.module.ts` (`exports: [AuthService]`) so `UsersModule` can inject it
- [x] 1.2 [backend] Import `AuthModule` into `apps/api/src/users/users.module.ts`
- [x] 1.3 [service] Add `sanitizeUser(user)` to `UsersService` (`users.service.ts`) — strip `passwordHash`, `pwResetTokenHash`, `pwResetTokenExp`
Verify: `pnpm --filter @pm/api build`

## 2. Update own name [req-1]
- [x] 2.1 [backend] Add `UpdateProfileDto` (`apps/api/src/users/dto/update-profile.dto.ts`) — `name: string`, `@IsNotEmpty` + `@MaxLength(100)` + `@Transform` trim
- [x] 2.2 [service] `UsersService.updateOwnProfile(userId, dto)` — load user, throw `ForbiddenException` if `userType !== 'EXTERNAL'`, `prisma.user.update` name, return `sanitizeUser`
- [x] 2.3 [backend] `PATCH /users/me` in `users.controller.ts` (class-level `@UseGuards(JwtAuthGuard)`) → `updateOwnProfile(req.user.id, dto)`
- [x] 2.4 [test] `apps/api/src/users/users.service.spec.ts`: external updates name → persisted+sanitized; internal → Forbidden; blank name DTO → 400 (validation)
Verify: `pnpm --filter @pm/api test -- users`

## 3. Update own avatar [req-2]
- [x] 3.1 [backend] `POST /users/me/avatar` in `users.controller.ts` — reuse the `FileInterceptor('file')` + `diskStorage` config from `projects.controller.ts:126` verbatim (dest `uploads/avatars`, `randomUUID()+extname`, 2 MB `limits`, image-only `fileFilter`)
- [x] 3.2 [service] `UsersService.updateOwnAvatar(userId, avatarUrl)` — Forbidden if not EXTERNAL, set `imageUrl = /api/uploads/avatars/<file>`, return `sanitizeUser`
- [x] 3.3 [test] `users.service.spec.ts`: external sets imageUrl → persisted; internal → Forbidden. Controller filter rejects non-image (assert `fileFilter` callback)
Verify: `pnpm --filter @pm/api test -- users`

## 4. Change own password [req-3]
- [x] 4.1 [backend] `ChangePasswordDto` (`apps/api/src/users/dto/change-password.dto.ts`) — `currentPassword: string`, `newPassword: string` `@MinLength(8)`
- [x] 4.2 [service] `UsersService.changeOwnPassword(userId, dto)` — Forbidden if not EXTERNAL; `AuthService.verifyPassword(user.passwordHash, currentPassword)` false → `UnauthorizedException`; else `passwordHash = AuthService.hashPassword(newPassword)`, update
- [x] 4.3 [backend] `PATCH /users/me/password` in `users.controller.ts` → `changeOwnPassword(req.user.id, dto)`
- [x] 4.4 [test] `users.service.spec.ts`: correct current → hash replaced; wrong current → 401 + hash unchanged; short new → 400; internal → Forbidden
Verify: `pnpm --filter @pm/api test -- users`

## 5. Sanitize existing /users/me [req-4]
- [x] 5.1 [backend] `getMe` (`users.controller.ts:16`) returns `sanitizeUser(req.user)` instead of raw `req.user`
- [x] 5.2 [test] `users.controller.spec.ts` (or service): `/users/me` result has no `passwordHash`/`pwResetTokenHash`/`pwResetTokenExp`
Verify: `pnpm --filter @pm/api test -- users`

## 6. Web API client + auth context seam [req-5][req-6]
- [x] 6.1 [frontend] Add to `apps/web/src/lib/api.ts`: `updateProfile({name})` → `PATCH /users/me`; `uploadOwnAvatar(file)` → `POST /users/me/avatar` (FormData); `changeOwnPassword({currentPassword,newPassword})` → `PATCH /users/me/password`
- [x] 6.2 [frontend] Expose `setUser` on `AuthContextValue` (`apps/web/src/auth/AuthProvider.tsx:20`) and include it in the context `value`
- [x] 6.3 [frontend] Ensure `UserProfile` type (`apps/web/src/lib/types.ts`) includes `userType` and `imageUrl`
Verify: `pnpm --filter @pm/web build`

## 7. Profile modal [req-5]
- [x] 7.1 [frontend] New `apps/web/src/components/profile/ProfileModal.tsx` — reuse `<Dialog>`/`<DialogContent>`/`<DialogHeader>`/`<DialogTitle>`/`<DialogDescription>`/`<DialogFooter>` (`components/ui/dialog.tsx`), `<Avatar>`/`<AvatarImage>`/`<AvatarFallback>` (`ui/avatar.tsx`), `<Input>` (`ui/input.tsx`), `<Label>` (`ui/label.tsx`), `<Button>` (`ui/button.tsx`). Build to `mockups/profile-modal.html`
- [x] 7.2 [frontend] Branch on `user.userType`: EXTERNAL → editable name + avatar upload + change-password section + disabled email; INTERNAL → all disabled, "Managed by SSO" note, no password section, Close-only footer
- [x] 7.3 [frontend] On Save (EXTERNAL): if new file → `uploadOwnAvatar`; if name changed → `updateProfile`; if all 3 password fields filled → `changeOwnPassword`. Sequential, stop + show error alert on first failure. Confirm-password mismatch blocks submit client-side. States: default/saving(disabled+spinner)/error per `ui.md`
- [x] 7.4 [frontend] On success → `setUser(refreshedUser)` from the endpoint response, close modal
Verify: `pnpm --filter @pm/web build`

## 8. Sidebar trigger + avatar fallback [req-5][req-6]
- [x] 8.1 [frontend] Add a "Profile" item to the `AppSidebar` footer (`components/layout/AppSidebar.tsx` ~line 389, beside Logout) that opens `<ProfileModal>`
- [x] 8.2 [frontend] Fix footer avatar source (`AppSidebar.tsx:121`): `keycloakUserInfo?.imgUrl ?? user?.imageUrl` so an external uploaded avatar renders
Verify: `/devspec-verify external-profile` (agent-browser: sidebar Profile opens modal; external → editable regions + non-plain shadcn dialog styling; saving/error states; internal → read-only "Managed by SSO"; saved name/avatar reflects in sidebar)
