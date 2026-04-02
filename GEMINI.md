# GEMINI.md

## The Five Principles
1. **Think Before Coding** — Don’t assume; surface tradeoffs and ask when unclear.
2. **Simplicity First** — Minimum code, no speculative features or abstractions.
3. **Surgical Changes** — Touch only what’s needed; don’t “improve” unrelated code.
4. **Goal-Driven Execution** — Define success criteria and verify (e.g. with tests).
5. **Version Control & Auto-Commit** — 3번의 주요 요청마다 버전을 업데이트(Patch)하고, 작업 내용을 요약하여 자동으로 커밋합니다.

---

## 🏆 확정된 절대 고정 레이아웃 규정 (v1.8.8)

### 1. 상속인 행(HeirRow) 입력칸 배치 (정방향 순차)
| 순서 | 항목 | 간격(ML) | 너비(Width) |
| :--- | :--- | :--- | :--- |
| 0 | 드래그 핸들 | 10px | 20px |
| 1 | 상태 토글 | 20px | 28px |
| 2 | 성명 입력 | 50px | 72px |
| 3 | 관계 선택 | 30px | 96px |
| 4 | 사망일자 | 30px | 150px |
| 5 | 특수조건 | 10px | 180px |
| 6 | 재/대습상속 | 20px | 112px |
| 7 | 삭제 버튼 | -10px | 48px |
| 8 | 행 끝 마진 | - | 20px(MR) |

### 2. 헤더 텍스트 미세 보정 (Relative Offset)
- **상태**: `left-[15px]`
- **성명**: `left-[-20px]`
- **관계**: `left-[-30px]`
- **사망여부**: `left-[-40px]`
- **특수조건**: `left-[-20px]`
- **재/대습상속**: `left-[-30px]` (전체삭제 30px 우측 배치)

---

## 🖨️ 인쇄 파일명 명명 규정
- **형식**: `사건번호_피상속인명_보고서종류_오늘날짜`
- **안전장치**: 파일명에 사용할 수 없는 특수문자는 자동으로 제거합니다.
- **구현**: `document.title`을 임시 변경하여 브라우저 기본 인쇄 파일명을 제어합니다.

---

## 작업 지침 (Project Specific)
- 모든 답변과 코드 주석, 설명은 **한국어**로 작성합니다.
- 위 **절대 고정 레이아웃 규정**을 엄격히 준수하며, 향후 수정 시 이 수치를 기준점으로 삼습니다.
- 배우자 선사망 시 토글은 기본 OFF이되, 사용자가 직접 켜서 수정할 수 있도록 로직을 유지합니다.
- 현재 버전: v2.0.1
