# 🏛️ 상속지분 계산기 PRO - Master Index

본 문서는 상속지분 계산기 프로젝트의 모든 명세, 디자인 가이드, 그리고 개발 정책의 통합 진입점입니다. AI 비서(Antigravity) 및 개발자는 모든 작업 시작 전 본 인덱스를 통해 최신 SSOT(Single Source of Truth)를 참조해야 합니다.

## 📌 문서 맵 (Document Map)

| 구분 | 문서명 | 경로 | 주요 내용 | 참조 우선순위 |
| :--- | :--- | :--- | :--- | :--- |
| **컨트롤** | **00_MASTER_INDEX.md** | `!명세서/00_MASTER_INDEX.md` | 프로젝트 전체 개요, 문서 색인, AI 동작 지침 | 1순위 |
| **로직** | **CORE_LOGIC_SPECS.md** | `!명세서/specs/CORE_LOGIC_SPECS.md` | 상속 법리, 시차별 전이 규칙, 스마트 가이드 문구 | 2순위 (기능) |
| **계산룰(공식 UTF-8)** | **INHERITANCE_SHARE_RULES_UTF8.md** | `!명세서/specs/INHERITANCE_SHARE_RULES_UTF8.md` | 시점별 상속분 계산 규칙, 배우자/대습/호주가산 기준 | 2순위 (계산 검증) |
| **호주가산 보조룰(공식 UTF-8)** | **HOJU_BONUS_FILTER_RULES_UTF8.md** | `!명세서/specs/HOJU_BONUS_FILTER_RULES_UTF8.md` | 본인 상속/대습상속/배우자 선사망 구분을 포함한 호주가산 필터 | 2순위 (계산 검증) |
| **가이드(공식 UTF-8)** | **GUIDE_RULES_AND_NAVIGATION_UTF8.md** | `!명세서/specs/GUIDE_RULES_AND_NAVIGATION_UTF8.md` | 가이드 생성 규칙, 클릭 이동, 권고/필수 정책 | 2순위 (가이드 UX) |
| **배우자 선사망 보조룰** | **SPOUSE_PREDECEASE_AND_HOJU_BONUS_RULES.md** | `!명세서/specs/SPOUSE_PREDECEASE_AND_HOJU_BONUS_RULES.md` | 선사망 배우자는 피대습자가 아니라는 원칙과 엔진 반영 지침 | 2순위 (법리 보조) |
| **원호주상속인 선택룰** | **HOJU_SUCCESSOR_SELECTION_RULE_UTF8.md** | `!명세서/specs/HOJU_SUCCESSOR_SELECTION_RULE_UTF8.md` | 원호주상속인 지정 방식, 단일선택 UI 위치, 직접/대습 호주가산 조건 분리 | 2순위 (호주가산 입력 설계) |
| **호주 UI/빈상태 안내룰** | **HOJU_UI_AND_EMPTY_STATE_RULES_2026-04-13_UTF8.md** | `!명세서/specs/HOJU_UI_AND_EMPTY_STATE_RULES_2026-04-13_UTF8.md` | 호주/비호주 토글, 원호 선택, 빈상태 안내 단일화 규칙 | 2순위 (입력 UX/안내 로직) |
| **토글 상태 판정룰** | **TOGGLE_STATUS_RESOLUTION_RULES_2026-04-13_UTF8.md** | `!명세서/specs/TOGGLE_STATUS_RESOLUTION_RULES_2026-04-13_UTF8.md` | 하위 상속인 입력 이후 상태 토글을 ON/OFF로 복구 또는 유지하는 규칙 | 2순위 (입력 UX/상태 판정) |
| **불러오기/순환참조 방지룰** | **HEIR_IMPORT_SUBTREE_AND_CYCLE_PREVENTION_RULES_2026-04-13_UTF8.md** | `!명세서/specs/HEIR_IMPORT_SUBTREE_AND_CYCLE_PREVENTION_RULES_2026-04-13_UTF8.md` | 상속인 불러오기 시 서브트리 복제 원칙, cycle 우선 처리, 재발 방지 기준 | 2순위 (입력 구조 안정성) |
| **사망자 탭 배우자 필터룰** | **DECEASED_TAB_SPOUSE_PREDECEASE_FILTER_RULES_2026-04-13_UTF8.md** | `!명세서/specs/DECEASED_TAB_SPOUSE_PREDECEASE_FILTER_RULES_2026-04-13_UTF8.md` | 선사망 배우자를 루트/중간 단계 모두에서 사망자 탭 생성 대상에서 제외하는 규칙 | 2순위 (탭 생성/이동 정합성) |
| **남편 대습 불가 복원룰** | **LEGACY_HUSBAND_SUBSTITUTION_BLOCK_RULES_2026-04-13_UTF8.md** | `!명세서/specs/LEGACY_HUSBAND_SUBSTITUTION_BLOCK_RULES_2026-04-13_UTF8.md` | 1991년 이전 남편 대습 불가 예외를 입력행/복원/불러오기 전 과정에서 sticky하게 유지하는 규칙 | 2순위 (대습/토글 정합성) |
| **빈상태/불러오기 부모해석룰** | **EMPTY_STATE_AND_AUTOFILL_PARENT_RESOLUTION_RULES_2026-04-13_UTF8.md** | `!명세서/specs/EMPTY_STATE_AND_AUTOFILL_PARENT_RESOLUTION_RULES_2026-04-13_UTF8.md` | 빈상태 안내와 불러오기가 같은 현재 부모 기준을 사용하도록 통일하는 규칙 | 2순위 (입력 UX/부모 해석) |
| **AI 누락 확인 경고룰** | **AI_IMPORT_MISSING_DESCENDANTS_WARNING_RULES_2026-04-13_UTF8.md** | `!명세서/specs/AI_IMPORT_MISSING_DESCENDANTS_WARNING_RULES_2026-04-13_UTF8.md` | AI 입력에서 사망자 하위상속인이 비어 있을 때 누락 가능성을 먼저 경고하는 규칙 | 2순위 (AI 입력 방어) |
| **AI 신뢰성/교정 원칙** | **AI_RELIABILITY_AND_CORRECTION_PRINCIPLES_2026-04-14_UTF8.md** | `!명세서/specs/AI_RELIABILITY_AND_CORRECTION_PRINCIPLES_2026-04-14_UTF8.md` | AI 오류 가능성 전제, 선질문 후생성 규칙, 사용자 시정 권한 보장 철학 | 2순위 (프로젝트 설계 철학) |
| **불러오기 선검사룰** | **IMPORT_PRECHECK_AND_REENTRY_RULES_2026-04-13_UTF8.md** | `!명세서/specs/IMPORT_PRECHECK_AND_REENTRY_RULES_2026-04-13_UTF8.md` | AI/파일 불러오기 시 구조 오류를 선검사하고 재입력을 유도하는 규칙 | 2순위 (AI/파일 입력 방어) |
| **불러오기 검수 가이드룰** | **IMPORT_GUIDE_FIRST_REVIEW_RULES_2026-04-13_UTF8.md** | `!명세서/specs/IMPORT_GUIDE_FIRST_REVIEW_RULES_2026-04-13_UTF8.md` | 불러오기 차단 대신 입력 탭과 스마트 가이드에서 직접 수정하도록 유도하는 규칙 | 2순위 (AI/파일 입력 UX) |
| **변경로그/오토세이브 룰** | **CHANGELOG_HISTORY_AND_AUTOSAVE_RULES_2026-04-13_UTF8.md** | `!명세서/specs/CHANGELOG_HISTORY_AND_AUTOSAVE_RULES_2026-04-13_UTF8.md` | 스냅샷 히스토리 축소, action log 누적, localStorage 오토세이브, 비교 계산 제한 규칙 | 2순위 (성능/메모리 관리) |
| **calcSteps 지연생성 룰** | **CALCSTEP_LAZY_BUILD_RULES_2026-04-13_UTF8.md** | `!명세서/specs/CALCSTEP_LAZY_BUILD_RULES_2026-04-13_UTF8.md` | 입력 탭에서 상세 계산 스텝 생성을 생략하고 비교 계산도 경량화하는 규칙 | 2순위 (성능/메모리 관리) |
| **실시간 감시 안정화 룰** | **REALTIME_WATCHER_STABILIZATION_RULES_2026-04-13_UTF8.md** | `!명세서/specs/REALTIME_WATCHER_STABILIZATION_RULES_2026-04-13_UTF8.md` | import 검수 실시간 재검사 중단, 스마트 가이드 지연 계산 등 안정화 규칙 | 2순위 (성능/메모리 관리) |
| **스마트가이드 호주 예외룰** | **SMARTGUIDE_HOJU_EXCLUSION_RULES_2026-04-13_UTF8.md** | `!명세서/specs/SMARTGUIDE_HOJU_EXCLUSION_RULES_2026-04-13_UTF8.md` | 법리상 배제된 사람에게 호주 관련 가이드를 띄우지 않는 예외 규칙 | 2순위 (가이드 정합성) |
| **불러오기 재링크 우선룰** | **AUTOFILL_RELINK_INSTEAD_OF_SUBTREE_CLONE_RULES_2026-04-13_UTF8.md** | `!명세서/specs/AUTOFILL_RELINK_INSTEAD_OF_SUBTREE_CLONE_RULES_2026-04-13_UTF8.md` | 상속인 불러오기 시 기존 personId를 재사용하고 하위 서브트리 재복제를 막는 규칙 | 2순위 (성능/구조 안정성) |
| **메모리누수 원인분석(참조안정성)** | **MEMORY_LEAK_ROOT_CAUSE_SMARTGUIDE_REFERENTIAL_STABILITY_2026-04-13_UTF8.md** | `!명세서/specs/MEMORY_LEAK_ROOT_CAUSE_SMARTGUIDE_REFERENTIAL_STABILITY_2026-04-13_UTF8.md` | smartGuides/useEffect/Set 참조 불안정으로 생긴 무한 리렌더 메모리 누수 원인과 재발 방지 규칙 | 2순위 (성능/회귀 방지) |
| **탭 역할 정의/사건 검토 뷰 설계** | **TAB_ROLE_DEFINITION_AND_TREE_SIMULATION_DRAFT_2026-04-13_UTF8.md** | `!명세서/specs/TAB_ROLE_DEFINITION_AND_TREE_SIMULATION_DRAFT_2026-04-13_UTF8.md` | 5개 탭 역할 SSOT, 사건 검토 뷰 설계 철학(사건 분리, 캐스케이드 구조), 지분 요약 통합 근거 (v4.62 업데이트) | 2순위 (정보구조/탭 UX) |
| **가이드/후속상속인확정 룰** | **GUIDE_LOGIC_AND_SUCCESSOR_CONFIRM_RULES_2026-04-14_UTF8.md** | `!명세서/specs/GUIDE_LOGIC_AND_SUCCESSOR_CONFIRM_RULES_2026-04-14_UTF8.md` | 가이드 우선순위, 호주상속 판단을 위한 불러오기 필요 조건, 후속 상속인 없음 확정 버튼 규칙 | 2순위 (가이드 UX/입력 마감) |
| **대습/재상속 경우의 수 룰** | **SUBSTITUTION_AND_REINHERITANCE_CASE_MATRIX_2026-04-14_UTF8.md** | `!명세서/specs/SUBSTITUTION_AND_REINHERITANCE_CASE_MATRIX_2026-04-14_UTF8.md` | 대습상속과 재상속을 선사망/후사망 기준으로 나누고, 없음 확정·호주상속 가이드·차순위 여성 검토 조건을 정리한 경우의 수 문서 | 2순위 (가이드 UX/사건 분기) |
| **입력 특수조건 최소구성 룰** | **INPUT_SPECIAL_CONDITION_MINIMAL_RULES_2026-04-14_UTF8.md** | `!명세서/specs/INPUT_SPECIAL_CONDITION_MINIMAL_RULES_2026-04-14_UTF8.md` | 데이터 입력 탭 특수조건 칸에 남길 요소와 제거할 요소, 선사망자 확정 버튼 원칙 | 2순위 (입력 UX/역할 분리) |
| **가이드/경고 분리 룰** | **GUIDE_AND_WARNING_SPLIT_RULES_2026-04-14_UTF8.md** | `!명세서/specs/GUIDE_AND_WARNING_SPLIT_RULES_2026-04-14_UTF8.md` | 데이터 입력 탭 가이드와 시뮬레이션·계산 경고를 분리하는 기준 | 2순위 (가이드 UX/경고등 정리) |
| **차순위 여성 상속인 동일가적 검토 룰** | **NEXT_ORDER_FEMALE_REGISTER_REVIEW_RULES_2026-04-14_UTF8.md** | `!명세서/specs/NEXT_ORDER_FEMALE_REGISTER_REVIEW_RULES_2026-04-14_UTF8.md` | 후속 상속인 없음 확정 후 차순위 여성 상속인의 동일가적 여부를 필요한 경우에만 검토하는 규칙 | 2순위 (가이드 UX/구법 여성 판정) |
| **사건형 호주가산 안내룰** | **HOJU_BONUS_CASE_NOTICE_RULES_2026-04-13_UTF8.md** | `!명세서/specs/HOJU_BONUS_CASE_NOTICE_RULES_2026-04-13_UTF8.md` | 실제 호주가산 적용자에게만 사건형 안내를 띄우는 규칙과 후속 비교 UI 범위 | 2순위 (결과 UX/사건 안내) |
| **대습상속 실무서 메모** | **SUBSTITUTION_RULES_FROM_SEOUL_BOOK_2026-04-13_UTF8.md** | `!명세서/specs/SUBSTITUTION_RULES_FROM_SEOUL_BOOK_2026-04-13_UTF8.md` | 서울중앙지법 실무서 발췌 기반 대습상속/포기/결격/동시사망/재혼 규칙 정리 | 2순위 (대습 규칙 보강) |
| **상속분 실무서 메모** | **INHERITANCE_SHARE_RULES_FROM_SEOUL_BOOK_2026-04-13_UTF8.md** | `!명세서/specs/INHERITANCE_SHARE_RULES_FROM_SEOUL_BOOK_2026-04-13_UTF8.md` | 서울중앙지법 실무서 발췌 기반 시기별 상속분 규칙 정리 | 2순위 (상속분 시기판정 보강) |
| **상속인 자격 실무서 메모** | **HEIR_QUALIFICATION_AND_DISQUALIFICATION_FROM_SEOUL_BOOK_2026-04-13_UTF8.md** | `!명세서/specs/HEIR_QUALIFICATION_AND_DISQUALIFICATION_FROM_SEOUL_BOOK_2026-04-13_UTF8.md` | 서울중앙지법 실무서 발췌 기반 상속인 자격, 결격, 상실 규칙 정리 | 2순위 (상속인 자격 보강) |
| **검산 메모** | **KIM_HYEOKJO_VALIDATION_2026-04-13_UTF8.md** | `!명세서/specs/KIM_HYEOKJO_VALIDATION_2026-04-13_UTF8.md` | 김혁조 사건 계통별 검산 결과, JSON 정정 내역, 최종 합계 검증 | 2순위 (사건 검산) |
| **디자인** | **UI_DESIGN_SYSTEM.md** | `!명세서/ui/UI_DESIGN_SYSTEM.md` | 컬러, 타이포그래피, 컴포넌트 규격, 비주얼 스냅샷 | 2순위 (스타일) |
| **이력** | **history/** | `!명세서/history/` | 과거 버전별 업데이트 기록 및 변경 로그 | 3순위 |

---

## 🤖 AI 행동 지침 (Antigravity Directives)

1. **선조회 후작업**: 모든 기능 수정 및 UI 변경 요청 시, 위 문서들을 먼저 정독하여 기존 규칙과의 정합성을 검토하십시오.
2. **SSOT 준수**: 파편화된 과거의 업데이트 노트보다 `!명세서/specs/` 및 `!명세서/ui/`에 명시된 최신 명세를 최우선으로 따르십시오.
   같은 주제의 기존 문서와 `_UTF8.md` 재작성본이 함께 있을 경우에는 `_UTF8.md` 문서를 공식 참조본으로 사용합니다.
3. **디자인 성역화**: `!명세서/ui/UI_DESIGN_SYSTEM.md`에 정의된 원자적 디자인 규격(뱃지 형태, 색상 코드 등)은 명시적 요청 없이 임의로 수정하지 마십시오.
4. **문서 동기화**: 기능 변경이나 UI 조정이 승인된 후에는 반드시 관련 명세서(`CORE_LOGIC_SPECS.md` 등)를 최신 상태로 업데이트해야 합니다.

---

## 🚀 프로젝트 현황
- **현재 버전**: v4.62
- **개발 환경**: Vite + React + TailwindCSS (Vanilla CSS 지향)
- **주요 철학**: Notion-inspired Professional Minimalist / Vault-based Inheritance Tracking

- [SIMULATION_EVENT_SCOPE_RULES_2026-04-13_UTF8.md](C:\VS_CODE\상속지분 계산기\!명세서\specs\SIMULATION_EVENT_SCOPE_RULES_2026-04-13_UTF8.md)
