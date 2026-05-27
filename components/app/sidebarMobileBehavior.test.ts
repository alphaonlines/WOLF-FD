import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appSource = () => readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

describe('FD sidebar mobile behavior guards', () => {
  it('keeps hover expansion desktop-only while mobile uses tap state', () => {
    const source = appSource();

    expect(source).toContain("window.matchMedia('(min-width: 1024px)')");
    expect(source).toContain('openSidebarForDesktopHover');
    expect(source).toContain('collapseSidebarForDesktopHover');
    expect(source).toContain('onClick={toggleSidebarFromButton}');
    expect(source).toContain('window.innerWidth < 1024');
  });

  it('locks and overlays the mobile workspace while the module menu is open', () => {
    const source = appSource();

    expect(source).toContain("window.matchMedia('(max-width: 1023px)')");
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('bg-slate-950/72 backdrop-blur-md lg:hidden');
    expect(source).toContain("data-main-menu-dimmed={sidebarOpen ? 'true' : 'false'}");
    expect(source).toContain('blur-[1.5px] brightness-50');
  });

  it('labels the mobile sidebar controls for reliable tap and accessibility behavior', () => {
    const source = appSource();

    expect(source).toContain('id="fd-sidebar-menu"');
    expect(source).toContain('aria-label="Module navigation"');
    expect(source).toContain('aria-controls="fd-sidebar-menu"');
    expect(source).toContain('aria-expanded={sidebarOpen}');
    expect(source).toContain("aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}");
  });
});
