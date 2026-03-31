# GEMINI.md

## The Five Principles
1. **Think Before Coding** — Don’t assume; surface tradeoffs and ask when unclear.
2. **Simplicity First** — Minimum code, no speculative features or abstractions.
3. **Surgical Changes** — Touch only what’s needed; don’t “improve” unrelated code.
4. **Goal-Driven Execution** — Define success criteria and verify (e.g. with tests).
5. **Version Control & Auto-Commit** — 3번의 주요 요청마다 버전을 업데이트(Patch)하고, 작업 내용을 요약하여 자동으로 커밋합니다.

---

## 상속인 컬럼 배치 규정

### 왼쪽 기준 (0px ~ 530px+)
1. **드래그 핸들**: 왼쪽 끝에서 **10px** 지점 (너비 20px)
2. **상태 토글**: 핸들에서 **20px** 오른쪽 (너비 28px)
3. **성명 입력**: 토글에서 **30px** 오른쪽 (너비 96px)
4. **관계 선택**: 성명에서 **30px** 오른쪽 (너비 96px)
5. **사망여부/일자**: 관계에서 **50px** 오른쪽 (너비 150px)

### 오른쪽 기준 (우측 끝 0px부터 역순)
8. **삭제 버튼**: 오른쪽 끝에서 **10px** 지점 (마진 10px)
7. **재/대습상속 버튼**: 삭제 버튼으로부터 왼쪽으로 **25px** 지점 (간격 25px)
6. **특수조건(가감산)**: 재/대습상속 버튼으로부터 왼쪽으로 **30px** 지점 (간격 30px)

---

## 작업 지침 (Project Specific)
- 모든 답변과 코드 주석, 설명은 **한국어**로 작성합니다.
- UI 수정 시 요청받은 **정밀한 픽셀 단위 간격**을 엄격히 준수합니다.
- 기존의 레이아웃 구조를 최대한 유지하면서 필요한 부분만 **Surgical(외과수술적)**하게 수정합니다.
- 버전업 시 `App.jsx` 상단의 버전 문자열을 함께 갱신합니다.
- 현재 버전: v1.8.4
