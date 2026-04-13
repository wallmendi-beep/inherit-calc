# 변경로그 기반 이력/오토세이브 규칙 (2026-04-13)

## 목적
- 대형 사건에서 전체 `vault` 스냅샷을 반복 저장하면서 메모리가 과도하게 커지는 문제를 줄인다.
- 사용자가 어떤 조작을 했는지 추적 가능한 구조를 만든다.
- 나중에 백서, 감리, 회귀 점검 시 변경 이력을 설명 가능한 형태로 남긴다.

## 기본 원칙
1. 전체 스냅샷 히스토리는 최소한으로 유지한다.
2. 사용자 조작은 가능한 한 `의미 단위 action log`로 남긴다.
3. 오토세이브는 전체 트리보다 `changeLog` 중심으로 가볍게 저장한다.
4. 최종 저장 파일은 여전히 최종 합성 결과(JSON fact tree)만 저장한다.

## 현재 1차 구현 상태

### 1. undo/redo 스냅샷 제한
- `vaultState.history`는 최대 `10`개까지만 유지한다.
- 과거의 `50`개 스냅샷 구조는 메모리 사용량이 너무 커서 중단한다.

### 2. 변경로그(action log)
- 앱은 별도 `changeLog` 상태를 유지한다.
- 각 로그는 아래 구조를 기본으로 한다.

```json
{
  "at": "2026-04-13T12:34:56.789Z",
  "type": "updateDeathInfo",
  "...": "action payload"
}
```

- 변경로그는 최대 `300`개까지만 유지한다.
- 오래된 로그는 앞에서부터 버린다.

### 3. 변경로그 기록 대상
- 아래 조작은 모두 변경로그에 남긴다.
  - `handleQuickSubmit`
  - `handlePersonAction`
  - `handleRootUpdate`
  - `addHeir`
  - `removeHeir`
  - `appendResolvedHeirs`
  - `removeAllHeirs`

### 4. 오토세이브
- `changeLog`는 `localStorage`에 임시 저장한다.
- 저장 키:
  - `inheritance-calc-action-log-v1`
- 저장 내용:
  - `updatedAt`
  - `caseNo`
  - `decedentName`
  - `changeLog`
- 디바운스:
  - `800ms`

## clone 정책
- 깊은 복사는 가능하면 `structuredClone`을 우선 사용한다.
- 브라우저가 지원하지 않으면 `JSON.parse(JSON.stringify(...))`로 폴백한다.

## 비교 계산 최적화
- `호주가산 미반영 비교 계산`은 모든 탭에서 항상 만들지 않는다.
- `calc`, `result`, `summary` 탭에서만 생성한다.
- 입력 탭에서는 불필요한 비교 계산을 만들지 않는다.

## import 검수 재계산 정책
- `importIssues` 재검사는 입력 탭에서만 수행한다.
- 즉시 재검사 대신 `250ms debounce`를 사용한다.
- 큰 배열 비교를 위해 무거운 `JSON.stringify` 전수 비교는 사용하지 않는다.
- 대신 `code/personId/nodeId/targetTabId/message` 기반 `signature` 비교를 사용한다.

## 향후 2차 목표
1. `baseVault + actionLog + redoLog` 구조로 더 전환한다.
2. undo/redo를 전체 스냅샷 대신 action replay 방식으로 줄인다.
3. 오토세이브도 필요시 `base + changeLog` 복구 구조로 확장한다.
4. `useSmartGuide` 전체 트리 순회 비용을 별도 최적화한다.

## 주의
- 현재 구현은 “완전한 action-replay history”가 아니라 “스냅샷 축소 + 변경로그 병행” 1차 단계다.
- 따라서 저장/복구/undo는 아직 완전한 이벤트 소싱 구조가 아니다.
- 그러나 메모리 폭증을 줄이기 위한 실무적 중간 단계로 채택한다.
