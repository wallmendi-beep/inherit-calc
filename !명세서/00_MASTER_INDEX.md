# 🏛️ 상속지분 계산기 PRO - Master Index

본 문서는 상속지분 계산기 프로젝트의 모든 명세, 디자인 가이드, 그리고 개발 정책의 통합 진입점입니다. AI 비서(Antigravity) 및 개발자는 모든 작업 시작 전 본 인덱스를 통해 최신 SSOT(Single Source of Truth)를 참조해야 합니다.

## 📌 문서 맵 (Document Map)

| 구분 | 문서명 | 경로 | 주요 내용 | 참조 우선순위 |
| :--- | :--- | :--- | :--- | :--- |
| **컨트롤** | **00_MASTER_INDEX.md** | `!명세서/00_MASTER_INDEX.md` | 프로젝트 전체 개요, 문서 색인, AI 동작 지침 | 1순위 |
| **로직** | **CORE_LOGIC_SPECS.md** | `!명세서/specs/CORE_LOGIC_SPECS.md` | 상속 법리, 시차별 전이 규칙, 스마트 가이드 문구 | 2순위 (기능) |
| **디자인** | **UI_DESIGN_SYSTEM.md** | `!명세서/ui/UI_DESIGN_SYSTEM.md` | 컬러, 타이포그래피, 컴포넌트 규격, 비주얼 스냅샷 | 2순위 (스타일) |
| **이력** | **history/** | `!명세서/history/` | 과거 버전별 업데이트 기록 및 변경 로그 | 3순위 |

---

## 🤖 AI 행동 지침 (Antigravity Directives)

1. **선조회 후작업**: 모든 기능 수정 및 UI 변경 요청 시, 위 문서들을 먼저 정독하여 기존 규칙과의 정합성을 검토하십시오.
2. **SSOT 준수**: 파편화된 과거의 업데이트 노트보다 `!명세서/specs/` 및 `!명세서/ui/`에 명시된 최신 명세를 최우선으로 따르십시오.
3. **디자인 성역화**: `!명세서/ui/UI_DESIGN_SYSTEM.md`에 정의된 원자적 디자인 규격(뱃지 형태, 색상 코드 등)은 명시적 요청 없이 임의로 수정하지 마십시오.
4. **문서 동기화**: 기능 변경이나 UI 조정이 승인된 후에는 반드시 관련 명세서(`CORE_LOGIC_SPECS.md` 등)를 최신 상태로 업데이트해야 합니다.

---

## 🚀 프로젝트 현황
- **현재 버전**: v4.32
- **개발 환경**: Vite + React + TailwindCSS (Vanilla CSS 지향)
- **주요 철학**: Notion-inspired Professional Minimalist / Vault-based Inheritance Tracking
