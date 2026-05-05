# Verified Case Fixtures

This folder stores inheritance calculation cases that can be replayed by
`src/engine/inheritance.golden.test.js`.

Use these statuses:

- `baseline`: a developer regression case. It protects the current expected
  engine behavior, but it is not yet independently verified from a real case.
- `verified`: a real case whose expected shares and warnings were reviewed by
  the user.
- `candidate`: a real case waiting for review. Candidate files are skipped by
  the golden test until their expected results are confirmed.

Fixture shape:

```json
{
  "caseId": "2020_modern_spouse_two_children",
  "caseName": "1991 이후 배우자 + 자녀 2명",
  "verificationStatus": "baseline",
  "verifiedBy": "",
  "verifiedAt": "",
  "notes": "간단한 기준 사건",
  "tree": {},
  "expected": {
    "status": "success",
    "appliedLaws": ["1991"],
    "finalShares": [
      { "name": "배우자", "share": "3/7" }
    ],
    "warningCodes": [],
    "integrity": {
      "total": "1/1",
      "hasTotalMismatch": false
    }
  }
}
```

Prefer matching by `personId` for real cases with duplicated names.
