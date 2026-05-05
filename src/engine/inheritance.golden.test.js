import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateInheritance } from './inheritance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(__dirname, '../fixtures/verified-cases');

const readFixtures = () => fs
  .readdirSync(fixtureDir)
  .filter((fileName) => fileName.endsWith('.json') && !fileName.startsWith('_'))
  .map((fileName) => {
    const filePath = path.join(fixtureDir, fileName);
    return {
      fileName,
      filePath,
      fixture: JSON.parse(fs.readFileSync(filePath, 'utf8')),
    };
  });

const flattenFinalShares = (finalShares) => [
  ...(finalShares?.direct || []),
  ...(finalShares?.subGroups || []).flatMap((group) => group.shares || []),
];

const shareText = (share) => `${share.n}/${share.d}`;

const findActualShare = (actualShares, expectedShare) => {
  if (expectedShare.personId) {
    const byPersonId = actualShares.find((share) => share.personId === expectedShare.personId);
    if (byPersonId) return byPersonId;
  }
  if (expectedShare.id) {
    const byId = actualShares.find((share) => share.id === expectedShare.id);
    if (byId) return byId;
  }
  return actualShares.find((share) => share.name === expectedShare.name);
};

const activeFixtures = readFixtures().filter(({ fixture }) => fixture.verificationStatus !== 'candidate');
const candidateFixtures = readFixtures().filter(({ fixture }) => fixture.verificationStatus === 'candidate');

describe('verified inheritance case fixtures', () => {
  it('does not accidentally run candidate fixtures as legal baselines', () => {
    expect(candidateFixtures.every(({ fixture }) => fixture.verificationStatus === 'candidate')).toBe(true);
  });

  activeFixtures.forEach(({ fileName, fixture }) => {
    it(`${fixture.caseId || fileName} matches expected shares and warnings`, () => {
      const result = calculateInheritance(fixture.tree, 0, { includeCalcSteps: true });
      const actualShares = flattenFinalShares(result.finalShares);
      const expectedShares = fixture.expected?.finalShares || [];
      const actualWarningCodes = (result.warnings || []).map((warning) => warning.code).sort();
      const expectedWarningCodes = [...(fixture.expected?.warningCodes || [])].sort();

      expect(result.status).toBe(fixture.expected.status);
      expect(result.appliedLaws).toEqual(fixture.expected.appliedLaws);
      expect(actualShares).toHaveLength(expectedShares.length);

      expectedShares.forEach((expectedShare) => {
        const actualShare = findActualShare(actualShares, expectedShare);
        expect(actualShare, `${fileName}: missing share for ${expectedShare.personId || expectedShare.name}`).toBeDefined();
        expect(shareText(actualShare)).toBe(expectedShare.share);
      });

      expect(actualWarningCodes).toEqual(expectedWarningCodes);
      expect(shareText(result.integrity.total)).toBe(fixture.expected.integrity.total);
      expect(result.integrity.hasTotalMismatch).toBe(fixture.expected.integrity.hasTotalMismatch);
    });
  });
});
