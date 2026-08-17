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
 * Pushes a brand's display/headline/body fonts onto :root as specimen custom
 * properties for Brand Kit previews, leaving the application UI uniformly crisp.
 */
export function applyBrandTypography(brand: BrandConfig | null): void {
  const root = document.documentElement.style;
  if (!brand) {
    ['--specimen-font-display', '--specimen-font-display-weight', '--specimen-font-headline', '--specimen-font-headline-weight', '--specimen-font-body']
      .forEach((prop) => root.removeProperty(prop));
    return;
  }
  const display = parseFontSpec(brand.fonts.display);
  const headline = parseFontSpec(brand.fonts.headline);
  const body = parseFontSpec(brand.fonts.body);
  root.setProperty('--specimen-font-display', `'${display.family}'`);
  root.setProperty('--specimen-font-display-weight', String(display.weight));
  root.setProperty('--specimen-font-headline', `'${headline.family}'`);
  root.setProperty('--specimen-font-headline-weight', String(headline.weight));
  root.setProperty('--specimen-font-body', `'${body.family}'`);
}
