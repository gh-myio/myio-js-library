// engines/DeviceClassifier.ts
export const classifyDevice = (label: string = ''): 'substation'|'meter'|'chiller'|'pump'|'default' => {
  const t = label.toLowerCase();
  if (t.includes('subesta')) return 'substation';
  if (t.includes('chiller')) return 'chiller';
  if (t.includes('bomba') || t.includes('pump')) return 'pump';
  if (t.includes('medidor') || t.includes('relógio') || t.includes('relogio')) return 'meter';
  return 'default';
};
