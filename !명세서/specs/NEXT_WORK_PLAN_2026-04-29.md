# 다음 작업 계획

작성일: 2026-04-29  
현재 브랜치: optimization (PR #1 생성됨)

---

## 현황 요약

optimization 브랜치에서 완료한 작업:
- 코드 품질 (A/B/C): 파일 정리, App.jsx 리팩토링, 엔진 버그 수정
- 가이드 UX (P0/P1/P2): 날짜 검증, 안내문구, 입력 오류 방지
- ESLint no-unused-vars 에러 전면 클리어
- 스마트 가이드 운용 규칙 명세 작성

---

## 다음 브랜치: `bugfix-validation`

### 작업 1: 배우자별 자녀 중복 감지 (P0)

**문제**: 동일인이 wife 탭과 husband 탭에 각각 별도 노드로 중복 입력될 수 있음  
**감지 방법**: `personId` 기반으로 전체 트리 순회 → 같은 personId가 2개 이상이면 경고  
**위치**: `src/utils/importValidationV2.js`  
**가이드 코드**: `duplicate-person`  
**텍스트**: `인물 중복 — [이름]이 서로 다른 위치에 2곳 이상 입력되어 있습니다. 동일인이면 한 곳만 남기고 삭제해 주세요.`  
**주의**: `personId`가 없거나 자동 생성된 경우 false positive 가능 → name + relation 조합으로 보완

---

### 작업 2: 순환 참조 실시간 감지 (P0)

**문제**: 현재는 엔진 계산 시점에만 감지되며, 입력 중 실시간 피드백 없음  
**구현 방법**:
1. `importValidationV2.js`에 DFS 기반 사이클 탐지 추가
2. 방문 중인 노드 Set을 유지하며 이미 방문한 ID를 재방문하면 에러
3. 가이드 코드: `inheritance-cycle` (기존 엔진 코드와 통일)

```js
// 의사 코드
const detectCycle = (node, visiting = new Set()) => {
  if (visiting.has(node.personId)) return node.personId; // 사이클 감지
  visiting.add(node.personId);
  for (const heir of node.heirs || []) {
    const cycle = detectCycle(heir, new Set(visiting));
    if (cycle) return cycle;
  }
  return null;
};
```

---

### 작업 3: 호주상속 체인 심화 검증 (P2)

**문제**: 2세대 이상 호주 상속이 연속될 때 중간 단계 검증 미흡  
**현재**: `chained-hoju` 가이드가 1단계 체인만 감지  
**개선**: `checkGuideNode`에서 재귀적으로 호주 연속 체인 추적  
**조건**: 구법 + `isHoju: true` + 사망 + 1차 상속인 중 호주 미지정 → 재귀 탐색  

---

## 다음 브랜치: `feature-ux`

### 작업 4: 가이드 패널 UX 개선

**4-1. 가이드 항목 접기/펼치기**  
- 현재 모든 가이드가 펼쳐진 채로 표시됨  
- 가이드가 많을 때 스크롤이 길어지는 문제  
- 개선: 각 가이드 항목을 클릭으로 접기/펼치기  

**4-2. 가이드 완료율 표시**  
- 전체 N개 중 M개 완료 형식으로 진행률 표시  
- `mandatory` 가이드 기준으로 계산  

**4-3. 가이드 패널 빈 상태 UX**  
- 모든 가이드가 완료되면 ✅ 완료 메시지 표시  
- 현재는 빈 패널만 보임  

---

### 작업 5: 날짜 입력 개선

**5-1. 사망일 순서 경고**  
- 상속인의 사망일이 피상속인 사망일보다 이른 경우 → 선사망(대습상속) 자동 안내  
- 현재는 `updateDeathInfo`에서 처리하지만 DateInput 레벨에서도 시각적 힌트 필요  

**5-2. 키보드 단축키**  
- 날짜 필드에서 `T` 키 → 오늘 날짜 자동 입력 (테스트용 편의)  
- `↑` / `↓` 키 → 날짜 1일 증감  

---

## 다음 브랜치: `feature-calc-accuracy`

### 작업 6: 재혼 배우자 자녀 범위 가이드 (P2)

**문제**: 재혼(`remarriageDate`)이 있는 배우자의 자녀 범위가 혼동될 수 있음  
**감지 조건**:
- 배우자에게 `remarriageDate`가 있음
- 해당 배우자 아래 자녀가 있음
- 자녀의 생년/입력 정보만으로 생모 판단 불가
**가이드**: `verify-remarriage-children` (recommended)  
**텍스트**: `재혼 자녀 범위 확인 — [이름]은 재혼 이력이 있습니다. 자녀가 현재 배우자와의 자녀인지 이전 배우자와의 자녀인지 확인해 주세요.`

---

### 작업 7: 법정 지분 합계 사전 검증

**문제**: 현재 지분 합계 검증은 계산 후(post) audit에서만 수행  
**개선**: 계산 전 입력 단계에서 예상 지분 총합이 맞는지 사전 경고  
**방법**: `useCalcResult` 훅에서 경고 포함 시 `blockingIssues` 기반으로 입력 탭에도 알림  

---

## 우선순위 요약

| 순서 | 브랜치 | 작업 | 난이도 | 중요도 |
|---|---|---|---|---|
| 1 | bugfix-validation | 배우자별 자녀 중복 감지 | 중 | P0 |
| 2 | bugfix-validation | 순환 참조 실시간 감지 | 중 | P0 |
| 3 | bugfix-validation | 호주 체인 심화 검증 | 중 | P2 |
| 4 | feature-ux | 가이드 패널 UX 개선 | 중 | P1 |
| 5 | feature-ux | 날짜 입력 개선 | 낮 | P2 |
| 6 | feature-calc-accuracy | 재혼 자녀 범위 가이드 | 높 | P2 |
| 7 | feature-calc-accuracy | 지분 합계 사전 검증 | 높 | P2 |

---

## 작업 시작 전 체크리스트

- [ ] PR #1 (optimization → main) 머지 확인
- [ ] `git checkout main && git pull` 로 최신 main 동기화
- [ ] 새 브랜치 생성: `git checkout -b bugfix-validation`
- [ ] 테스트 기준선 확인: `npm run test`
