const SAMPLE_NAME_REGEX = /Sample_(\d+)/gi;

export const generateNextSampleName = (allExistingNames: string[]): string => {
  let maxIndex = 0;

  for (const rawName of allExistingNames) {
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      continue;
    }

    for (const match of rawName.matchAll(SAMPLE_NAME_REGEX)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        maxIndex = Math.max(maxIndex, value);
      }
    }
  }

  return `Sample_${maxIndex + 1}`;
};
