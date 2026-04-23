# 상속지분 계산기 PRO - Core Logic Specs

본 문서는 상속지분 계산기 PRO의 **현재 구현 정책**을 설명하는 코어 문서다.  
법리 요약만이 아니라, 실제 앱이 입력을 정규화하고, 상속권을 판정하고, audit와 guide를 생성하는 흐름까지 포함한다.

---

## 1. 핵심 구현 축

| 파일 | 역할 |
|---|---|
| `src/engine/utils.js` | 법 시기 판정, 날짜 비교, 관계 표기, 분수 계산 |
| `src/engine/inheritance.js` | 상속권 판정, 대습/재상속, 차순위 자동 탐색, 지분 분배 |
| `src/engine/inheritanceAudit.js` | 결과 무결성 검증 |
| `src/utils/treeDomain.js` | 입력 트리 정규화, ID/중복/기본값 처리 |
| `src/utils/appActions.js` | AI 입력, 파일 import/export, 후속 이동 정책 |
| `src/hooks/useSmartGuide.js` | 사용자를 위한 가이드·행동 유도 생성 |

---

## 2. 엔진 파이프라인

현재 구현은 대략 다음 순서로 동작한다.

1. **입력 정규화**
   `normalizeImportedTree()`가 허용 필드만 보존하고, `personId`/`id`를 정리하며, 중복·순환·기본 제외 상태를 정규화한다.
2. **상속권/대습권 판정**
   `inheritance.js`가 사망 시점, 제외 사유, 배우자 특칙, 재혼·이혼, 대습 가능성 등을 기준으로 유효 상속인을 고른다.
3. **차순위 자동 탐색**
   후속 상속인이 없고 자동 탐색 조건을 만족하면 `findGlobalSuccessors()`로 부모의 배우자, 형제자매를 차순위 후보로 찾는다.
4. **지분 분배 계산**
   법 시기(`1960` / `1979` / `1991`)와 관계, 호주 여부, 출가녀 여부에 따라 가중치를 계산해 분배한다.
5. **audit**
   최종 결과를 `inheritanceAudit.js`에서 검산해 총합, 사망자 지분 잔존, 미전달 지분 등을 확인한다.
6. **guide / UI 피드백**
   `useSmartGuide()`가 입력 누락, 구조 오류, 호주 검토, 후속 상속인 확인 등을 사용자 행동으로 연결한다.

---

## 3. 핵심 상태 필드

현재 구현을 이해할 때 특히 중요한 필드는 다음과 같다.

| 필드 | 의미 |
|---|---|
| `personId` | 동일인을 사건 간 연결할 때 쓰는 식별자 |
| `id` | 현재 트리 안에서의 노드 식별자 |
| `successorStatus` | 사용자가 “후속 상속인 없음” 등을 확정했는지 나타내는 상태 |
| `isPrimaryHojuSuccessor` | 호주 승계 우선자를 명시하는 필드 |
| `isHoju` | 호주 여부 |
| `isExcluded` / `exclusionOption` | 제외 상태 및 제외 사유 |
| `isSameRegister` | 동일가적/비동일가적 판정 입력 |

---

## 4. 시기별 법 적용

`getLawEra(deathDate)`는 사망연도 기준으로 다음 3개 시기를 사용한다.

| 코드 | 적용 범위 |
|---|---|
| `1960` | 1978년까지 |
| `1979` | 1979년 ~ 1990년 |
| `1991` | 1991년 이후 |

사망일이 없으면 기본값은 `1991`이다.

---

## 5. 대습, 재상속, 배우자 예외

### 5.1 선사망과 대습

- 선사망 자녀·형제자매는 하위 상속인이 있으면 대습 가지로 열릴 수 있다.
- 선사망 **배우자**는 상속권이 없는 배우자일 뿐이며, 배우자 라인에서 대습상속을 열지 않는다.

### 5.2 후사망과 재상속

- 후사망 상속인은 일단 해당 사건의 지분을 취득한 뒤, 자기 사망시점을 기준으로 별도 사건처럼 다시 계산한다.

### 5.3 무효 대습 가지

- 하위 상속인이 있어도 모두 법적으로 무자격이면 그 가지는 유효한 대습 가지가 아니다.
- 대표적으로 **1991년 이전 선사망 딸의 남편**은 대습상속인이 아니다.
- 이 경우 엔진은 그 가지를 조용히 버리지 않고 `ineligible-substitution-heirs` 경고를 남긴다.
- 해당 몫은 결과에서 증발하지 않고 같은 단계에서 다시 계산된다.

---

## 6. 차순위 자동 탐색 정책

`findGlobalSuccessors()`는 후속 상속인이 비어 있는 경우에만 작동한다.

작동 조건:

- `targetHeirs.length === 0`
- 현재 단계가 대습상속이 아님
- 루트가 아님
- 상속포기·결격 등으로 강제 제외된 상태가 아님
- `successorStatus !== 'confirmed_no_substitute_heirs'`

탐색 순서:

1. 부모의 배우자
2. 부모의 다른 자녀(형제자매)

형제자매는 반환 시 `relation: 'sibling'`으로 바꾸고, 원래 성별은 `_origRelation`에 보존한다.

---

## 7. 호주상속 구현 정책

호주 가산은 다음 조건을 충족할 때만 적용한다.

- 법 시기가 `1960` 또는 `1979`
- 대상이 `son`
- `nodeAllowsHoju === true`
- `primaryHojuSuccessor`가 지정됨
- 해당 아들의 키가 `primaryHojuSuccessor`와 일치
- 여성 피상속인의 직접 재산 단계가 아님 (`blocksDirectFemaleEstateBonus === false`)

관련 구현은 `inheritance.js`, `hojuBonusNotice.js`, `hojuBonusCompare.js`, `useSmartGuide.js`에 분산되어 있으므로 문서도 결과·가이드·비교 UI를 분리해 읽어야 한다.

---

## 8. 2024-04-25 이후 결격/상실 필터

피상속인 사망일이 2024-04-25 이후인 경우:

- 결격(`disqualified`) 또는 상실(`lost`) 처리된 상속인의 **배우자 계열**을 후속 상속인 목록에서 제외한다.
- 이는 대습 가지 유효성 판단과 audit 결과에 모두 영향을 준다.

---

## 9. Audit, Warning, Guide 분리 원칙

현재 구현은 세 층을 분리한다.

### 9.1 Warning

- 엔진이 계산 도중 감지한 경고
- 예: `ineligible-substitution-heirs`, `missing-primary-hoju-successor`, `auto-sibling-redistribution`

### 9.2 Audit

- 최종 계산 결과에 대한 무결성 검사
- 예: `final-total-mismatch`, `unresolved-transit-share`, `deceased-in-final-shares`

### 9.3 Guide

- 사용자가 무엇을 입력하거나 확인해야 하는지 안내
- `mandatory` / `recommended`로 구분되며, `targetTabId`, `targetNodeId`, `navigationMode`를 활용한다.

즉, 같은 문제라도:

- 엔진은 warning을 만들고
- audit는 최종 결과를 검사하고
- guide는 사용자 행동으로 연결한다.

---

## 10. 현재 구현 철학

- 사람의 법률 판단과 엔진의 계산 절차는 같은 결론으로 수렴해야 한다.
- 무효 가지 제거는 하위 고리 차단이지 재산 소멸이 아니다.
- `personId`가 없어도 서로 다른 대습 그룹이 합쳐지면 안 된다.
- 문서는 추상 원칙보다 실제 상태 필드와 함수 구조를 반영해야 한다.
