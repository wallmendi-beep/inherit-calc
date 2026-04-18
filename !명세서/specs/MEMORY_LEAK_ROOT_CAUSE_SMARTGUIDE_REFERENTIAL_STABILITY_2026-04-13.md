# 메모리 누수 원인 분석 - SmartGuide 참조 안정성 (2026-04-13)

## 배경
- 앱이 장시간 사용 중 메모리를 수 GB 단위로 계속 점유하다가 결국 멈추는 현상이 발생했다.
- 원인 추적 결과, `smartGuides`와 `checkedGuideKeys` 사이의 무한 리렌더 루프가 핵심 원인 중 하나로 확인되었다.

## 문제 구조

### 1. 매 렌더마다 새 배열 생성
- `guideInfo.smartGuides`를 인라인 spread/배열 변환으로 매 렌더마다 새 배열 참조로 만들고 있었다.
- 예:

```js
const rawSmartGuides = [...(guideInfo.smartGuides || [])];
const smartGuides = Array.from(uniqueGuidesMap.values());
```

- 내용이 같아도 참조가 매번 바뀌므로 `useEffect([smartGuides])`가 계속 다시 실행된다.

### 2. useEffect 안에서 새 Set 반환
- `setCheckedGuideKeys(() => new Set(...))` 패턴이 들어가 있었다.
- `Set`은 내용이 같아도 참조가 다르면 React는 새로운 상태로 본다.
- 즉, 같은 체크 상태라도 `new Set(...)`을 반환하면 리렌더가 발생한다.

### 3. 결과 루프
- 새 `smartGuides` 배열 생성
- `useEffect([smartGuides])` 재실행
- 새 `Set` 생성 후 상태 갱신
- 리렌더 발생
- 다시 새 배열 생성

이 루프가 매우 빠르게 반복되면서 메모리와 CPU 사용량이 폭증했다.

## 수정 원칙

### 1. 참조 안정성 유지
- `smartGuides`는 `useMemo`로 감싸서 실제 원본이 바뀔 때만 새 배열을 생성한다.

### 2. 동일 상태면 이전 참조 반환
- `setCheckedGuideKeys()` 안에서 내용이 동일하면 `prev`를 그대로 반환한다.
- 즉, “내용이 같으면 상태도 안 바뀐 것”으로 취급한다.

### 3. 비활성 상태는 상수 반환
- `useSmartGuide()`가 비활성 상태일 때는 `{}`나 `[]` 리터럴을 새로 만들지 않는다.
- 모듈 레벨 `EMPTY_GUIDE_STATE` 같은 상수 객체를 반환한다.

## 재발 방지 규칙
1. `useEffect` 의존성에 들어가는 배열/객체는 가능하면 `useMemo`로 안정화한다.
2. `Set`, `Map`, 배열, 객체를 상태로 다룰 때는 “내용 동일 시 이전 참조 반환”을 기본 원칙으로 둔다.
3. 비활성 경로에서 `{}`, `[]`, `new Set()`을 매 렌더마다 생성하지 않는다.
4. 스마트 가이드/검수/요약처럼 트리 전체를 다루는 파생 데이터는 항상 참조 안정성을 먼저 점검한다.

## 분류
- 이 이슈는 법리 계산 오류가 아니라 **React 상태관리의 참조 안정성 버그**이다.
