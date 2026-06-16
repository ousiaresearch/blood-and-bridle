// CSS-only horse silhouettes by life stage. Each is a small inline SVG
// encoded as a data URL, ready to be dropped into a CSS background-image
// or a --silhouette custom property.
//
// Goal: each silhouette should be recognizable as a horse in a particular
// stage of life, in a single ink color, roughly 200x80 viewbox.

const SILHOUETTES = {
  // Foal — short legs, big head, gangly
  foal: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" fill="currentColor">
  <path d="M30 50 Q20 45 22 38 Q24 30 30 32 L34 28 Q38 24 44 26 L48 22 L52 26 L62 25 Q70 22 78 26 L84 22 L90 28 L102 28 Q108 24 114 28 L120 24 L128 30 Q140 32 150 36 L156 32 L162 38 L170 40 L176 44 L172 50 L168 48 L162 52 L156 48 L150 52 L142 50 L130 52 L120 50 L108 54 L96 52 L84 56 L72 54 L60 58 L48 56 L38 58 L30 56 Z" />
  <circle cx="48" cy="22" r="2" />
  <path d="M52 22 L56 18 L60 22 L58 24 Z" />
</svg>
`)}`,
  // Yearling — small, still growing
  yearling: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" fill="currentColor">
  <path d="M28 52 Q18 46 22 40 L26 34 Q32 30 38 32 L42 28 L48 24 L54 28 L66 26 Q76 22 86 26 L92 22 L100 26 L114 24 Q124 22 134 26 L140 22 L148 28 L162 30 Q172 32 178 38 L180 44 L176 48 L168 46 L162 52 L154 48 L146 52 L138 48 L126 52 L114 50 L100 54 L86 52 L72 56 L60 54 L48 58 L38 56 L30 56 Z" />
  <ellipse cx="46" cy="22" rx="3" ry="4" />
  <path d="M50 18 L56 14 L60 20 L56 22 Z" />
</svg>
`)}`,
  // Prospect — adolescent, taller, more defined
  prospect: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 90" fill="currentColor">
  <path d="M20 60 Q10 50 14 42 L18 36 Q24 30 32 34 L36 28 L42 22 L48 26 L56 22 L66 24 Q78 18 92 22 L98 16 L108 22 L122 18 Q134 16 146 22 L152 16 L162 24 L176 26 Q188 30 196 38 L200 46 L196 52 L188 48 L182 56 L172 50 L162 56 L152 50 L140 58 L128 52 L116 60 L100 56 L84 64 L68 60 L52 66 L40 62 L28 66 L20 62 Z" />
  <ellipse cx="42" cy="20" rx="4" ry="6" />
  <path d="M48 14 L56 8 L62 18 L56 22 Z" />
  <path d="M62 18 L66 26 L70 18 L66 14 Z" />
</svg>
`)}`,
  // Campaigner — full adult, powerful
  campaigner: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100" fill="currentColor">
  <path d="M14 70 Q4 58 10 48 L16 40 Q24 32 34 36 L38 30 L46 22 L54 26 L62 22 L72 24 Q86 16 100 22 L108 14 L120 22 L134 18 Q148 14 162 22 L170 14 L182 24 L196 26 Q210 30 220 40 L226 48 L222 56 L212 52 L206 60 L194 54 L184 62 L172 56 L160 64 L146 58 L132 66 L116 60 L100 70 L84 64 L68 72 L52 66 L40 72 L26 68 L18 72 L14 68 Z" />
  <ellipse cx="40" cy="20" rx="5" ry="8" />
  <path d="M48 12 L58 4 L66 16 L58 22 Z" />
  <path d="M66 16 L72 28 L78 16 L72 10 Z" />
  <path d="M204 12 L214 4 L222 16 L214 22 Z" />
  <path d="M200 60 L194 76 L200 78 L206 62 Z" />
</svg>
`)}`,
  // Retiree — full adult but with head down, calm
  retiree: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100" fill="currentColor">
  <path d="M14 70 Q4 58 10 48 L16 40 Q24 32 34 36 L38 30 L46 22 L54 26 L62 22 L72 24 Q86 16 100 22 L108 14 L120 22 L134 18 Q148 14 162 22 L170 14 L182 24 L196 26 Q210 30 220 40 L226 48 L222 56 L212 52 L206 60 L194 54 L184 62 L172 56 L160 64 L146 58 L132 66 L116 60 L100 70 L84 64 L68 72 L52 66 L40 72 L26 68 L18 72 L14 68 Z" />
  <ellipse cx="42" cy="32" rx="5" ry="7" />
  <path d="M48 36 L42 50 L48 52 L54 38 Z" />
  <path d="M54 38 L66 38 L70 44 L60 46 Z" />
</svg>
`)}`,
  // Dead — silhouette only
  dead: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100" fill="currentColor">
  <line x1="20" y1="20" x2="220" y2="80" stroke="currentColor" stroke-width="4" />
  <line x1="20" y1="80" x2="220" y2="20" stroke="currentColor" stroke-width="4" />
</svg>
`)}`,
};

export function silhouetteFor(stageId) {
  if (!stageId) return SILHOUETTES.campaigner;
  return SILHOUETTES[stageId] || SILHOUETTES.campaigner;
}

// Temperament → ribbon tone. Hot (orange), Warm (gold), Cool (blue).
export function ribbonFor(temperament) {
  if (!temperament) return 'warm';
  const t = temperament.toLowerCase();
  if (t.includes('hot') || t.includes('fierce') || t.includes('explosive') || t.includes('dominant')) return 'hot';
  if (t.includes('cold') || t.includes('suspicious') || t.includes('aloof') || t.includes('curious') || t.includes('clever')) return 'cool';
  return 'warm';
}

export const __INTERNAL__ = { SILHOUETTES };
