# 스마트 가이드 운용 규칙

작성일: 2026-04-29  
관련 파일: `src/hooks/useSmartGuide.js`, `src/hooks/smartGuideHelpers.js`,  
`src/utils/importValidationV2.js`, `src/App.jsx` (handleGuideNavigate)

---

## 1. 가이드 시스템 구조

```
useSmartGuide.js          → 가이드 생성 (uniqueGuidesMap)
importValidationV2.js     → 데이터 검증 이슈 생성
App.jsx handleGuideNavigate → 가이드 클릭 시 네비게이션 처리
SmartGuidePanel.jsx       → 가이드 렌더링 UI
```

### 1.1 가이드 분류

| 분류 | 의미 | UI 표시 |
|---|---|---|
| `mandatory` | 계산 결과에 직접 영향 — 반드시 해결 필요 | 빨간 배지 |
| `recommended` | 법리 정확도 향상 — 권장이지만 선택 | 주황 배지 |

### 1.2 네비게이션 모드

| 모드 | 동작 |
|---|---|
| `hasTargetNodes == true` | input 탭으로 이동 + 해당 노드 하이라이트 (400ms 대기 후 2.5초간) |
| `navigationMode: 'event'` | tree 탭(사건 검토)으로 이동 + 해당 사건 포커스 |
| default (auto) | 현재 input 탭이면 스크롤+하이라이트, 다른 탭이면 편집 모달 오픈 |

---

## 2. 가이드 전체 목록

### 2.1 initial-step

| 항목 | 내용 |
|---|---|
| **ID** | `initial-step` |
| **분류** | mandatory |
| **트리거** | `!tree.name?.trim() \|\| !tree.deathDate` |
| **텍스트** | 피상속인 이름과 사망일자를 먼저 입력해 주세요. |
| **이동** | root 노드 (input 탭) |
| **후속작업** | 피상속인 이름 + 사망일 입력 |

---

### 2.2 struct-err

| 항목 | 내용 |
|---|---|
| **ID** | `struct-err-{node.id}` |
| **분류** | mandatory |
| **트리거** | 자녀 노드 아래에 `parent` 또는 `sibling` 관계가 존재 |
| **텍스트** | 관계 오류 — [이름]이 [부모] 아래에 '부모/형제'로 잘못 입력되어 있습니다. 관계를 수정하거나 삭제해 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, 해당 노드 하이라이트 |
| **후속작업** | 해당 노드 관계 수정 또는 삭제 |
| **비고** | `targetNodeIds` + `targetNodeId` 모두 설정됨 |

---

### 2.3 indep-excl

| 항목 | 내용 |
|---|---|
| **ID** | `indep-excl-{personId}` |
| **분류** | recommended |
| **트리거** | 선사망이 아닌 상속인이 `renounce`(상속포기) 또는 `disqualified`(상속결격)로 제외됨 |
| **텍스트** | ${optionText} 확인 — [이름]. 다른 사건에도 등장한다면 해당 사건에서도 제외 여부를 함께 검토해 주세요. |
| **이동** | 해당 인물로 이동 (default) |
| **후속작업** | 다른 사건에서의 동일 인물 제외 여부 재확인 |

---

### 2.4 multi-spouse

| 항목 | 내용 |
|---|---|
| **ID** | `multi-spouse-{personId}` |
| **분류** | mandatory |
| **트리거** | 피상속인 아래 유효 배우자(비제외, 비선사망)가 2명 이상 |
| **텍스트** | 배우자 중복 — [이름]: [배우자1], [배우자2]. 실제 상속받는 1명만 남기고 나머지를 제외해 주세요. |
| **이동** | `targetTabId` → 해당 탭 (input) |
| **후속작업** | 실제 상속 배우자 1명 제외하고 나머지 제외 처리 |

---

### 2.5 missing-death-date

| 항목 | 내용 |
|---|---|
| **ID** | `missing-death-date-{personId}` |
| **분류** | mandatory |
| **트리거** | `node.isDeceased && !node.deathDate` (root 제외) |
| **텍스트** | 사망일 누락 — [이름]. 사망일을 입력해야 정확한 상속 계산이 가능합니다. |
| **이동** | parentTabId (해당 인물의 부모 사건 탭) |
| **후속작업** | 사망일 입력 |

---

### 2.6 missing-hoju

| 항목 | 내용 |
|---|---|
| **ID** | `missing-hoju-{personId}` |
| **분류** | mandatory |
| **트리거** | 구법(1991년 이전 사망) + 해당 사건 1차 상속인 중 호주상속인(`isHoju`)이 없음 |
| **조건** | `needsHoju`: root 이거나 relation이 `son`/`husband` |
| **텍스트** | 호주 미지정 — [이름] 사건 (${deathYear}년, 구법 적용). 1차 상속인 중 호주상속인을 지정해 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, 해당 사건 |
| **후속작업** | 1차 상속인 목록에서 호주상속인 체크 |

---

### 2.7 chained-hoju

| 항목 | 내용 |
|---|---|
| **ID** | `chained-hoju-{personId}` |
| **분류** | recommended |
| **트리거** | 구법 + 자신이 호주(`isHoju`)인 사망자 + 본인의 1차 상속인 중 호주 미지정 |
| **텍스트** | 호주 연속 확인 — [이름] 사건. 1차 상속인 중 호주상속인 지정 여부를 확인해 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, 해당 사건 |
| **후속작업** | 호주 연속 체인 확인 후 필요시 지정 |

---

### 2.8 verify-marriage

| 항목 | 내용 |
|---|---|
| **ID** | `verify-marriage-{personId}` |
| **분류** | recommended |
| **트리거** | 구법 여성 상속인(`daughter`) + `marriageDate` 미입력 + `isSameRegister !== false` + `successorStatus` 미확정 |
| **텍스트** | 혼인 정보 확인 — [이름] (구법 적용 여성). 혼인·이혼·복적 날짜를 입력하면 정확한 지분이 계산됩니다. |
| **이동** | `targetTabId` = parentTabId |
| **후속작업** | 혼인·이혼·복적 날짜 입력 |

---

### 2.9 grouped-missing-substitution

| 항목 | 내용 |
|---|---|
| **ID** | `grouped-missing-substitution-{groupKey}` |
| **분류** | mandatory |
| **트리거** | 선사망 자녀/형제 + 하위 상속인 없음 + `successorStatus` 미확정 + 상속 기준일보다 먼저 사망 |
| **그룹화** | 동일 부모 사건 단위로 묶음 |
| **텍스트** | 대습상속 미확정 — [부모] 사건의 선사망자: [이름1], [이름2]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, `targetNodeIds`로 선사망자 노드 하이라이트 |
| **후속작업** | 대습상속인 입력 또는 해당 노드에서 '후속 상속인 없음' 확정 |

---

### 2.10 grouped-direct-missing

| 항목 | 내용 |
|---|---|
| **ID** | `grouped-direct-missing-{groupKey}` |
| **분류** | mandatory |
| **트리거** | 사망자인데 후속 상속인 없음 + `successorStatus` 미확정 + 상속 기준일 이후(또는 동일) 사망 |
| **그룹화** | 동일 부모 사건 + 배우자/일반 그룹으로 분리 |
| **텍스트 (일반)** | 후속 상속 미확정 — [부모] 사건: [이름1], [이름2]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| **텍스트 (배우자)** | → `buildSpouseDirectGuideText` 참고 |
| **이동** | `navigationMode: 'event'` → tree 탭 |
| **후속작업** | 후속 상속인 입력 또는 '없음 확정' |

#### grouped-direct-missing 배우자 텍스트 규칙

| spouseRelation | 단일 이름 | 복수 이름 |
|---|---|---|
| `wife` | 후속 상속 미확정 — [이름] 사건. 추가 자녀가 있으면 입력, 없으면 '없음 확정'을 눌러 주세요. | 후속 상속 미확정 — [부모] 배우자별 자녀 확인: [이름1], [이름2]. |
| `husband` | 후속 상속 미확정 — [이름] 사건. 자녀 범위를 확인하고 입력해 주세요. | 후속 상속 미확정 — [부모] 남편별 자녀 확인: [이름1], [이름2]. |
| 기타 | 후속 상속 미확정 — [이름] 사건. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. | 후속 상속 미확정 — [부모] 배우자별 후속 상속 확인: [이름1], [이름2]. |

---

### 2.11 next-order-female

| 항목 | 내용 |
|---|---|
| **ID** | `next-order-female-{groupKey}` |
| **분류** | recommended |
| **트리거** | 구법 + 순위 확정(`successorStatus`) + 동일 부모 아래 혼인 정보 없는 여성 형제자매 존재 |
| **텍스트** | 차순위 여성 검토 — [사건] 사건: [이름1], [이름2]. 미혼이면 그대로, 혼인력이 있으면 날짜를 입력해 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, parentTabId |
| **후속작업** | 해당 여성 상속인에게 혼인·이혼·복적 날짜 입력 또는 동일가적 확인 |

---

### 2.12 legacy-stepchild

| 항목 | 내용 |
|---|---|
| **ID** | `legacy-stepchild-{parentId}-{husbandId}` |
| **분류** | recommended |
| **트리거** | 구법(1991년 이전) + 남편의 자녀가 처 사건의 자녀 목록에 없음 |
| **텍스트 (단일)** | 계모자 관계 확인 — [자녀]이 [남편]의 자녀로 입력됨. 구법상 [처] 사건의 상속인에 포함될 수 있습니다. |
| **텍스트 (복수)** | 계모자 관계 확인 — [처] 사건 미포함 자녀([남편]): [이름1], [이름2]. 구법상 상속인에 포함될 수 있습니다. |
| **이동** | `navigationMode: 'event'` → tree 탭, parentTabId |
| **후속작업** | 처 사건에 해당 자녀 추가 여부 결정 |

---

### 2.13 import-{code} (데이터 검증 이슈)

`importValidationV2.js`에서 생성. 파일 불러오기 또는 데이터 변경 시 실시간 재검사.

| code | 분류 | 트리거 | 텍스트 |
|---|---|---|---|
| `missing-name` | mandatory | `!node.name?.trim()` | 이름 누락 — 이름 없이 등록된 상속인이 있습니다. 이름을 입력해 주세요. |
| `invalid-relation` | mandatory | `!VALID_RELATIONS.has(node.relation)` | 관계 오류 — [이름]의 관계가 올바르지 않습니다. 관계를 다시 선택해 주세요. |
| `missing-death-date` | mandatory | `node.isDeceased && !node.deathDate` | 사망일 누락 — [이름]. 사망일을 입력해야 계산이 가능합니다. |
| `missing-descendants` | mandatory | 사망자 + 하위상속인 없음 + 선사망 배우자 아님 | 후속 상속 미확정 — [이름]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| `multiple-spouses` | mandatory | 유효 배우자 2명 이상 | 배우자 중복 — [이름] 아래에 유효 배우자가 둘 이상 있습니다. 1명만 남기고 나머지를 제외해 주세요. |
| `duplicate-name` | warning | 같은 부모 아래 동일 성명 2명 이상 | 성명 중복 — [부모] 아래에 [이름]이 N명 입력되어 있습니다. 동일인이면 1명만 남기고 삭제해 주세요. |

**네비게이션:**  
- `targetNodeIds: [issue.nodeId]` → hasTargetNodes = true → input 탭 + 노드 하이라이트  
- legacy hoju 케이스: `navigationMode: 'event'` → tree 탭

---

### 2.14 engine-auto-sibling-redistribution

| 항목 | 내용 |
|---|---|
| **ID** | `engine-auto-sibling-redistribution-{personId}` |
| **분류** | recommended |
| **트리거** | 엔진 경고 `code: 'auto-sibling-redistribution'` 발생 |
| **텍스트** | (배우자면) [이름] 사건의 추가 자녀/자녀 범위를 다시 확인해 주세요. / (그 외) 엔진 경고 텍스트 그대로 |
| **이동** | `targetTabId` → 해당 사건 |
| **후속작업** | 해당 사건 재확인 후 필요시 후속 상속인 입력 |

---

## 3. 가이드 생성 우선순위

아래 순서로 uniqueGuidesMap에 set됨 (나중에 set된 것이 override되지 않으므로 순서 = 우선순위).

1. `struct-err` — 구조 오류 (최우선)
2. `indep-excl` — 독립 제외 상태
3. `multi-spouse` — 중복 배우자
4. `checkGuideNode` 루프 — 누락/검토 필요 항목
   - missing-death-date
   - next-order-female (그룹 축적)
   - missing-hoju
   - chained-hoju
   - verify-marriage
   - grouped-missing-substitution (그룹 축적)
   - grouped-direct-missing (그룹 축적)
5. `collectLegacyStepchildGuideEntries` — 계모자 관계
6. 그룹 Map 처리 — 축적된 그룹 가이드 생성
7. `importIssues` 처리 — 데이터 검증 이슈
8. 엔진 경고 변환 — auto-sibling-redistribution

---

## 4. 중복 제거 규칙

- 같은 uniqueKey는 한 번만 set됨 (`uniqueGuidesMap.has(key)` 체크)
- App.jsx에서 type+text 조합으로 2차 dedup 수행

---

## 5. 가이드 표시 조건 (탭별)

| 탭 | 가이드 패널 | 전역 경고 | Audit Action Items |
|---|---|---|---|
| `input` | ✅ 전체 표시 | ❌ | ❌ |
| `tree` | ✅ 전체 표시 | ✅ (audit 이슈 있으면) | ✅ |
| `calc` | ✅ 전체 표시 | ✅ | ✅ |
| `summary` | ✅ 전체 표시 | ✅ | ✅ |
| `amount` | ✅ 전체 표시 | ✅ | ✅ |

> 전역 경고(`showGlobalWarning`)는 `!isInputMode && audit.issues.length > 0` 일 때 활성화

---

## 6. 날짜 입력 유효성 (DateInput.jsx)

모든 날짜 입력 필드는 `DateInput` 컴포넌트를 통해 처리됨.

| 상태 | 동작 |
|---|---|
| 빈값 | 유효 — 그대로 저장 |
| 입력 중 (< 10자) | 자동 포맷(YYYY-MM-DD)만 적용, 저장 안 함 |
| 포커스 해제, 미완성 | 에러 표시 (빨간 테두리 + 툴팁), 저장 안 함 |
| 10자 완성 + 무효 날짜 (예: 2024-02-30) | 에러 표시, 저장 안 함 |
| 10자 완성 + 유효 날짜 | 정상 저장 |

에러 메시지: "올바른 날짜가 아닙니다" (빨간 툴팁)

---

## 7. 입력 오류 방지 장치 (HeirRow.jsx)

### 7.1 관계 무효화 감지

부모 노드의 관계가 변경되어 자식 노드의 현재 관계가 유효하지 않아질 때 경고.

| 조건 | 동작 |
|---|---|
| `node.relation === 'wife'` + 부모가 여성 | 드롭다운 텍스트 빨간색 + disabled '처 ⚠' 옵션 + '관계 재검토 필요' 툴팁 |
| `node.relation === 'husband'` + 부모가 남성 | 동일 |

사용자가 드롭다운에서 올바른 관계를 선택하면 자동 해제됨.

### 7.2 호주상속 상호배제

`setHojuStatus(tree, nodeId, isHoju)` (treeDomain.js)에서 처리:  
형제 노드 중 하나를 호주로 설정하면 나머지 형제의 `isHoju`가 자동으로 `false`로 설정됨.

---

## 8. 수리 힌트 텍스트 (inheritanceAudit.js)

계산 결과 검증 실패 시 SmartGuidePanel에 표시되는 수리 힌트.

| code | 텍스트 |
|---|---|
| `final-total-mismatch` | 지분 합산 오류 — 하위 계보 분배 누락 또는 상속포기·결격·상실 처리를 확인해 주세요. |
| `deceased-in-final-shares` | 사망자 지분 잔존 — 해당 인물 탭에서 후속 상속인을 입력하거나 자동 분배 결과를 확인해 주세요. |
| `unresolved-transit-share` | 미전달 지분 — [이름] (N/D). 하위 상속인 입력 또는 자동 분배 결과를 확인해 주세요. |
| `hierarchy-violation` | 계층 위반 — 부모/형제 관계가 자녀 아래 잘못 배치되어 있습니다. 위치를 바로잡아 주세요. |
| `inheritance-cycle` | 순환 참조 — [이름] 탭에서 동일인이 상하위에 중복 연결된 경로를 제거해 주세요. |

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-29 | 초안 작성 — 전체 가이드 목록 정리, 안내문구 컴팩트화 적용, DateInput 검증 규칙 추가 |
| 2026-04-29 | P1/P2 작업 반영 — duplicate-name 가이드 추가, 관계 무효화 감지 장치, 호주 상호배제, 수리 힌트 텍스트 추가 |

---

## 10. 관련 문서

- `GUIDE_RULES_AND_NAVIGATION.md` — 네비게이션 구현 기준 (구버전)
- `GUIDE_AND_WARNING_SPLIT_RULES_2026-04-14.md` — 탭별 가이드/경고 분리 규칙
- `GUIDE_LOGIC_AND_SUCCESSOR_CONFIRM_RULES_2026-04-14.md` — 빈 슬롯 안내 + 후속 상속인 확정 규칙
- `IMPORT_GUIDE_FIRST_REVIEW_RULES_2026-04-13.md` — 파일 불러오기 후 가이드 규칙
