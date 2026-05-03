# 탭 구성 규칙 SSOT

작성일: 2026-05-01  
관련 파일: `src/App.jsx`, `src/components/AcquisitionPanel.jsx`, `src/components/SummaryPanel.jsx`

---

## 1. 탭 목록 (확정)

| 순서 | 탭 ID | 탭 라벨 | 한 줄 역할 |
|---|---|---|---|
| 1 | `input` | 데이터 입력 | 사실관계 원본 구축 |
| 2 | `tree` | 사건 검토 | 피상속인별 상속 흐름 독립 검증 |
| 3 | `acquisition` | 취득경로 | 상속인별 지분 취득 경로 확인 |
| 4 | `summary` | 상속지분 | 최종 지분 구조 확인 및 통분 검산 |

> **변경 이력**: 구 `calc`(계산 상세) 탭 및 `amount`(구체적 상속분) 탭은 현재 구조에 미포함.  
> 추후 추가 시 이 문서에 먼저 역할 정의 후 구현.

---

## 2. 탭별 역할 SSOT

### 2.1 `input` — 데이터 입력

**포함되어야 할 내용:**
- vault 입력/수정 (사람, 관계, 날짜, 상태)
- 호주/가적 조건 입력
- 사이드바(가계도 요약) 기본 열림

**포함되면 안 되는 내용:**
- 계산 결과, 지분 표시
- 취득경로 표시

---

### 2.2 `tree` — 사건 검토

**포함되어야 할 내용:**
- 피상속인별 상속 흐름 시각화 (flow 뷰)
- 스마트 가이드 네비게이션 대상 탭
- 각 상속인 카드 (관계, 지분, 재상속/대습상속 버튼)

**포함되면 안 되는 내용:**
- 데이터 직접 입력 UI
- 취득경로 표

---

### 2.3 `acquisition` — 취득경로

**포함되어야 할 내용:**
- **카드 뷰** (기본): 상속인별 카드 — 취득경로 + 최종지분 + 복수경로 합산
- **표 뷰**: 표 형식 — 최종상속인 / 지분 취득 경로 / 최종 합계 / 통분 지분
- 뷰 전환 토글: `카드로 보기` / `표로 보기`
- 이름 검색 기능

**포함되면 안 되는 내용:**
- 지분 구조(계통별 트리)
- 호주가산 안내 카드 (→ summary 또는 tree 탭)

**인쇄 규칙:**
- 인쇄 시 항상 **표 뷰**로 출력
- 카드 뷰로 보고 있더라도 인쇄 버튼 클릭 시 표 뷰 기준으로 출력
- 구현: `@media print` 에서 카드 뷰 hide, 표 뷰 show

---

### 2.4 `summary` — 상속지분

**포함되어야 할 내용:**
- **지분 구조 뷰만**: 계통별 상속인 목록 + 지분 + 통분 검산 표
- 호주가산 안내 카드
- 이름 검색 기능

**포함되면 안 되는 내용:**
- `취득 경로` 뷰 토글 (→ acquisition 탭으로 이전)
- PathView 컴포넌트

> **변경 전 상태**: summary 탭에 `지분 구조` / `취득 경로` 토글이 있었음.  
> 이 문서 이후: `취득 경로` 뷰는 acquisition 탭으로 이전하고, summary 탭은 지분 구조만 표시.

---

## 3. 뷰 모드 규칙

### 3.1 acquisition 탭 뷰 모드

| 모드 | 라벨 | 설명 |
|---|---|---|
| `card` | 카드로 보기 | 카드 그리드 레이아웃, 취득경로 요약 |
| `table` | 표로 보기 | 행/열 표 레이아웃, 인쇄 기준 형식 |

**기본값**: `card`  
**상태 위치**: `acquisitionViewMode` (App.jsx state)  
**유지 여부**: 탭 전환 시 뷰 모드 유지 (App.jsx에서 state로 관리)

### 3.2 summary 탭 뷰 모드

summary 탭은 뷰 모드 토글 없음. 항상 지분 구조만 표시.

---

## 4. 인쇄(Print) 규칙

| 탭 | 인쇄 대상 | 형식 |
|---|---|---|
| `input` | 가계도 구조 (사이드바 트리) | 텍스트 리스트 |
| `acquisition` | 취득경로 **표** | 표 형식 (카드 뷰라도 표로 출력) |
| `summary` | 지분 구조 표 | 표 형식 |

**acquisition 인쇄 구현 원칙:**
```
@media print {
  .acquisition-card-view { display: none; }
  .acquisition-table-view { display: block; }
}
```

---

## 5. 탭 전환 시 사이드바 처리

| 탭 | 사이드바 상태 |
|---|---|
| `input` | 기본 열림 |
| `tree` | 자동 닫힘 |
| `acquisition` | 현재 상태 유지 |
| `summary` | 현재 상태 유지 |

---

## 6. 스마트 가이드 → 탭 워프 규칙

| 가이드 유형 | 목표 탭 | 이동 방식 |
|---|---|---|
| initial-step, struct-err, missing-death-date 등 | `input` | targetNodeIds 하이라이트 |
| missing-hoju, chained-hoju, legacy-stepchild, grouped-missing-substitution, grouped-direct-missing 등 | `tree` | navigationMode: 'event' |
| import 이슈 (legacyHojuInputCase) | `tree` | navigationMode: 'event' |
| import 이슈 (일반) | `input` | navigationMode: 'auto' |

> **원칙**: `acquisition`이나 `summary` 탭으로 직접 워프하는 가이드는 현재 없음. 가이드는 항상 입력(input) 또는 사건 검토(tree)로 이동.

---

## 7. 금지 패턴

- summary 탭에 취득경로 뷰 추가 금지
- acquisition 탭에 지분 구조(계통별 트리) 추가 금지
- 같은 데이터를 두 탭에서 중복 표시 금지
- 탭별 역할 외 UI 요소 임의 추가 전 이 문서에 먼저 정의 후 구현

---

## 8. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-01 | 초안 작성 — 4탭 확정, acquisition 탭 카드/표 뷰 분리 규칙, summary 탭 취득경로 제거, 인쇄 규칙 SSOT |
