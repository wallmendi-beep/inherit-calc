# 빈상태 안내 및 불러오기 부모 해석 규칙

## 목적
- 빈상태 안내 문구와 `불러오기` 버튼이 서로 다른 부모 기준을 보는 문제를 방지한다.
- 현재 탭에서 보이는 안내와 실제 불러오기 결과가 어긋나지 않도록 한다.

## 확인된 문제
1. `InputPanel`의 빈상태 안내는 `resolvedParentNode`를 기준으로 계산하도록 개선되었으나,
2. `불러오기(handleAutoFill)`는 여전히 `activeTabObj.parentNode` 스냅샷을 기준으로 후보를 찾고 있었다.
3. 그 결과 현재 트리 상태와 탭 생성 당시 parent snapshot이 달라진 경우:
   - 안내에는 자동분배 대상이 보이는데
   - `불러오기`는 무반응이거나 `불러올 상속인이 없습니다.`가 뜨는 불일치가 발생할 수 있었다.

## SSOT 규칙
1. 빈상태 안내와 `불러오기`는 **같은 부모 기준**을 사용해야 한다.
2. 부모 기준은 `activeTabObj.parentNode`의 오래된 스냅샷이 아니라,
   **현재 `tree`에서 다시 찾은 실제 부모 노드(`resolvedParentNode`)**가 우선이다.
3. `activeTabObj.parentNode`는 fallback 용도로만 사용한다.
4. 배우자 탭, 형제자매 탭, 차순위 자동분배 안내 모두 같은 `parentHeirsForGuide`를 기준으로 계산한다.

## 구현 기준
- `src/components/InputPanel.jsx`
  - `findParentNode(tree, currentNode.id, currentNode.personId)`로 현재 실제 부모를 재탐색
  - `resolvedParentNode?.heirs || []`를 `parentHeirsForGuide`로 사용
  - `getEmptyStateGuide()`와 `handleAutoFill()` 모두 `parentHeirsForGuide`를 공통 사용

## 효과
- 구수명처럼 상위 배우자 탭에서도 안내와 불러오기 결과가 일치한다.
- 탭이 오래 열려 있었거나 중간 편집이 있었어도 현재 트리 기준으로 정확한 자녀/형제자매 후보를 사용한다.

## 점검 체크리스트
- 같은 탭에서 안내에 보이는 자동분배 후보와 불러오기 후보가 서로 일치하는가
- 현재 트리를 수정한 뒤에도 오래 열린 탭의 불러오기 버튼이 정상 동작하는가
- 배우자 탭/형제자매 탭/차순위 안내가 모두 같은 부모 기준으로 계산되는가

