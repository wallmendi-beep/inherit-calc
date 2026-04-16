# 인쇄/요약 경고 배너 — missingHeirNames 로직 명세

**작성일:** 2026-04-15 / **최종 수정:** 2026-04-15  
**관련 파일:** `src/components/PrintReport.jsx`, `src/components/SummaryPanel.jsx`

---

## 1. 역할

가계도 내에 **사망자로 표시되었으나 하위 상속인이 입력되지 않은 인물**이 존재할 경우,
인쇄 보고서 및 요약 화면에 경고 배너를 표시하여 실무 반영 오류를 방지한다.

---

## 2. 현재 구현 코드 (v4.68 이후 — 확정 버전)

`PrintReport.jsx`와 `SummaryPanel.jsx` 양쪽에 동일하게 적용.

```javascript
// boolean 대신 이름 배열로 변경 — 누가 미확정인지 특정
const missingHeirNames = useMemo(() => {
  if (!tree) return [];
  const names = [];
  const check = (node) => {
    if (
      node.id !== 'root' &&
      node.isDeceased &&
      node.isExcluded !== true &&
      node.successorStatus !== 'confirmed_no_substitute_heirs' &&
      (!node.heirs || node.heirs.length === 0)
    ) names.push(node.name || '이름미상');
    if (node.heirs) node.heirs.forEach(check);
  };
  check(tree);
  return names;
}, [tree]);

const hasMissingHeir = missingHeirNames.length > 0;
```

경고 배너 문구 (이름 포함):
```
[경고] 하위 상속인이 누락된 사망자가 존재합니다. ...
확정 필요: 홍길동, 김철수의 하위 상속인 정보를 확정해 주세요.
```

---

## 3. 경고가 표시되는 조건 (AND 4개)

| # | 조건 | 의미 |
|---|---|---|
| 1 | `node.id !== 'root'` | 피상속인(루트) 자체는 제외 |
| 2 | `node.isDeceased === true` | 사망자로 표시됨 |
| 3 | `node.isExcluded !== true` | 상속포기·결격·제외 처리되지 않은 상태 |
| 4 | `node.successorStatus !== 'confirmed_no_substitute_heirs'` | "후속 상속인 없음"을 확정하지 않은 상태 |
| 5 | `!node.heirs \|\| node.heirs.length === 0` | 하위 상속인이 한 명도 없음 |

가계도 전체를 재귀 탐색하여 해당 인물의 **이름 배열**을 반환.
배열이 비면(`length === 0`) 경고 배너가 사라진다.

---

## 4. 설계 의도 및 동작 원칙

### 경고가 사라지는 두 가지 방법

| 방법 | 설명 |
|---|---|
| 하위 상속인 직접 입력 | `node.heirs.length > 0` → 조건 5 불충족 → 목록에서 제거 |
| "후속 상속인 없음" 확정 버튼 클릭 | `successorStatus = 'confirmed_no_substitute_heirs'` → 조건 4 불충족 → 목록에서 제거 |

목록이 완전히 비어야(`missingHeirNames.length === 0`) 경고 배너가 화면에서 사라진다.

### 경고 문구 구성

```
[경고] 하위 상속인(대습/재상속인)이 누락된 사망자가 존재합니다.
본 문서는 미완성된 임시 계산 결과이므로 실무 반영에 주의하십시오.

확정 필요: 홍길동, 김철수의 하위 상속인 정보를 확정해 주세요.
```

이름을 명시함으로써 사용자가 어떤 탭으로 이동해 무엇을 처리해야 하는지 즉시 파악 가능.

---

## 5. 수정 이력

| 버전 | 변경 내용 |
|---|---|
| 초기 구현 | `hasMissingHeir` boolean, 조건 3개 (`isDeceased`, `isExcluded`, `heirs.length`) |
| v4.68 수정 | `missingHeirNames` 배열로 변경, `confirmed_no_substitute_heirs` 조건 추가, 루트 노드 제외, 경고 문구에 이름 명시 |

---

## 6. 현재 상태 요약

| 항목 | 상태 |
|---|---|
| 핵심 판단 방향 | ✅ 합리적 |
| `confirmed_no_substitute_heirs` 처리 | ✅ 구현 완료 |
| 경고 문구 내 이름 명시 | ✅ 구현 완료 |
| 루트 노드 예외 처리 | ✅ 구현 완료 |
| 코드 중복 | ⚠️ 두 파일에 동일 로직 (기능상 문제 없음, 추후 공통 유틸 추출 권장) |
