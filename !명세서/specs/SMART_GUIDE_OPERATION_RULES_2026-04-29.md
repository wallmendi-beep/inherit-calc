# 스마트 가이드 운용 규칙

작성일: 2026-04-29  
최종 업데이트: 2026-05-03 (v4.85 — 네비게이션 모드 정리, 중복 억제 규칙, 사건 맥락 기반 판정 반영)  
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
| `hasTargetNodes == true` | **input 탭으로 이동** + `targetTabId` 사건 탭 열기 + 해당 노드 하이라이트 (400ms 대기 후 2.5초간). `navigationMode` 값과 무관하게 이 분기가 우선한다. |
| `navigationMode: 'input'` | input 탭으로 이동 + `targetTabId` 사건 탭 열기. targetNodeIds가 있으면 하이라이트도 함께. |
| `navigationMode: 'event'` | tree 탭(사건 검토)으로 이동 + 해당 사건 포커스. targetNodeIds가 없을 때 적용. |
| `navigationMode: 'auto'` (default) | 현재 input 탭이면 스크롤+하이라이트, 다른 탭이면 편집 모달 오픈 |

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
| **억제 조건** | 같은 인물에 대해 `grouped-direct-missing`(후속상속 미확정)이 이미 생성된 경우 표시하지 않음. 후속상속 처리가 우선이기 때문 |
| **텍스트** | 혼인 정보 확인 — [이름] (구법 적용 여성). 혼인·이혼·복적 날짜를 입력하면 정확한 지분이 계산됩니다. |
| **이동** | `targetTabId` = parentTabId |
| **후속작업** | 혼인·이혼·복적 날짜 입력 |

---

### 2.9 grouped-missing-substitution

| 항목 | 내용 |
|---|---|
| **ID** | `grouped-missing-substitution-{groupKey}` |
| **분류** | mandatory |
| **트리거** | 선사망 자녀(son/daughter) + 하위 상속인 없음 + `successorStatus` 미확정 + `contextDate`보다 먼저 사망 |
| **그룹 키** | `contextNode + 직접부모` 단위. 서로 다른 계통의 선사망자는 별도 카드로 분리 |
| **텍스트 (직접 자녀)** | 대습상속 미확정 — [직접부모] 사건의 선사망자: [이름1], [이름2]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| **텍스트 (계통 경유)** | 대습상속 미확정 — [contextNode이름] 사건의 [직접부모이름] 계통 선사망자: [이름1]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| **이동** | `targetTabId` = 직접부모 탭, `targetNodeIds` = 선사망자 nodeId/personId 목록. `hasTargetNodes`가 true이므로 **input 탭**으로 이동하여 해당 행 하이라이트 |
| **중복 방지** | `directMissingPersonKeys`에 포함된 인원(후속상속 미확정 대상)은 이 목록에서 제외 |
| **후속작업** | 해당 행에서 대습상속인 입력 또는 '대습상속인 없음' 확정 |

---

### 2.10 grouped-direct-missing

| 항목 | 내용 |
|---|---|
| **ID** | `grouped-direct-missing-{groupKey}` |
| **분류** | mandatory |
| **트리거** | 사망자인데 후속 상속인 없음 + `successorStatus` 미확정 + `contextDate` 이후(또는 동일) 사망 |
| **그룹화** | 동일 contextNode 사건 + 배우자/일반 그룹으로 분리 |
| **텍스트 (일반)** | 후속 상속 미확정 — [contextNode이름] 사건: [이름1], [이름2]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| **텍스트 (배우자)** | → `buildSpouseDirectGuideText` 참고 |
| **이동 — 단일 인원 또는 배우자 그룹** | `navigationMode: 'input'`, `targetTabId` = 본인 personId → input 탭에서 해당 인물 사건 탭 열기 |
| **이동 — 복수 비-배우자** | `navigationMode: 'input'`, `targetTabId` = contextNode 탭 |
| **후속작업** | 해당 인물 입력 탭에서 후속 상속인 입력 또는 '없음 확정' |

#### grouped-direct-missing 배우자 텍스트 규칙

| spouseRelation | 단일 이름 | 복수 이름 |
|---|---|---|
| `wife` | 후속 상속 미확정 — [이름] 사건. 상위 사건 자녀를 자동으로 불러온 뒤, 이번 사건의 상속인 범위를 확인해 주세요. | 후속 상속 미확정 — [부모] 배우자별 자녀 확인: [이름1], [이름2]. |
| `husband` | 후속 상속 미확정 — [이름] 사건. 상위 사건 자녀를 자동으로 불러온 뒤, 이번 사건의 상속인 범위를 확인해 주세요. | 후속 상속 미확정 — [부모] 남편별 자녀 확인: [이름1], [이름2]. |
| 기타 | 후속 상속 미확정 — [이름] 사건. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. | 후속 상속 미확정 — [부모] 배우자별 후속 상속 확인: [이름1], [이름2]. |

#### 배우자 재상속 입력 안내 원칙

배우자 재상속 사건은 **후사망 배우자**인 경우에 한해 `처`, `남편`, `1991년 이전`, `1991년 이후`를 불문하고 먼저 상위 사건의 자녀 목록을 자동으로 불러온다. 선사망 배우자 또는 구법상 대습권 없는 사위/며느리 검토 단계에는 이 자동불러오기 안내를 표시하지 않는다. 안내 문구는 다음 순서로 구성한다.

1. 공통 안내: `상위 사건의 자녀들을 자동으로 불러왔습니다. 이 목록은 앞선 사건 기준 자녀이므로, 이번 사건의 상속인 범위를 확인해 주세요.`
2. 처 사건 보충:
   - 1991년 이전: `구법상 남편의 자녀가 처 사건의 상속인으로 반영될 수 있습니다. 처에게만 있는 별도 자녀가 있으면 추가하고, 상속인이 아닌 사람이 있으면 제외해 주세요.`
   - 1991년 이후: `1991년 이후 사건에서는 배우자의 자녀라는 이유만으로 처의 상속인이 되지 않습니다. 직접 자녀 또는 양자가 아닌 사람은 제외해 주세요.`
3. 남편 사건 보충: `남편의 직접 자녀 또는 양자가 아닌 사람은 제외하고, 남편에게만 있는 별도 자녀가 있으면 추가해 주세요.`
4. `추가 상속인 없음` 버튼은 자동으로 불러온 자녀 외에 더 추가할 상속인이 없다는 확인값으로 설명한다.

#### 배우자 자동불러오기 금지/보류 케이스

| 케이스 | 처리 |
|---|---|
| 선사망 배우자 | 재상속 사건이 아니므로 자동불러오기 배너와 호주상속 안내를 표시하지 않는다. |
| 1991년 이전 대습상속 사건의 사위 | 사위는 대습상속인이 아니므로 재상속 안내 대신 `사위 대습불가` 안내를 표시한다. |
| 후혼 배우자/후혼 자녀가 함께 입력된 경우 | 상속인으로 자동 확정하지 않고 후혼 가족관계 확인 가이드로 분리한다. |

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
| **텍스트 (단일)** | 계모자 관계 확인 — [처]의 배우자 [남편]에게 자녀 [자녀]이 입력되어 있습니다. [자녀]은 [처]와 계모자 관계일 수 있으므로, 구법상 [처] 사건의 상속인 포함 여부를 확인해 주세요. |
| **텍스트 (복수)** | 계모자 관계 확인 — [처]의 배우자 [남편]에게 자녀 [이름1], [이름2]이 입력되어 있습니다. 이들은 [처]와 계모자 관계일 수 있으므로, 구법상 [처] 사건의 상속인 포함 여부를 확인해 주세요. |
| **이동** | `navigationMode: 'event'` → tree 탭, parentTabId |
| **후속작업** | 처 사건에 해당 자녀 추가 여부 결정 |
| **중복 방지** | 남편 자녀가 처 사건에 이미 자동 반영되어 있으면 별도 계모자 가이드를 만들지 않는다. 이 가이드는 `1991년 이전 처 사건에 빠진 남편 자녀`가 있을 때만 표시한다. |

### 2.12-1 post-marriage-family

| 항목 | 내용 |
|---|---|
| **ID** | `post-marriage-family-{parentId}-{husbandId}` |
| **분류** | recommended |
| **트리거** | 구법 사건에서 배우자 아래 다른 배우자와 자녀가 있고, 다른 배우자의 혼인일이 현재 처 사건 사망일 이후 |
| **텍스트** | 후혼 가족관계 확인 — [남편] 아래에 [후혼 배우자] 및 [자녀]이 입력되어 있습니다. [후혼 배우자]은(는) [처] 사망 후 혼인한 배우자로 보입니다. [자녀]이 [처] 사망 당시 출생자 또는 태아였는지 확인하고, 해당하지 않으면 [처] 사건에서는 제외해 주세요. |
| **이동** | `navigationMode: auto` → 후보자가 실제 입력된 남편 하위 위치 |
| **후속작업** | 후혼 가족을 처 사건 상속인으로 보지 않도록 제외/삭제/참고정보 분리 |
| **비고** | 조창제-이옥지-조상욱처럼 원문에는 존재하지만 해당 상속 사건 범위 밖인 가족관계를 AI가 함께 가져오는 경우를 위한 검수 가이드다. |

---

### 2.13 import-{code} (데이터 검증 이슈)

`importValidationV2.js`에서 생성. 파일 불러오기 또는 데이터 변경 시 실시간 재검사.

| code | 분류 | 트리거 | 텍스트 |
|---|---|---|---|
| `missing-name` | mandatory | `!node.name?.trim()` | 이름 누락 — 이름 없이 등록된 상속인이 있습니다. 이름을 입력해 주세요. |
| `invalid-relation` | mandatory | `!VALID_RELATIONS.has(node.relation)` | 관계 오류 — [이름]의 관계가 올바르지 않습니다. 관계를 다시 선택해 주세요. |
| `missing-death-date` | mandatory | `node.isDeceased && !node.deathDate` | 사망일 누락 — [이름]. 사망일을 입력해야 계산이 가능합니다. |
| `missing-descendants` | mandatory | 후사망자(contextDate 이후 사망) + 하위상속인 없음 + successorStatus 미확정. 선사망자와 선사망 배우자는 제외 | 후속 상속 미확정 — [이름]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요. |
| `multiple-spouses` | mandatory | 유효 배우자 2명 이상 | 배우자 중복 — [이름] 아래에 유효 배우자가 둘 이상 있습니다. 1명만 남기고 나머지를 제외해 주세요. |
| `duplicate-name` | warning | 같은 부모 아래 동일 성명 2명 이상 | 성명 중복 — [부모] 아래에 [이름]이 N명 입력되어 있습니다. 동일인이면 1명만 남기고 삭제해 주세요. |

**네비게이션:**  
- `targetNodeIds: [issue.nodeId]` → hasTargetNodes = true → input 탭 + 노드 하이라이트  
- legacy hoju 케이스: `navigationMode: 'event'` → tree 탭

**억제 조건:**  
- `missing-descendants` 이슈는 `grouped-direct-missing`(후속상속 미확정)이 이미 생성된 personId에 대해서는 중복 생성하지 않음

---

### 2.14 engine-auto-sibling-redistribution

| 항목 | 내용 |
|---|---|
| **ID** | `engine-auto-sibling-redistribution-{personId}` |
| **분류** | recommended |
| **트리거** | 엔진 경고 `code: 'auto-sibling-redistribution'` 발생 |
| **억제 조건** | 같은 personId에 대해 `grouped-direct-missing`(후속상속 미확정)이 이미 생성된 경우 표시하지 않음. 같은 내용의 반복 제거 |
| **텍스트** | (배우자면) [이름] 사건의 추가 자녀/자녀 범위를 다시 확인해 주세요. / (그 외) 엔진 경고 텍스트 그대로 |
| **이동** | `targetTabId` → 해당 사건 |
| **후속작업** | 해당 사건 재확인 후 필요시 후속 상속인 입력 |

---

## 3. 가이드 생성 우선순위

아래 순서로 uniqueGuidesMap에 set됨 (나중에 set된 것이 override되지 않으므로 순서 = 우선순위).

1. `struct-err` — 구조 오류 (최우선)
2. `indep-excl` — 독립 제외 상태
3. `multi-spouse` — 중복 배우자
4. `checkGuideNode` 루프 — 누락/검토 필요 항목 (`contextDate/contextNode` 사건 맥락 전이 방식)
   - missing-death-date
   - next-order-female (그룹 축적)
   - missing-hoju
   - chained-hoju
   - verify-marriage (**directMissingPersonKeys에 없을 때만**)
   - grouped-missing-substitution (그룹 축적, contextNode+직접부모 단위)
   - grouped-direct-missing (그룹 축적, directMissingPersonKeys에 추가)
5. `collectLegacyStepchildGuideEntries` — 계모자 관계(legacy-stepchild) + 후혼 가족관계(post-marriage-family)
6. 그룹 Map 처리 — 축적된 그룹 가이드 생성
   - grouped-missing-substitution: directMissingPersonKeys에 있는 인원은 목록에서 제외
   - grouped-direct-missing: uniqueNames.length === 1이면 targetNodeId 포함
7. `importIssues` 처리 — 데이터 검증 이슈 (directMissingPersonKeys에 있는 missing-descendants는 건너뜀)
8. 엔진 경고 변환 — auto-sibling-redistribution (**directMissingPersonKeys에 없을 때만**)

---

## 4. 중복 제거 규칙

- 같은 uniqueKey는 한 번만 set됨 (`uniqueGuidesMap.has(key)` 체크)
- App.jsx에서 type+text 조합으로 2차 dedup 수행

### 4.1 directMissingPersonKeys를 통한 억제

`grouped-direct-missing` 에 추가된 인원의 nodeId/personId는 `directMissingPersonKeys` Set에 수집된다.
이 Set에 포함된 인원에 대해서는 아래 가이드를 **생성하지 않는다**.

| 억제 대상 | 이유 |
|---|---|
| `verify-marriage` | 후속상속 처리가 먼저이므로 혼인 정보 확인은 그 이후 |
| `import missing-descendants` | grouped-direct-missing과 같은 내용의 중복 카드 방지 |
| `engine-auto-sibling-redistribution` | 후속상속 미확정이 이미 표시되면 이 안내는 중복 |

### 4.2 대습상속 목록에서 후속상속 대상 제거

`grouped-missing-substitution` 생성 시 filteredItems 단계에서 `directMissingPersonKeys`에 있는 인원을 목록에서 제외한다. 같은 인물이 사건 맥락에 따라 후속상속 대상이기도 하고 대습 검토 대상이기도 할 때, 사용자 액션은 동일하므로 후속상속 카드만 표시한다.

---

## 5. 가이드 표시 조건 (탭별)

현재 탭 구조: `input` / `tree` / `acquisition` / `summary`

| 탭 | 가이드 패널 | 전역 경고 | Audit Action Items |
|---|---|---|---|
| `input` | ✅ 전체 표시 | ❌ | ❌ |
| `tree` | ✅ 전체 표시 | ✅ (audit 이슈 있으면) | ✅ |
| `acquisition` | ✅ 전체 표시 | ✅ | ✅ |
| `summary` | ✅ 전체 표시 | ✅ | ✅ |

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
| 2026-05-01 | v4.78 — isSpouseRelation() 통일, grouped-direct-missing 워프 수정(단일→본인탭), 취득경로 탭 카드/표 분리 |
| 2026-05-01 | v4.78 — 배우자 재상속 자동불러오기 안내 원칙 추가, 후혼 가족관계(post-marriage-family) 가이드 추가 |
| 2026-05-03 | v4.80 — 선사망/후사망 판정을 contextDate/contextNode 사건 맥락 기반으로 전환. 직접부모 사망일 방식 폐기 |
| 2026-05-03 | v4.82 — grouped-missing-substitution 그룹 키를 contextNode+직접부모 단위로 변경, targetTabId=직접부모탭 |
| 2026-05-03 | v4.83 — directMissingPersonKeys 기반 중복 억제 도입 (verify-marriage, import missing-descendants, auto-sibling-redistribution) |
| 2026-05-03 | v4.84 — 후속상속 미확정이 있는 동안 verify-marriage 카드 억제, 선사망 뱃지 rose 계열로 변경 |
| 2026-05-03 | v4.85 — grouped-direct-missing을 navigationMode:'input'으로 변경, 단일 인원은 targetNodeId 포함 |

---

## 10. 관련 문서

- `PREDECEASE_REINHERITANCE_JUDGMENT_AND_WARP_RULES.md` ⭐ — 선사망/후사망/대습/재상속 판정 기준, contextDate/contextNode 규칙 SSOT (최신)
- `TAB_STRUCTURE_RULES.md` ⭐ — 탭 구성 및 취득경로 뷰 모드, 인쇄 규칙 SSOT
- `SPOUSE_REINHERITANCE_GUIDE_REVISION_PLAN_2026-05-01.md` — 배우자 재상속 유저 가이드 수정 원칙
- `GUIDE_RULES_AND_NAVIGATION.md` — 네비게이션 구현 기준 (구버전, 참고용)
- `GUIDE_AND_WARNING_SPLIT_RULES_2026-04-14.md` — 탭별 가이드/경고 분리 규칙
- `IMPORT_GUIDE_FIRST_REVIEW_RULES_2026-04-13.md` — 파일 불러오기 후 가이드 규칙
