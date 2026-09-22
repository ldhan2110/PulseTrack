import React from 'react';
import { Card } from '@/components/ui/card';

/**
 * Shared shell for the auth screens (login / set-password / forgot-password):
 * gradient background with animated blurred bubbles in the logo palette, a
 * centered frosted Card, and the CareOne brand row. Bubble palette + keyframes
 * are local to the auth pages (not global CSS tokens) per the approved mockups.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="authx-root">
      <style>{authShellCss}</style>
      <div className="authx-bubbles" aria-hidden="true">
        <div className="authx-bubble authx-b1" />
        <div className="authx-bubble authx-b2" />
        <div className="authx-bubble authx-b3" />
        <div className="authx-bubble authx-b4" />
      </div>
      <Card className="authx-card">
        <div className="authx-brand">
          <img className="authx-logo" src="/images/logo.png" alt="CareOne" />
          <h1>CareOne</h1>
        </div>
        {children}
      </Card>
    </div>
  );
}

const authShellCss = `
.authx-root{
  --brand:#4b3ff0;--brand2:#9e93f5;--brand3:#170f49;
  position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:40px 16px;overflow:hidden;
  background:linear-gradient(160deg,oklch(0.98 0.01 250),oklch(0.96 0.02 300));
}
.authx-bubbles{position:fixed;inset:0;overflow:hidden;z-index:0;pointer-events:none}
.authx-bubble{position:absolute;border-radius:50%;filter:blur(48px);opacity:.5;animation:authx-float 18s ease-in-out infinite}
.authx-b1{width:420px;height:420px;background:var(--brand);top:-120px;left:-90px}
.authx-b2{width:360px;height:360px;background:var(--brand2);bottom:-110px;right:-80px;animation-delay:-6s}
.authx-b3{width:300px;height:300px;background:var(--brand3);top:40%;right:12%;animation-delay:-11s;opacity:.35}
.authx-b4{width:220px;height:220px;background:var(--brand2);bottom:18%;left:8%;animation-delay:-3s;opacity:.3}
@keyframes authx-float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-40px) scale(1.08)}66%{transform:translate(-25px,20px) scale(.95)}}
.authx-card{position:relative;z-index:1;width:404px;max-width:100%;gap:0;
  background:oklch(1 0 0 / .82);backdrop-filter:blur(12px);
  border:1px solid oklch(1 0 0 / .6);
  box-shadow:0 12px 40px -12px oklch(0.205 0.05 260 / .28);padding:30px}
.authx-brand{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.authx-logo{width:34px;height:34px;object-fit:contain;display:block}
.authx-brand h1{font-size:19px;font-weight:650;margin:0;letter-spacing:-.01em;color:var(--brand3)}
.dark .authx-card{background:oklch(0.205 0 0 / .82);border-color:oklch(1 0 0 / .12)}
.dark .authx-brand h1{color:oklch(0.985 0 0)}
`;
