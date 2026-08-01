export function readDependencyError(codes: string[]): string | null {
  for (const code of codes) {
    const dot = code.lastIndexOf('.');
    const module = code.slice(0, dot);
    const action = code.slice(dot + 1);
    if (action !== 'read' && !codes.includes(`${module}.read`)) {
      return `Permission "${code}" requires "${module}.read"`;
    }
  }
  return null;
}
