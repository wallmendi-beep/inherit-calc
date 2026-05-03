# 선사망/후사망/재상속/대습상속 판정 규칙 및 워프 네비게이션 기준

작성일: 2026-05-01  
최종 업데이트: 2026-05-03 (v4.80 - 사건 맥락 기준 판정 반영)  
관련 파일: `src/hooks/useSmartGuide.js`, `src/utils/importValidationV2.js`, `src/engine/inheritance.js`, `src/App.jsx`

---

## 1. 핵심 용어 정의

| 용어 | 정의 |
|---|---|
| 선사망자 | 현재 상속 사건의 피상속인보다 먼저 사망한 상속인 |
| 후사망자 | 현재 상속 사건의 피상속인보다 나중에 사망한 상속인 |
| 대습상속 | 선사망한 자녀·형제자매 대신 그 직계비속·배우자가 상속에 들어오는 구조 |
| 재상속 | 후사망한 상속인이 자기 지분을 받은 뒤, 그 지분이 자신의 상속인에게 다시 넘어가는 구조 |
| contextDate | 선사망/후사망 비교 기준이 되는 현재 상속 사건의 기준일 |
| contextNode | 현재 상속 사건의 피상속인 노드 |

---

## 2. 사건 맥락 기준 판정

`useSmartGuide()`와 `importValidationV2()`는 계산 엔진의 `inheritedDate -> distributionDate` 전이와 같은 방식으로 사건 맥락을 유지한다.

```js
contextDate = 현재 상속 사건의 기준일;
contextNode = 현재 상속 사건의 피상속인;

if (node.deathDate >= contextDate) {
  // 지분을 받은 뒤 사망한 사람: 재상속 사건으로 전환
  nextContextDate = node.deathDate;
  nextContextNode = node;
} else {
  // 현재 사건보다 먼저 사망한 사람: 대습/배제 검토이므로 사건 맥락 유지
  nextContextDate = contextDate;
  nextContextNode = contextNode;
}
```

직접 부모 사망일만 쓰거나, 조상 중 가장 늦은 사망일만 누적하면 안 된다. 같은 인물도 어느 사건 흐름에서 검토되는지에 따라 재상속 대상이 될 수도 있고 선사망 배제/대습 검토 대상이 될 수도 있다.

정문자 예시:

```text
김혁조(1967) -> 김명수(1972) -> 정문자(1986)
정문자는 김명수 사건에서는 후사망자이므로 재상속/후속상속 검토 대상

구수명(1990) -> 김명수(1972) -> 정문자(1986)
정문자는 구수명 사건에서는 선사망자이므로 생존 상속인으로 표시하지 않음
필요하면 김명수 계통의 대습상속인 입력 또는 '없음 확정'으로 정리
```

---

## 3. 가이드 생성 조건

아래 조건을 모두 만족할 때만 누락 가이드를 생성한다.

```text
node.id !== 'root'
node.isDeceased === true
node.deathDate 있음
activeHeirs.length === 0
successorStatus 미확정
```

### 3.1 대습상속 미확정

추가 조건:
- `node.deathDate < contextDate`
- `relation`이 `son` 또는 `daughter`

문구:

```text
대습상속 미확정 — [구수명] 사건의 김명수 계통 선사망자: [정문자]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요.
```

같은 사건의 직접 자녀라면 계통 문구 없이 표시한다.

```text
대습상속 미확정 — [김혁조] 사건의 선사망자: [OOO]. ...
```

### 3.2 후속 상속 미확정

추가 조건:
- `node.deathDate >= contextDate`

문구:

```text
후속 상속 미확정 — [김명수] 사건: [정문자]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요.
```

배우자 단독 가이드는 배우자별 문구 helper를 사용한다.

### 3.3 선사망 배우자

선사망 배우자는 현재 사건의 상속인이 아니므로 후속상속 가이드를 만들지 않는다. 단, 선사망 배우자 또는 구법상 대습권 없는 사위/며느리 아래에 후혼 배우자·자녀가 입력되어 있으면 후속상속이 아니라 AI 입력 검수용 가족관계 확인 가이드로 처리한다.

---

## 4. 중복 가이드 방지

동일 personId라도 서로 다른 사건 맥락에서는 서로 다른 가이드가 나올 수 있다.

- 김혁조 -> 김명수 사건: 정문자 후사망, 후속상속 검토
- 구수명 사건: 정문자 선사망, 생존 상속인 아님. 대습상속인 입력 또는 없음 확정 검토

다만 같은 사건 맥락에서 동일 personId가 `대습상속 미확정`과 `후속 상속 미확정`으로 동시에 뜨면 오류다.

방지 원칙:
- 그룹 키는 personId 단독이 아니라 사건 맥락(contextNode/contextDate)을 포함한다.
- import 검증의 `missing-descendants`는 후사망자에게만 생성한다.
- 선사망자는 SmartGuide의 대습상속 검토 카드가 담당한다.
- 배우자 여부는 항상 `isSpouseRelation()`으로 판정한다.

---

## 5. 워프 기준

| 가이드 유형 | 이동 대상 | 이동 탭 | 이유 |
|---|---|---|---|
| 대습상속 미확정 | contextNode 사건 또는 입력 하이라이트 | 사건 검토/데이터 입력 | 현재 사건에서 선사망자의 대습상속인 또는 없음 확정을 검토 |
| 후속 상속 미확정 - 단일 | 사망자 본인 사건 | 사건 검토 | 본인 재상속 사건에서 후속 상속인 입력/확정 |
| 후속 상속 미확정 - 복수 | contextNode 사건 | 사건 검토 | 같은 사건 내 여러 후사망자를 한 번에 확인 |

---

## 6. importValidationV2 보조 규칙

`importValidationV2.js`는 전체 트리를 순회하지만, 사건 맥락 전이는 SmartGuide와 동일하게 한다.

```js
const isPredeceased = node.deathDate && contextDate && isBefore(node.deathDate, contextDate);

if (node.isDeceased && !hasHeirs && !node.successorStatus && !isPredeceased) {
  issues.push(missingDescendantsIssue);
}
```

선사망자는 generic `후속 상속 미확정` import issue를 만들지 않는다. 이 구분이 없으면 정문자처럼 구수명 사건에서는 이미 선사망으로 배제되어야 할 사람이 후속상속 카드에도 다시 표시된다.

---

## 7. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-01 | 초안 작성 — 선사망/후사망 판정 기준, 워프 규칙 SSOT, 배우자 관계 식별 일관성 문제 문서화 |
| 2026-05-03 | v4.80 — 직접 부모 사망일 기준을 폐기하고 사건 맥락(contextDate/contextNode) 기준으로 재정리 |
