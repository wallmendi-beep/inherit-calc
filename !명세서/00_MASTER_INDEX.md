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
- **현재 버전**: v4.36
- **개발 환경**: Vite + React + TailwindCSS (Vanilla CSS 지향)
- **주요 철학**: Notion-inspired Professional Minimalist / Vault-based Inheritance Tracking
