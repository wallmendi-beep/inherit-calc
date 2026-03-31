# GEMINI.md

## The Five Principles
1. **Think Before Coding** — Don’t assume; surface tradeoffs and ask when unclear.
2. **Simplicity First** — Minimum code, no speculative features or abstractions.
3. **Surgical Changes** — Touch only what’s needed; don’t “improve” unrelated code.
4. **Goal-Driven Execution** — Define success criteria and verify (e.g. with tests).
5. **Version Control & Auto-Commit** — 3번의 주요 요청마다 버전을 업데이트(Patch)하고, 작업 내용을 요약하여 자동으로 커밋합니다.

---

## 상속인 컬럼 배치 규정 (v1.8.7 정밀 수정)

### 순차적 정방향 배치 (왼쪽 0px 기준)
0. **드래그 핸들**: 시작점 마진 **10px** (너비 20px)
1. **상태 토글**: 핸들에서 **20px** 지점 (너비 28px)
2. **성명 입력**: 토글에서 **50px** 지점 (너비 72px)
3. **관계 선택**: 성명에서 **30px** 지점 (너비 96px)
4. **사망일자**: 관계에서 **30px** 지점 (너비 150px)
5. **특수조건**: 사망일자에서 **10px** 지점 (너비 180px)
6. **재/대습상속**: 특수조건에서 **10px** 지점 (너비 112px)
7. **삭제 버튼**: 재상속 버튼에서 **0px** 지점 (너비 48px)
8. **행 끝 마진**: 마지막 항목에서 **10px** 여백

---

## 작업 지침 (Project Specific)
- 모든 답변과 코드 주석, 설명은 **한국어**로 작성합니다.
- UI 수정 시 요청받은 **정밀한 픽셀 단위 간격**을 엄격히 준수합니다.
- 배우자 선사망 시 토글은 기본 OFF이되, 사용자가 직접 켜서 수정할 수 있도록 로직을 개방합니다.
- 버전업 시 `App.jsx` 상단의 버전 문자열을 함께 갱신합니다.
- 현재 버전: v1.8.6 (예정)
