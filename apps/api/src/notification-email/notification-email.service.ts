import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailData {
  entityTitle: string;
  summary: string;
  actorName: string;
  viewUrl: string;
  reason: string;
}

@Injectable()
export class NotificationEmailService {
  constructor(private readonly config: ConfigService) {}

  private logoImg(): string {
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    return `<span style="display:inline-block;background:#ffffff;border-radius:6px;padding:4px;margin-right:8px;vertical-align:middle;line-height:0"><img src="${appUrl}/images/logo.png" alt="CareOne" width="22" height="22" style="display:block"></span>`;
  }

  private footerLogo(): string {
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    return `<img src="${appUrl}/images/logo.png" alt="" width="16" height="16" style="vertical-align:middle;margin-right:6px">`;
  }

  renderSubject(entityTitle: string): string {
    return `[${entityTitle}]`;
  }

  renderInviteSubject(projectName: string): string {
    return projectName ? `You've been invited to ${projectName}` : `You've been invited to CareOne`;
  }

  renderAddedSubject(projectName: string): string {
    return projectName ? `You've been added to ${projectName}` : `You've been added to a project on CareOne`;
  }

  renderInviteHtml(data: { projectName: string; loginUrl: string }): string {
    const heading = data.projectName
      ? `You've been invited to <strong>${data.projectName}</strong>`
      : `You've been invited to CareOne`;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="background:#863bff;padding:16px 24px">
    ${this.logoImg()}<span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle">CareOne</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 24px;font-size:15px;color:#18181b;line-height:1.6">${heading}</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#863bff;border-radius:6px;padding:10px 24px">
      <a href="${data.loginUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Sign in to get started &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="border-top:1px solid #e4e4e7;padding:16px 24px">
    <p style="margin:0;font-size:12px;color:#a1a1aa">Sign in with your account to accept the invitation.</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:12px 24px;text-align:center;border-top:1px solid #e4e4e7">
    <span style="font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#170F49">${this.footerLogo()}CareOne</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  renderAddedHtml(data: { projectName: string; projectUrl: string }): string {
    const heading = data.projectName
      ? `You've been added to <strong>${data.projectName}</strong>`
      : `You've been added to a project on CareOne`;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="background:#863bff;padding:16px 24px">
    ${this.logoImg()}<span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle">CareOne</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 24px;font-size:15px;color:#18181b;line-height:1.6">${heading}</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#863bff;border-radius:6px;padding:10px 24px">
      <a href="${data.projectUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Open project &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#fafafa;padding:12px 24px;text-align:center;border-top:1px solid #e4e4e7">
    <span style="font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#170F49">${this.footerLogo()}CareOne</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  renderEmailHtml(data: EmailData): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="background:#863bff;padding:16px 24px">
    ${this.logoImg()}<span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle">${data.entityTitle}</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;line-height:1.6">
      <strong>${data.actorName}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#3f3f46;line-height:1.6">${data.summary}</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#863bff;border-radius:6px;padding:10px 24px">
      <a href="${data.viewUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">View in CareOne &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="border-top:1px solid #e4e4e7;padding:16px 24px">
    <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa">${data.reason}</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:12px 24px;text-align:center;border-top:1px solid #e4e4e7">
    <span style="font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#170F49">${this.footerLogo()}CareOne</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }
}
