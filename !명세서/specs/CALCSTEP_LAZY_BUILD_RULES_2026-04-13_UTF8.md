# calcSteps 지연 생성 규칙 (2026-04-13)

## 목적
- 대형 사건에서 `calculateInheritance()`가 매번 거대한 `calcSteps`를 생성하면서 메모리와 렌더 비용이 급증하는 문제를 줄인다.

## 기본 원칙
1. `calcSteps`는 상세 계산 설명이 실제로 필요한 탭에서만 생성한다.
2. 입력 탭에서는 `finalShares`, `warnings`, `transitShares`, `blockingIssues`만 우선 확보하고, 상세 분배 스텝은 만들지 않는다.
3. 비교 계산(`호주가산 미반영 비교`)은 기본적으로 `calcSteps` 없이 수행한다.

## 구현 기준

### 1. calculateInheritance 옵션
- `calculateInheritance(tree, propertyValue, options)`
- 옵션:
  - `includeCalcSteps`

기본값:
- `includeCalcSteps !== false` 이면 기존처럼 상세 스텝 생성
- `includeCalcSteps === false` 이면 `calcSteps` 생성 생략

### 2. App 탭별 규칙
- 아래 탭에서는 `calcSteps` 생성
  - `calc`
  - `result`
  - `summary`
  - `amount`

- 아래 탭에서는 `calcSteps` 비생성
  - `input`
  - 그 외 상세 계산 설명이 필요 없는 탭

### 3. 비교 계산 규칙
- `호주가산 미반영 비교`는 사람별 결과 차이만 필요하므로 `includeCalcSteps: false`로 계산한다.

## 기대 효과
- 입력 탭 체류 시 메모리 사용량 감소
- 상세 스텝 배열 보관 비용 감소
- 비교 계산의 중복 메모리 사용량 감소

## 주의
- `PrintReport`, `CalcPanel`, `ResultPanel`, `SummaryPanel`은 `calcSteps`가 실제로 필요한 탭에서만 사용하도록 유지한다.
- 입력 탭에서 `calcSteps`가 빈 배열이어도 오류가 나지 않게 컴포넌트 의존성을 관리한다.
