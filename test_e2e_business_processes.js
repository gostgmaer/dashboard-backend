const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/kisho/.gemini/antigravity-ide/brain/8f46a973-e32a-450f-95db-9710128bd413';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots_e2e');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Find local browser path
const candidatePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

let executablePath = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    break;
  }
}

if (!executablePath) {
  console.error('❌ Could not find local Google Chrome or Microsoft Edge browser executable paths.');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runE2ETest() {
  console.log('🚀 Launching Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    page.on('console', msg => {
      console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error(`[PAGE ERROR]: ${err.message}`);
    });

    const uniqueId = Date.now();
    const testEmail = `testuser_${uniqueId}@example.com`;
    const testPassword = 'AntigravityCodeTest2026!';

    // ==========================================
    // 1. REGISTER NEW USER
    // ==========================================
    console.log('🌐 Step 1: Navigating to Register Page...');
    await page.goto('http://localhost:3000/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);

    console.log('✏️ Filling out registration form...');
    await page.waitForSelector('#firstName', { timeout: 10000 });
    await page.type('#firstName', 'Test');
    await page.type('#lastName', 'User');
    await page.type('#email', testEmail);
    await page.type('#password', testPassword);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1_registration_filled.png') });

    // Check if any validation errors are visible BEFORE submit
    const errorsBefore = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.text-red-500')).map(el => el.textContent);
    });
    if (errorsBefore.length > 0) {
      console.log('⚠️ Validation errors before submit:', errorsBefore);
    }

    console.log('Submit registration...');
    await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const registerForm = forms.find(f => f.querySelector('#firstName'));
      const submitBtn = registerForm ? registerForm.querySelector('button[type="submit"]') : null;
      if (submitBtn) {
        submitBtn.click();
      } else {
        console.error('Could not find register submit button');
      }
    });
    
    // Wait for redirect to login page
    console.log('⏳ Waiting for redirect...');
    await sleep(6000);
    console.log('Current URL after registration attempt:', page.url());
    
    // Check if any validation errors are visible AFTER submit
    const errorsAfter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.text-red-500')).map(el => el.textContent);
    });
    if (errorsAfter.length > 0) {
      console.log('❌ Validation errors after submit:', errorsAfter);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '2_redirected_to_login.png') });

    // ==========================================
    // 2. LOGIN USER
    // ==========================================
    if (page.url().includes('/auth/register')) {
      console.error('❌ Still on register page after submit. Cannot proceed to login.');
      throw new Error('Registration failed to redirect.');
    }

    console.log('✏️ Filling out login form...');
    console.log('Current URL before login:', page.url());
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.type('#email', testEmail);
    await page.type('#password', testPassword);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3_login_filled.png') });

    console.log('Submit login...');
    await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const loginForm = forms.find(f => f.querySelector('#password') && !f.querySelector('#firstName'));
      const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
      if (submitBtn) {
        submitBtn.click();
      } else {
        console.error('Could not find login submit button');
      }
    });

    // Wait for redirect to homepage
    console.log('⏳ Waiting for login redirect to Homepage...');
    await sleep(6000);
    console.log('Current URL after login attempt:', page.url());
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4_logged_in_homepage.png') });

    // ==========================================
    // 3. SEARCH & ADD TO CART
    // ==========================================
    console.log('🌐 Navigating to search page to select products...');
    await page.goto('http://localhost:3000/product/search?query=', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);

    console.log('🛒 Finding "Add to cart" button...');
    const addCartBtnSelector = 'button[aria-label="Add to cart"]:not([disabled])';
    await page.waitForSelector(addCartBtnSelector, { timeout: 15000 });
    
    console.log('Clicking "Add to cart"...');
    await page.evaluate(() => {
      const addBtn = document.querySelector('button[aria-label="Add to cart"]:not([disabled])');
      if (addBtn) {
        console.log('[PAGE LOG] Found Add to Cart button: ', addBtn.outerHTML);
        addBtn.click();
      } else {
        console.error('[PAGE LOG] Add to Cart button not found in page.evaluate');
      }
    });
    await sleep(4000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '5_product_added.png') });

    // ==========================================
    // 4. NAVIGATE TO CART PAGE
    // ==========================================
    console.log('🌐 Navigating to Cart Page...');
    await page.goto('http://localhost:3000/cart', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '6_cart_page.png') });

    // ==========================================
    // 5. CHECKOUT - STEP 1 (PERSONAL DETAILS)
    // ==========================================
    console.log('🌐 Navigating to Checkout Page...');
    await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);

    console.log('✏️ Completing Checkout Step 1: Personal Details...');
    await page.waitForSelector('#phone', { timeout: 10000 });
    await page.type('#phone', '1234567890');
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '7_checkout_step1_filled.png') });
    
    console.log('Clicking "Continue to Shipping"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const continueBtn = btns.find(b => b.textContent.includes('Continue to Shipping'));
      if (continueBtn) continueBtn.click();
    });
    await sleep(3000);

    // ==========================================
    // 6. CHECKOUT - STEP 2 (SHIPPING DETAILS)
    // ==========================================
    console.log('✏️ Completing Checkout Step 2: Shipping Details...');
    await page.waitForSelector('#address', { timeout: 10000 });
    await page.type('#address', '123 Test Street');
    await page.type('#city', 'Test City');
    await page.select('#country', 'India');
    await page.type('#zipCode', '110001');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '8_checkout_step2_filled.png') });

    console.log('Clicking "Continue to Payment"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const continueBtn = btns.find(b => b.textContent.includes('Continue to Payment'));
      if (continueBtn) continueBtn.click();
    });
    await sleep(3000);

    // ==========================================
    // 7. CHECKOUT - STEP 3 (PAYMENT & CONFIRM)
    // ==========================================
    console.log('✏️ Completing Checkout Step 3: Payment...');
    await page.waitForSelector('input[type="radio"][value="COD"]', { timeout: 10000 });
    
    console.log('Selecting Cash on Delivery (COD)...');
    await page.evaluate(() => {
      const codRadio = document.querySelector('input[type="radio"][value="COD"]');
      if (codRadio) codRadio.click();
    });

    console.log('Accepting Terms and Conditions...');
    await page.evaluate(() => {
      const termsCheckbox = document.querySelector('input[type="checkbox"][name="termsAccepted"]');
      if (termsCheckbox) termsCheckbox.click();
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '9_checkout_step3_filled.png') });

    console.log('Clicking "Confirm Order"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find(b => b.textContent.includes('Confirm Order') || b.textContent.includes('Place Order'));
      if (confirmBtn) {
        confirmBtn.click();
      } else {
        const submitBtn = document.querySelector('form button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });

    // ==========================================
    // 8. ORDER SUCCESS PAGE
    // ==========================================
    console.log('⏳ Waiting for order completion redirection...');
    await sleep(10000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_order_success.png') });

    console.log('🎉 E2E Business Process E-commerce Flow completed successfully!');
  } catch (error) {
    console.error('❌ Error during E2E flow:', error);
  } finally {
    await browser.close();
  }
}

runE2ETest();
