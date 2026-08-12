import { chromium } from 'playwright';

/** Render an HTML string to a PDF buffer using the bundled Chromium. */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
