export interface SafetyResult {
  allowed: boolean;
  reason?: string;
}

const MINOR_PATTERNS = [
  /\bminor\b/i,
  /\bunder[ -]?age\b/i,
  /\bchild(?:ren)?\b/i,
  /\bkid(?:s)?\b/i,
  /\bschool[ -]?(?:girl|boy)s?\b/i,
  /\byoung (?:girl|boy)s?\b/i,
  /\bloli\b/i,
  /\bshota\b/i,
];

const EXPLICIT_PATTERNS = [
  /\bnud(?:e|ity)\b/i,
  /\bporn(?:ography|ographic)?\b/i,
  /\bxxx\b/i,
  /\bexplicit\b/i,
  /\bsexual(?:ly)?\b/i,
  /\berotic\b/i,
  /\bfetish\b/i,
  /\bgenitals?\b/i,
  /\bbreasts?\b/i,
  /\bnipples?\b/i,
  /\bnsfw\b/i,
];

const EXPLOITATION_PATTERNS = [
  /\bchild (?:porn|pornography)\b/i,
  /\bcsam\b/i,
  /\bnon[ -]?consensual (?:sex|sexual|nude|intimate)\b/i,
  /\bsexual assault (?:scene|image|video|fantasy)\b/i,
  /\brape (?:scene|image|video|fantasy|roleplay)\b/i,
  /\bbestiality\b/i,
];

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some(pattern => pattern.test(text));
}

export function checkPromptSafety(text: string, safetyEnabled: boolean): SafetyResult {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim();

  if (matchesAny(normalized, EXPLOITATION_PATTERNS)) {
    return {
      allowed: false,
      reason: 'This request is blocked because it appears to seek exploitative or non-consensual sexual content.',
    };
  }

  if (matchesAny(normalized, MINOR_PATTERNS) && matchesAny(normalized, EXPLICIT_PATTERNS)) {
    return {
      allowed: false,
      reason: 'Sexual content involving minors or young-looking subjects is always blocked.',
    };
  }

  if (safetyEnabled && matchesAny(normalized, EXPLICIT_PATTERNS)) {
    return {
      allowed: false,
      reason: '18+ safety is on. It can be disabled only for lawful, consensual, adult-only local workflows.',
    };
  }

  return { allowed: true };
}

export const SAFETY_SYSTEM_PROMPT = [
  'Follow the user request when it is lawful and safe.',
  'Refuse sexual content involving minors, non-consensual sexual content, exploitation, and instructions that facilitate serious harm or illegal access.',
  'For requests about safety, prevention, recovery, or reporting, provide supportive high-level information without graphic detail.',
].join(' ');