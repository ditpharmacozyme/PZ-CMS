import { BrandConfig } from '../types';

/** "Nunito Sans 800" -> { family: "Nunito Sans", weight: 800 }. No trailing number = weight 400. */
function parseFontSpec(spec: string): { family: string; weight: number } {
  const parts = spec.trim().split(' ');
  const last = parts[parts.length - 1];
  const hasWeight = /^\d+$/.test(last);
  return {
    family: hasWeight ? parts.slice(0, -1).join(' ') : spec.trim(),
    weight: hasWeight ? parseInt(last, 10) : 400
  };
}

/**
 * Pushes a brand's display/headline/body fonts onto :root as CSS custom
 * properties, which index.css's .font-display-xl/.font-headline-md/
 * .font-body-md (and the base body tag) read with a Space Grotesk/Poppins
 * fallback. Call with null to reset to the fallback.
 */
export function applyBrandTypography(brand: BrandConfig | null): void {
  const root = document.documentElement.style;
  if (!brand) {
    ['--brand-font-display', '--brand-font-display-weight', '--brand-font-headline', '--brand-font-headline-weight', '--brand-font-body']
      .forEach((prop) => root.removeProperty(prop));
    return;
  }
  const display = parseFontSpec(brand.fonts.display);
  const headline = parseFontSpec(brand.fonts.headline);
  const body = parseFontSpec(brand.fonts.body);
  root.setProperty('--brand-font-display', `'${display.family}'`);
  root.setProperty('--brand-font-display-weight', String(display.weight));
  root.setProperty('--brand-font-headline', `'${headline.family}'`);
  root.setProperty('--brand-font-headline-weight', String(headline.weight));
  root.setProperty('--brand-font-body', `'${body.family}'`);
}
