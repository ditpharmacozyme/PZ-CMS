import { BrandConfig, BrandId, SpecConfig, SpecType } from '../types';

export const BRANDS: Record<BrandId, BrandConfig> = {
  pharmacozyme: {
    id: 'pharmacozyme',
    name: 'Pharmacozyme',
    shortCode: 'P_ZYME',
    tagline: 'Precision Enzymatic Therapeutics',
    primaryColor: '#78D24B',
    secondaryColor: '#00694B',
    accentColor: '#96B44B',
    surfaceColor: '#F5FAF2',
    icon: 'science',
    logoUrl: '/logos/PZ_Logo.png',
    description: 'Advanced enzyme-based therapeutics and pharmaceutical solutions for metabolic health.',
    voiceRules: [
      'Clinical, precise, and authoritative with a humanist touch.',
      'Use data-driven statements and verified clinical terminology.',
      'Avoid generic marketing buzzwords or unsubstantiated claims.'
    ],
    fonts: {
      display: 'Nunito Sans 800',
      headline: 'Nunito Sans 700',
      code: 'Space Mono 400',
      body: 'Poppins 400'
    }
  },
  'pz-academy': {
    id: 'pz-academy',
    name: 'PZ Academy',
    shortCode: 'PZ_ACAD',
    tagline: 'Molecular & Bio-Tech Education',
    primaryColor: '#7ED957',
    secondaryColor: '#0F3D22',
    accentColor: '#C9960A',
    surfaceColor: '#F7FAF5',
    icon: 'school',
    logoUrl: '/logos/PZ-Academy-logo.png',
    description: 'Educational platform for molecular biology, bio-tech integration, and clinical research deep-dives.',
    voiceRules: [
      'Educational, engaging, and structured for research clarity.',
      'Explain complex molecular mechanisms in scannable, modular sections.',
      'Maintain academic rigor while staying accessible to clinicians.'
    ],
    fonts: {
      display: 'Montserrat 800',
      headline: 'Montserrat 700',
      code: 'Space Mono 400',
      body: 'Poppins 400'
    }
  },
  'med-q': {
    id: 'med-q',
    name: 'MED-Q',
    shortCode: 'MED_Q',
    tagline: 'Diagnostic & Oncology Units',
    primaryColor: '#5E17EB',
    secondaryColor: '#1E0754',
    accentColor: '#FF66C4',
    surfaceColor: '#F8F5FF',
    icon: 'medication',
    logoUrl: '/logos/MED-Q Logo.png',
    description: 'Weekly diagnostic challenges, oncology protocol alerts, and high-precision clinical deployment.',
    voiceRules: [
      'Diagnostic, direct, and action-oriented for unit teams.',
      'Highlight urgent protocol updates with bold stamp badges.',
      'Clear, unambiguous instructions for dosage & compliance.'
    ],
    fonts: {
      display: 'New Amsterdam',
      headline: 'New Amsterdam',
      code: 'Space Mono 400',
      body: 'Poppins 400'
    }
  },
  pillz: {
    id: 'pillz',
    name: 'PillZ',
    shortCode: 'PILLZ',
    tagline: 'High-Density Packaging & Flux',
    primaryColor: '#07513B',
    secondaryColor: '#93D4B7',
    accentColor: '#2E6E56',
    surfaceColor: '#FAF9F5',
    icon: 'package_2',
    logoUrl: '/logos/PillZ.png',
    description: 'Modern patient medication tracking, batch release validation, and dosage layout solutions.',
    voiceRules: [
      'Patient-centric, vivid, and reassuringly clear.',
      'Focus on compliance tracking and batch accuracy numbers.',
      'Use clean tabular layouts and visual progress indicators.'
    ],
    fonts: {
      display: 'Space Grotesk 700',
      headline: 'Space Grotesk 600',
      code: 'Space Mono 400',
      body: 'Nunito Sans 400'
    }
  },
  prescriptionz: {
    id: 'prescriptionz',
    name: 'PrescriptionZ',
    shortCode: 'RX_Z',
    tagline: 'V3.4 Engine & Operational Sync',
    primaryColor: '#30312E',
    secondaryColor: '#707A67',
    accentColor: '#1B1C1A',
    surfaceColor: '#FAF9F5',
    icon: 'receipt_long',
    logoUrl: '/logos/PrescriptionZ Logo.png',
    description: 'Core engine synchronization, prescription logistics, and global node health tracking.',
    voiceRules: [
      'Technical, system-level, and operational.',
      'Include node status, version codes (v3.4), and latency telemetry.',
      'Emphasis on 99.98% operational integrity and security.'
    ],
    fonts: {
      display: 'Space Grotesk 700',
      headline: 'Space Grotesk 600',
      code: 'Space Mono 400',
      body: 'Nunito Sans 400'
    }
  }
};

export const SPECS: Record<SpecType, SpecConfig> = {
  'feed-post': {
    id: 'feed-post',
    name: 'Instagram Feed Post',
    dimensions: '1080 x 1080 px',
    aspectRatio: '1:1',
    description: 'Standard square layout optimized for grid posts.'
  },
  story: {
    id: 'story',
    name: 'Instagram Story / Reel Cover',
    dimensions: '1080 x 1920 px',
    aspectRatio: '9:16',
    description: 'Vertical full-screen layout for mobile stories.'
  },
  reel: {
    id: 'reel',
    name: 'Instagram Reel Video / Motion',
    dimensions: '1080 x 1920 px',
    aspectRatio: '9:16',
    description: 'Short video snippet or animated motion asset.'
  },
  carousel: {
    id: 'carousel',
    name: 'Multi-slide Carousel',
    dimensions: '1080 x 1350 px',
    aspectRatio: '4:5',
    description: 'High-density multi-slide infographic or report.'
  },
  newsletter: {
    id: 'newsletter',
    name: 'Email Newsletter Banner',
    dimensions: '1200 x 630 px',
    aspectRatio: '1.91:1',
    description: 'Editorial landscape banner for subscriber broadcasts.'
  },
  'bio-report': {
    id: 'bio-report',
    name: 'Clinical Bio-Report Sheet',
    dimensions: '2480 x 3508 px (A4)',
    aspectRatio: '1:1.41',
    description: 'High-resolution PDF publication template for medical review.'
  }
};

/**
 * The compiled-in defaults. `BRANDS` is being migrated to the runtime
 * `useBrands()` context (see src/context/BrandsContext.tsx); this alias is the
 * synchronous seed + per-field fallback and is the name that survives once the
 * migration is done.
 */
export const SEED_BRANDS = BRANDS;
