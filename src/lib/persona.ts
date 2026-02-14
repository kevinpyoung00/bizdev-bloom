// Persona auto-detection from title with manual override support

export type PersonaTrack = 'HR' | 'CFO' | 'CEO' | 'Ops' | 'Recruiting' | 'ExecGeneral';

export const PERSONA_LABELS: Record<PersonaTrack, string> = {
  HR: 'HR / Benefits',
  CFO: 'CFO / Finance',
  CEO: 'CEO / Founder',
  Ops: 'Operations',
  Recruiting: 'Recruiting / TA',
  ExecGeneral: 'Executive (General)',
};

export function detectPersona(title?: string | null): PersonaTrack {
  if (!title) return 'ExecGeneral';
  const t = title.toLowerCase();

  // HR / People / Benefits / Talent (not Talent Acquisition)
  if (/\b(hr|human\s*resources?|people|benefits|total\s*rewards|hris)\b/.test(t) && !/\b(talent\s*acquisition|recruiter|recruiting)\b/.test(t)) return 'HR';
  
  // CFO / Finance
  if (/\b(cfo|chief\s*financial|finance|controller|comptroller|treasurer|accounting)\b/.test(t)) return 'CFO';
  
  // CEO / Founder / President
  if (/\b(ceo|chief\s*executive|founder|co-founder|president|owner|managing\s*partner)\b/.test(t)) return 'CEO';
  
  // COO / Operations
  if (/\b(coo|chief\s*operating|operations|ops\b)\b/.test(t)) return 'Ops';
  
  // Recruiting / Talent Acquisition
  if (/\b(recruiter|recruiting|talent\s*acquisition)\b/.test(t)) return 'Recruiting';
  
  return 'ExecGeneral';
}
