export function adminSessionDecision(
  session: { role: string } | null,
): 'allow' | 'unauthorized' | 'forbidden' {
  if (!session) return 'unauthorized';
  if (session.role !== 'admin') return 'forbidden';
  return 'allow';
}
