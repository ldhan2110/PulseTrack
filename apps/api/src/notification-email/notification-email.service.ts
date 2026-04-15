import { Injectable } from '@nestjs/common';

interface EmailData {
  entityTitle: string;
  summary: string;
  actorName: string;
  viewUrl: string;
  reason: string;
}

@Injectable()
export class NotificationEmailService {
  renderSubject(entityTitle: string): string {
    return `[${entityTitle}]`;
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
    <span style="color:#ffffff;font-size:18px;font-weight:700">${data.entityTitle}</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;line-height:1.6">
      <strong>${data.actorName}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#3f3f46;line-height:1.6">${data.summary}</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#863bff;border-radius:6px;padding:10px 24px">
      <a href="${data.viewUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">View in PulseTrack &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="border-top:1px solid #e4e4e7;padding:16px 24px">
    <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa">${data.reason}</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:12px 24px;text-align:center;border-top:1px solid #e4e4e7">
    <span style="font-size:14px;font-weight:700;color:#863bff">&#9679; PulseTrack</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }
}
