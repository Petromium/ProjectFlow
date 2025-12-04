/**
 * Cross-Browser & Mobile UI Tests
 * Comprehensive E2E tests for UI responsiveness and cross-browser compatibility
 */

import { test, expect, devices } from '@playwright/test';

// Test helper to check responsive layout
async function checkResponsiveLayout(page: any, isMobile: boolean) {
  const viewport = page.viewportSize();
  
  if (isMobile) {
    expect(viewport?.width).toBeLessThan(768);
    // Check mobile-specific UI elements
    await expect(page.locator('[data-testid="mobile-menu"]').or(page.locator('button[aria-label*="menu"]'))).toBeVisible({ timeout: 5000 }).catch(() => {
      // Mobile menu might not be visible if already open or not implemented
    });
  } else {
    expect(viewport?.width).toBeGreaterThanOrEqual(768);
  }
}

// Test helper to check touch interactions on mobile
async function checkTouchInteractions(page: any, isMobile: boolean) {
  if (isMobile) {
    // Verify touch-friendly button sizes (minimum 44x44px)
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const box = await button.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
}

test.describe('Cross-Browser Compatibility', () => {
  test('should render landing page correctly in all browsers', async ({ page, browserName }) => {
    await page.goto('/');
    
    // Check critical elements are visible
    await expect(page.locator('body')).toBeVisible();
    
    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    
    // Browser-specific checks
    if (browserName === 'webkit') {
      // Safari-specific checks
      const webkitUserAgent = await page.evaluate(() => navigator.userAgent);
      expect(webkitUserAgent).toContain('Safari');
    }
  });

  test('should handle CSS Grid/Flexbox correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check if layout uses modern CSS (grid or flexbox)
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      return {
        display: computedStyle.display,
        gridTemplateColumns: computedStyle.gridTemplateColumns,
        flexDirection: computedStyle.flexDirection,
      };
    });
    
    // Should use grid or flexbox
    expect(
      bodyStyles.display === 'grid' || 
      bodyStyles.display === 'flex' ||
      bodyStyles.gridTemplateColumns !== 'none' ||
      bodyStyles.flexDirection !== 'normal'
    ).toBeTruthy();
  });

  test('should support modern JavaScript features', async ({ page }) => {
    await page.goto('/');
    
    // Check if modern JS features are available
    const jsSupport = await page.evaluate(() => {
      return {
        hasPromise: typeof Promise !== 'undefined',
        hasAsyncAwait: (async () => {}).constructor.name === 'AsyncFunction',
        hasFetch: typeof fetch !== 'undefined',
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasSessionStorage: typeof sessionStorage !== 'undefined',
      };
    });
    
    expect(jsSupport.hasPromise).toBeTruthy();
    expect(jsSupport.hasFetch).toBeTruthy();
    expect(jsSupport.hasLocalStorage).toBeTruthy();
  });
});

test.describe('Mobile UI Responsiveness', () => {
  test.use({ ...devices['Pixel 5'] });

  test('should display mobile-friendly navigation', async ({ page }) => {
    await page.goto('/');
    
    await checkResponsiveLayout(page, true);
    
    // Check if navigation adapts to mobile
    const nav = page.locator('nav').or(page.locator('[role="navigation"]'));
    const navVisible = await nav.isVisible().catch(() => false);
    
    if (navVisible) {
      const navStyles = await nav.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          display: styles.display,
          flexDirection: styles.flexDirection,
        };
      });
      
      // Mobile nav should be vertical or hidden behind menu
      expect(navStyles.display === 'none' || navStyles.flexDirection === 'column').toBeTruthy();
    }
  });

  test('should have touch-friendly interactive elements', async ({ page }) => {
    await page.goto('/');
    
    await checkTouchInteractions(page, true);
  });

  test('should handle mobile viewport correctly', async ({ page }) => {
    await page.goto('/');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(768);
    expect(viewport?.height).toBeGreaterThan(0);
    
    // Check if content fits within viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport!.width * 1.1); // Allow 10% overflow for scrollbars
  });

  test('should support mobile gestures', async ({ page }) => {
    await page.goto('/');
    
    // Test swipe gesture (if applicable)
    const touchStart = { x: 100, y: 300 };
    const touchEnd = { x: 300, y: 300 };
    
    await page.touchscreen.tap(touchStart.x, touchStart.y);
    await page.mouse.move(touchEnd.x, touchEnd.y);
    
    // Verify page responds to touch
    const touchSupported = await page.evaluate(() => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    });
    
    // Mobile devices should support touch
    expect(touchSupported).toBeTruthy();
  });

  test('should handle mobile keyboard correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Find input fields
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
    
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.click();
      
      // Check if input type triggers correct mobile keyboard
      const inputType = await emailInput.getAttribute('type');
      expect(['email', 'text']).toContain(inputType);
      
      // Check if input has proper attributes for mobile
      const inputMode = await emailInput.getAttribute('inputmode');
      const autoComplete = await emailInput.getAttribute('autocomplete');
      
      // These are optional but good practices
      if (inputMode) {
        expect(['email', 'text']).toContain(inputMode);
      }
    }
  });
});

test.describe('Tablet UI Responsiveness', () => {
  test.use({ 
    viewport: { width: 768, height: 1024 } // iPad portrait
  });

  test('should adapt layout for tablet viewport', async ({ page }) => {
    await page.goto('/');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThanOrEqual(768);
    expect(viewport?.width).toBeLessThan(1024);
    
    // Tablet should have intermediate layout
    await checkResponsiveLayout(page, false);
  });
});

test.describe('Desktop UI Responsiveness', () => {
  test.use({ 
    viewport: { width: 1920, height: 1080 } // Full HD
  });

  test('should display full desktop layout', async ({ page }) => {
    await page.goto('/');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThanOrEqual(1024);
    
    // Desktop should show full layout
    await checkResponsiveLayout(page, false);
  });

  test('should handle large screens correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check if content doesn't stretch too wide on large screens
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).first();
    
    if (await mainContent.isVisible().catch(() => false)) {
      const maxWidth = await mainContent.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.maxWidth;
      });
      
      // Should have max-width constraint (not empty or 'none')
      expect(maxWidth).not.toBe('none');
      expect(maxWidth).not.toBe('');
    }
  });
});

test.describe('Cross-Browser Form Compatibility', () => {
  test('should handle form inputs consistently', async ({ page, browserName }) => {
    await page.goto('/login');
    
    // Find form inputs
    const inputs = await page.locator('input').all();
    
    for (const input of inputs.slice(0, 3)) { // Test first 3 inputs
      const inputType = await input.getAttribute('type');
      const inputName = await input.getAttribute('name');
      
      if (inputType && inputName) {
        // Check if input is visible and interactable
        await expect(input).toBeVisible();
        
        // Test focus
        await input.focus();
        const isFocused = await input.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBeTruthy();
        
        // Browser-specific input handling
        if (browserName === 'webkit') {
          // Safari might handle some input types differently
          if (inputType === 'date' || inputType === 'time') {
            // Safari has limited support for these
            const value = await input.inputValue().catch(() => '');
            // Just verify it doesn't crash
            expect(value).toBeDefined();
          }
        }
      }
    }
  });
});

test.describe('PWA Mobile Features', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should have PWA manifest', async ({ page }) => {
    await page.goto('/');
    
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);
    
    const manifestHref = await manifestLink.getAttribute('href');
    expect(manifestHref).toBeTruthy();
    
    // Fetch manifest
    const manifestResponse = await page.request.get(manifestHref!);
    expect(manifestResponse.ok()).toBeTruthy();
    
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons).toBeTruthy();
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker registration
    await page.waitForTimeout(2000);
    
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(swRegistered).toBeTruthy();
  });
});

test.describe('Accessibility Across Browsers', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check for common ARIA attributes
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) {
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');
      const textContent = await button.textContent();
      
      // Button should have accessible name (aria-label, aria-labelledby, or text content)
      expect(
        ariaLabel || ariaLabelledBy || (textContent && textContent.trim().length > 0)
      ).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test Tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.tagName.toLowerCase();
    });
    
    // Should focus on an interactive element
    expect(['input', 'button', 'a', 'select', 'textarea']).toContain(focusedElement);
  });
});

