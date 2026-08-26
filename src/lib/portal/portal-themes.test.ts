import { describe, expect, it } from 'vitest';
import {
  BAXTER_SERVICENOW_PALETTE,
  buildPortalThemeStructuralCss,
  buildPortalThemeStyle,
  defaultPortalThemeConfig,
} from './portal-themes';

describe('Baxter portal chrome colors', () => {
  it('uses the same navy for header and footer', () => {
    expect(BAXTER_SERVICENOW_PALETTE.headerBg).toBe('#003399');
    const css = buildPortalThemeStyle(defaultPortalThemeConfig('baxter-servicenow'));
    expect(css).toContain('--portal-header-bg: #003399');
    expect(css).toContain('.portal-theme-header');
    expect(css).toContain('.portal-theme-footer');
    expect(css).toContain('background: var(--portal-header-bg)');
  });

  it('keeps AppTopbar transparent so navy is not washed into gray', () => {
    const css = buildPortalThemeStructuralCss('baxter-servicenow');
    expect(css).toContain('.portal-theme-header > div');
    expect(css).toContain('background: transparent !important');
    expect(css).toContain('backdrop-filter: none !important');
  });

  it('maps primary actions to Baxter request blue, not teal', () => {
    expect(BAXTER_SERVICENOW_PALETTE.actionBg).toBe('#3e67b9');
    const css = buildPortalThemeStructuralCss('baxter-servicenow');
    expect(css).toContain('.portal-theme-btn-primary');
    expect(css).toContain('color: var(--portal-action-bg)');
    expect(css).not.toMatch(/\.text-primary \{\s*color: var\(--portal-accent\)/);
  });
});
