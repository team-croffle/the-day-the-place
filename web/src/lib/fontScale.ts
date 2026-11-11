const STEPS = [100, 112.5, 125] as const;
const KEY = 'dayplace-font-step';

export type FontStep = (typeof STEPS)[number];

export function fontSteps(): readonly FontStep[] {
  return STEPS;
}

export function currentFontStep(): FontStep {
  if (typeof localStorage === 'undefined') return 100;
  const raw = Number(localStorage.getItem(KEY));
  return STEPS.find((step) => step === raw) ?? 100;
}

export function applyFontStep(step: FontStep): void {
  document.documentElement.style.fontSize = `${step}%`;
  localStorage.setItem(KEY, String(step));
}

export function applyStoredFontStep(): void {
  applyFontStep(currentFontStep());
}
