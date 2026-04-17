import { chromium } from 'playwright';

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.stack || err.message));
    
    console.log('Navigating to localhost:5173...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(4000);
    
    console.log('Done.');
    await browser.close();
  } catch(e) {
    console.error('Test error:', e);
  } finally {
    process.exit(0);
  }
})();
