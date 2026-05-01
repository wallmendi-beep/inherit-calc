# 선사망/후사망/재상속/대습상속 판정 규칙 및 워프 네비게이션 기준

작성일: 2026-05-01  
관련 파일: `src/hooks/useSmartGuide.js`, `src/engine/eligibility.js`,  
`src/utils/importValidationV2.js`, `src/App.jsx` (handleGuideNavigate)

---

## 1. 핵심 용어 정의

| 용어 | 정의 |
|---|---|
| **선사망자** | 해당 사건의 피상속인보다 먼저 사망한 상속인 |
| **후사망자** | 해당 사건의 피상속인보다 나중에 사망한 상속인 (재상속 대상) |
| **대습상속** | 선사망한 자녀·형제자매 대신 그 직계비속·배우자가 상속에 들어오는 구조 |
| **재상속** | 후사망한 상속인이 자기 지분을 받은 후, 그 지분이 자신의 상속인에게 다시 넘어가는 구조 |
| **compareDate** | 선사망/후사망을 판정할 때 비교 기준이 되는 날짜 = 직접 부모 노드(피상속인)의 사망일 |

---

## 2. 판정 기준: 선사망 vs 후사망

### 2.1 compareDate 계산 규칙

`checkGuideNode` 순회 시 `parentDate`는 **조상 중 최대 사망일**로 누적된다.

```
nextParentDate = MAX(parentDate, node.deathDate)
```

따라서 정문자(김명수의 배우자)를 평가할 때:

```
김혁조(1967) → 김명수(1972) → 정문자
compareDate for 정문자 = MAX(1967, 1972) = 1972
```

이 방식은 일반적으로 올바른 결과를 준다. 단, 하위 계보에서 복잡한 다중 경로가 있을 경우 의도치 않게 더 이른 날짜를 기준으로 판정할 수 있으므로 주의.

### 2.2 관계별 판정 표

| 관계 | isPre (선사망) | isChild | 판정 결과 |
|---|---|---|---|
| son / daughter | true | true | **대습상속 대상** → grouped-missing-substitution |
| son / daughter | false | true | **재상속 대상** → grouped-direct-missing (비-배우자) |
| wife / husband / spouse | true | false | **선사망 배우자** → 가이드 없음 (상속 제외됨) |
| wife / husband / spouse | false | false | **후사망 배우자** → grouped-direct-missing (배우자 그룹) |
| sibling | true | false | ※ 현행: 가이드 없음 (선사망 형제자매는 isChild=false로 처리됨) |
| sibling | false | false | **재상속 대상** → grouped-direct-missing |

> **주의**: 관계 식별은 `isSpouseRelation()` 함수를 통해야 한다. hardcoded 배열(`['wife', 'husband', 'spouse']`)만 사용하면 한국어 관계명 또는 edge case에서 오판 발생.

---

## 3. 배우자 관계 식별 일관성 규칙

배우자 여부를 판단하는 코드가 두 곳에 있으며, **반드시 동일한 기준**을 사용해야 한다.

### 3.1 올바른 기준 (eligibility.js)

```js
// eligibility.js
export const isSpouseRelation = (relation) => (
  ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(relation)
);
```

### 3.2 현재 버그 위치

`useSmartGuide.js`의 `checkGuideNode` 내부:
```js
// 잘못된 코드 (한국어 관계명 미지원)
const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
```

`importValidationV2.js`:
```js
// 잘못된 코드
const SPOUSE_RELATIONS = new Set(['wife', 'husband', 'spouse']);
const isSpouse = SPOUSE_RELATIONS.has(node.relation);
```

### 3.3 수정 방향

모든 파일에서 `isSpouseRelation()` import 후 통일 사용.

```js
import { isSpouseRelation } from '../engine/eligibility';
// ...
const isSpouse = isSpouseRelation(node.relation);
```

---

## 4. 가이드 생성 조건 (checkGuideNode 기준)

아래 **모든 조건**을 동시에 만족할 때만 가이드가 생성된다.

```
node.id !== 'root'
&& node.isDeceased === true
&& node.deathDate (값 있음)
&& activeHeirs.length === 0  (제외 여부 불문 하위 상속인 없음)
&& !hasConfirmedNoSuccessors (successorStatus 미확정)
```

### 4.1 대습상속 가이드 (grouped-missing-substitution)

추가 조건:
- `isPre = true` (compareDate보다 먼저 사망)
- `isChild = true` (relation이 son 또는 daughter)

생성되는 가이드:
```
대습상속 미확정 — [{부모이름}] 사건의 선사망자: [{이름1}, {이름2}]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요.
```

### 4.2 후속 상속 가이드 (grouped-direct-missing)

추가 조건:
- `isPre = false` (compareDate 이후 사망)

생성되는 가이드:
- 배우자 단독(isSpouseGroup=true, 단일): `후속 상속 미확정 — [{배우자이름}] 사건. 추가 자녀가 있으면 입력, 없으면 '없음 확정'을 눌러 주세요.`
- 일반(isSpouseGroup=false): `후속 상속 미확정 — [{부모이름}] 사건: [{이름1}, {이름2}]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요.`

### 4.3 선사망 배우자 — 가이드 없음

조건: `isPre = true` AND `isSpouseRelation = true`

이 경우 배우자는 이미 상속 제외 처리됨. 별도 가이드 불필요.  
단, `importValidationV2`에서 `missing-descendants` 이슈가 생성되지 않도록 `isSpouse && isPredeceased` 조건으로 차단해야 함.

---

## 5. 중복 가이드 방지 규칙

동일 personId에 대해 `grouped-missing-substitution`과 `grouped-direct-missing`이 **동시에 생성되어서는 안 된다**.

현재 버그 원인:
- `isSpouseRelation()` 불일치로 배우자가 비-배우자로 오판
- 결과적으로 grouped-direct-missing(비-배우자)에 들어감
- 별도로 importValidationV2 issue도 생성되어 두 카드가 표시

방지 방법:
1. `isSpouseRelation()` 통일 사용 (근본 원인 제거)
2. (안전망) grouped-direct-missing 최종 생성 전, 같은 이름이 grouped-missing-substitution에 이미 있으면 제외

---

## 6. 워프(네비게이션) 기준

가이드 카드를 클릭했을 때 어디로 이동해야 하는지의 SSOT.

| 가이드 유형 | 이동 대상 | 이동 탭 | 이유 |
|---|---|---|---|
| **대습상속 미확정** (grouped-missing-substitution) | **부모 사건 탭** (parentNode.personId) | tree 탭 (event 모드) | 부모 탭에서 선사망자 행의 '없음 확정' 버튼에 접근 가능 |
| **후속 상속 미확정 — 배우자** (grouped-direct-missing, isSpouseGroup=true) | **배우자 본인 탭** (spouse.personId) | tree 탭 (event 모드) | 배우자 본인의 재상속 사건 탭에서 후속 상속인 입력/확정 |
| **후속 상속 미확정 — 비-배우자 단일** (grouped-direct-missing, 1명) | **본인 탭** (node.personId) | tree 탭 (event 모드) | 본인의 재상속 사건 탭에서 후속 상속인 입력/확정 |
| **후속 상속 미확정 — 비-배우자 복수** (grouped-direct-missing, n명) | **부모 사건 탭** (parentNode.personId) | tree 탭 (event 모드) | 복수 인원 → 부모 탭에서 여러 명 동시 확인 |

### 6.1 현재 버그 (워프 위치)

`grouped-direct-missing` 비-배우자 케이스의 navTarget:
```js
// 현재 (잘못됨)
const navTarget = group.isSpouseGroup ? group.firstTargetTabId : group.targetTabId;
// → 비-배우자 단일 케이스에서 group.targetTabId = 부모.personId로 이동 (틀림)
```

올바른 로직:
```js
// 수정 후
const navTarget = (group.isSpouseGroup || group.names.length === 1)
  ? group.firstTargetTabId   // 단일 or 배우자 → 본인 탭
  : group.targetTabId;       // 복수 → 부모 탭
```

---

## 7. importValidationV2 판정 기준 (보조 시스템)

`importValidationV2.js`는 전체 트리를 별도로 순회하며 `missing-descendants` 이슈를 생성한다.

### 7.1 inheritedDate 계산 방식

```js
const nextInheritedDate = node.deathDate || inheritedDate;
```

이는 직접 부모의 사망일을 기준으로 한다. checkGuideNode의 MAX 방식과 다르며, **더 엄밀하게 직계 부모 기준으로 판정**한다.

### 7.2 선사망 배우자 제외 규칙

```js
// 조건: 배우자(isSpouse)이면서 피상속인보다 먼저 사망(isPredeceased)한 경우 → issue 미생성
if (!(isSpouse && isPredeceased)) {
  issues.push(buildIssue(node, { code: 'missing-descendants', ... }));
}
```

이 조건도 `isSpouseRelation()`으로 통일해야 함.

---

## 8. 테스트 케이스 (김명수 사건 기준)

### 8.1 정문자 시나리오

| 항목 | 올바른 상황 | 현재 버그 원인 |
|---|---|---|
| 정문자의 관계 | 'wife' (김명수의 배우자) | isSpouseRelation 체크 불일치로 비-배우자 처리 |
| 정문자의 사망일 | 김명수 사후 사망 (후사망) | isPre 판정 자체는 올바름 |
| 생성되어야 할 가이드 | 배우자 후속상속 가이드 1개 | 비-배우자 형식 가이드 + import 이슈 2개 |
| 워프 이동 대상 | 정문자 본인 사건 탭 | 김명수 사건 탭 (오류) |

### 8.2 올바른 정문자 가이드

```
후속 상속 미확정 — [정문자] 사건. 추가 자녀가 있으면 입력, 없으면 '없음 확정'을 눌러 주세요.
```

클릭 시 → 정문자 본인 사건 탭 (tree 탭, event 모드)

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-01 | 초안 작성 — 선사망/후사망 판정 기준, 워프 규칙 SSOT, 배우자 관계 식별 일관성 문제 문서화 |
