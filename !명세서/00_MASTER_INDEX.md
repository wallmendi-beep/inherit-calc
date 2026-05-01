# 상속지분 계산기 PRO - Master Index

본 문서는 상속지분 계산기 PRO의 문서 체계 입구이자, 최신 구현을 따라가기 위한 안내 문서입니다.  
현재 저장소는 **코드 구현이 문서보다 조금 앞서 있는 상태**이므로, 기능 검토 시에는 아래의 코드 축과 문서 축을 함께 확인해야 합니다.

---

## 1. 먼저 볼 코드

다음 파일들이 현재 동작을 이해할 때 가장 우선되는 구현 기준이다.

| 영역 | 파일 | 역할 |
|---|---|---|
| 계산 엔진 | `src/engine/inheritance.js` | 상속권 판정, 대습/재상속, 차순위 자동 탐색, 지분 분배 |
| 감사(audit) | `src/engine/inheritanceAudit.js` | 총합 불일치, 미전달 지분, 사망자 지분 잔존 등 사후 검증 |
| 공통 유틸 | `src/engine/utils.js` | 법 시기 판정, 날짜 비교, 분수 계산, 관계 표기 |
| 트리 정규화 | `src/utils/treeDomain.js` | import 정규화, `personId`/`id` 보존, 중복/순환 대응, 기본값 정리 |
| 앱 액션 | `src/utils/appActions.js` | AI 입력, 파일 저장/불러오기, import 후 정리 흐름 |
| 스마트 가이드 | `src/hooks/useSmartGuide.js` | 경고/행동 유도/탭 이동용 가이드 생성 |
| 스마트 가이드 규칙 | `!명세서/specs/SMART_GUIDE_OPERATION_RULES_2026-04-29.md` | 가이드 전체 운용 규칙 (마스터) |
| 엔진 로직 맵 | `src/engine/logic_map.md` | 엔진/검산/가이드 연결 구조 설명 |

---

## 2. 문서 분류

현재 문서는 다음 5개 축으로 읽는 것이 가장 효율적이다.

| 분류 | 대표 문서 | 설명 |
|---|---|---|
| 법 규칙 | `!명세서/specs/CORE_LOGIC_SPECS.md`, `INHERITANCE_SHARE_RULES.md` | 시대별 상속분, 대습·재상속, 예외 규칙 |
| 입력 정규화 | `IMPORT_PRECHECK_AND_REENTRY_RULES_2026-04-13.md`, `HEIR_IMPORT_SUBTREE_AND_CYCLE_PREVENTION_RULES_2026-04-13.md` | import 전처리, 트리 정규화, 중복/순환 방지 |
| AI 입력 | `AI_RELIABILITY_AND_CORRECTION_PRINCIPLES_2026-04-14.md`, `IMPORT_GUIDE_FIRST_REVIEW_RULES_2026-04-13.md` | AI JSON 신뢰성, 허용 필드, 후속 검토 흐름 |
| 가이드 UX | `SMART_GUIDE_OPERATION_RULES_2026-04-29.md` ⭐ | 가이드 전체 목록, 트리거, 텍스트, 네비게이션 동작 (최신) |
| 판정 규칙 | `PREDECEASE_REINHERITANCE_JUDGMENT_AND_WARP_RULES.md` ⭐ | 선사망/후사망/대습/재상속 판정 기준 + 워프 네비게이션 SSOT (2026-05-01) |
| 탭 구성 | `TAB_STRUCTURE_RULES.md` ⭐ | 4탭 역할 정의, 취득경로 뷰 모드, 인쇄 규칙 SSOT (2026-05-01) |
| 감사(audit) | `CORE_LOGIC_SPECS.md`, `src/engine/logic_map.md` | 최종 결과 무결성 검사, 경고/가이드 분리 |

---

## 3. 최우선 문서

다음 3개 문서는 현재 구현과 가장 직접적으로 맞물리는 상위 문서다.

1. `!명세서/00_MASTER_INDEX.md`
   문서 체계와 코드 축을 연결하는 입구
2. `!명세서/specs/CORE_LOGIC_SPECS.md`
   제품 철학이 아니라 **실제 구현 정책**을 설명하는 코어 문서
3. `src/engine/logic_map.md`
   엔진, audit, guide, import 흐름을 함께 보는 로직 맵

---

## 4. `logic_map.md`와의 관계

- `src/engine/logic_map.md`는 **검산 AI와 구현자**가 현재 엔진을 빠르게 파악하기 위한 로직 요약 문서다.
- `CORE_LOGIC_SPECS.md`는 **상위 원칙과 제품 정책**을 설명하는 문서다.
- 둘이 충돌하면 먼저 현재 코드(`inheritance.js`, `inheritanceAudit.js`, `treeDomain.js`, `useSmartGuide.js`)를 확인하고, 이후 두 문서를 함께 맞춘다.

---

## 5. 현재 문서 상태 메모

2026-04-23 기준:

- 계산 엔진과 audit 관련 핵심 철학 문서는 1차 최신화 진행됨
- import/AI/smart guide 관련 세부 문서는 추가 최신화 필요
- 과거 `_UTF8` 문서명을 전제로 적힌 목록은 실제 저장소 파일명과 일부 다를 수 있으므로, 파일 존재 여부를 먼저 확인한다

---

## 6. 문서 수정 원칙

문서를 고칠 때는 아래 순서를 따른다.

1. 현재 코드 동작 확인
2. 상위 문서 갱신
3. 세부 규칙 문서 갱신
4. 필요 시 history 문서 추가

또한 다음 원칙을 유지한다.

- 문서는 철학보다 구현에 가까워야 한다.
- 경고, audit, guide는 서로 다른 층으로 구분해 적는다.
- `personId`, `successorStatus`, `isPrimaryHojuSuccessor` 같은 실제 상태 필드는 문서에 이름 그대로 반영한다.
- 과거 문서 표현이 현재 코드와 다르면, 역사 보존보다 최신 구현 반영을 우선한다.
