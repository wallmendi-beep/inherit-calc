# 상속지분 계산기 로직 테스트 가이드

이 문서는 실제 사건을 검산한 뒤 계산기 로직을 회귀 테스트로 고정하는 방법을 설명합니다.

## 1. 테스트의 목표

상속지분 계산기는 단순 UI 앱이 아니라 날짜, 신분관계, 대습상속, 재상속, 구민법 규칙이 얽힌 계산 엔진입니다. 따라서 테스트는 다음 네 가지를 동시에 확인해야 합니다.

- 검산된 실제 사건의 최종 지분이 계속 동일한지
- 적용 법령 시대와 경고 코드가 의도대로 유지되는지
- 모든 최종 지분 합계가 사건 지분 전체와 일치하는지
- 사망자, 제외자, 부적격 대습상속인이 최종 결과에 남지 않는지

## 2. 현재 추가된 테스트 파일

- `src/engine/inheritance.golden.test.js`
  - `src/fixtures/verified-cases/*.json` 사건을 읽어 최종 지분, 적용 법령, 경고 코드를 검증합니다.
- `src/engine/inheritance.invariants.test.js`
  - 정답 사건이 아니어도 항상 지켜야 하는 구조적 조건을 검증합니다.
- `src/fixtures/verified-cases/`
  - 검산 사건 또는 기준 사건을 저장하는 폴더입니다.

## 3. 실행 방법

전체 테스트:

```bash
npm test
```

골든 테스트만 실행:

```bash
npm run test:golden
```

불변조건 테스트만 실행:

```bash
npm run test:invariants
```

빌드까지 확인:

```bash
npm run build
```

## 4. 사용자 역할과 Codex 역할

사용자가 맡을 일:

- 실제 사건 자료를 보고 가족관계와 사망일자가 맞는지 확인
- 최종 상속지분이 법리상 맞는지 검산
- 경고가 필요한 사건인지 확인

Codex가 맡을 일:

- 실제 사건 JSON을 fixture 형식으로 변환
- 기대 지분, 경고 코드, 적용 법령을 테스트에 연결
- 실패한 테스트의 원인이 입력 오류인지 엔진 버그인지 추적
- 검산 완료 사건을 회귀 테스트로 고정

## 5. Fixture 작성 방법

새 사건은 `src/fixtures/verified-cases/` 아래에 JSON 파일로 저장합니다.

파일명 예시:

```text
1978_kim_case_verified.json
2020_spouse_children_candidate.json
```

기본 형식:

```json
{
  "caseId": "2020_modern_spouse_two_children",
  "caseName": "1991 이후 배우자 + 자녀 2명",
  "verificationStatus": "candidate",
  "verifiedBy": "",
  "verifiedAt": "",
  "notes": "검산 전 사건",
  "tree": {},
  "expected": {
    "status": "success",
    "appliedLaws": ["1991"],
    "finalShares": [
      { "personId": "spouse", "name": "배우자", "share": "3/7" }
    ],
    "warningCodes": [],
    "integrity": {
      "total": "1/1",
      "hasTotalMismatch": false
    }
  }
}
```

`verificationStatus` 값:

- `candidate`: 검산 대기. 테스트에서 자동으로 제외됩니다.
- `baseline`: 개발 기준 회귀 사건. 법률 검산 완료 표시는 아닙니다.
- `verified`: 사용자가 실제 사건으로 검산 완료한 사건입니다.

실제 사건은 이름 중복 가능성이 있으므로 `name`만 쓰지 말고 `personId`를 같이 쓰는 것을 권장합니다.

## 6. 실제 사건을 테스트로 고정하는 절차

1. 앱에서 사건을 JSON으로 저장합니다.
2. 저장된 JSON 전체를 fixture의 `tree`에 넣습니다.
3. `verificationStatus`를 일단 `candidate`로 둡니다.
4. 앱 또는 별도 검산표에서 최종 지분을 확인합니다.
5. `expected.finalShares`에 검산된 지분을 입력합니다.
6. 필요한 경고가 있다면 `expected.warningCodes`에 경고 코드를 입력합니다.
7. 검산 완료 후 `verificationStatus`를 `verified`로 바꿉니다.
8. `npm test`를 실행합니다.

## 7. 기대 지분 작성 규칙

최종 지분은 문자열 분수로 적습니다.

```json
{ "personId": "s1", "name": "장남", "share": "2/7" }
```

골든 테스트는 우선순위대로 사람을 찾습니다.

1. `personId`
2. `id`
3. `name`

복잡한 실제 사건에서는 동명이인이 있을 수 있으므로 `personId`를 기준으로 작성하세요.

## 8. 경고 코드 확인 방법

경고 코드는 `calculateInheritance(...).warnings`에 들어 있습니다. 대표 예시는 다음과 같습니다.

- `ineligible-substitution-heirs`: 법적으로 대습상속인이 될 수 없는 하위 가지
- `auto-sibling-redistribution`: 후속 상속인이 없어 형제자매에게 자동 분배
- `inheritance-cycle`: 순환 참조
- `engine-warning`: 일반 엔진 경고

경고 문구 전체는 바뀔 수 있으므로 fixture에는 문구보다 `warningCodes`를 우선 고정합니다.

## 9. 불변조건 테스트가 잡는 문제

`inheritance.invariants.test.js`는 다음 문제를 자동으로 잡습니다.

- 최종 지분 합계가 `1/1`이 아님
- 최종 결과에 사망자가 남아 있음
- 분모가 0이거나 NaN이 발생함
- 지분이 기약분수가 아님
- 상속포기자가 최종 결과에 포함됨

이 테스트는 실제 사건 정답을 몰라도 엔진의 구조적 안전성을 확인합니다.

## 10. 실패했을 때 보는 순서

테스트가 실패하면 아래 순서로 확인합니다.

1. 입력 사건의 사망일자와 관계가 맞는지 확인합니다.
2. `expected.finalShares`의 `personId`가 실제 tree의 `personId`와 같은지 확인합니다.
3. 경고가 새로 생겼거나 사라졌는지 확인합니다.
4. `result.integrity.hasTotalMismatch`가 `true`인지 확인합니다.
5. 실제 법리상 기대값이 맞다면 엔진 회귀 가능성이 큽니다.
6. 엔진 변경이 의도된 것이라면 fixture 기대값을 검산 후 갱신합니다.

## 11. 권장 검산 우선순위

먼저 아래 유형의 실제 사건을 하나씩 검산해서 `verified`로 고정하는 것이 좋습니다.

1. 1991년 이후 단순 상속: 배우자 + 자녀
2. 1960년대 또는 1970년대 호주상속/출가녀 감산 사건
3. 1979년 개정 후 배우자 가산 사건
4. 선사망 자녀가 있는 대습상속 사건
5. 상속개시 후 상속인이 사망한 재상속 사건
6. 선사망 배우자 또는 사위 단독 가지처럼 차단되어야 하는 사건
7. 실제로 경고가 떠야 하는 불완전 입력 사건

## 12. 실무 운영 방식

검산 전 사건은 `candidate`로 저장해도 됩니다. 이 상태에서는 테스트가 실패하지 않습니다.

검산이 끝난 사건만 `verified`로 바꾸면 이후부터는 자동 회귀 테스트에 포함됩니다. 이 방식이면 실제 사건 정답을 사용자가 확인하고, Codex는 그 사건이 앞으로 깨지지 않도록 테스트 체계를 관리할 수 있습니다.
