const { chromium } = require('playwright');

describe('Playwright Browser Tests', () => {
  let browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Should launch Chromium browser', async () => {
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
  });

  test('Should create a new page', async () => {
    const page = await browser.newPage();
    expect(page).toBeDefined();
    await page.close();
  });

  test('Should navigate to a page', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();
    expect(title).toBe('Example Domain');
    await page.close();
  });

  test('Should take a screenshot', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const screenshot = await page.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);
    await page.close();
  });
});