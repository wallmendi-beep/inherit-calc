# 사망자 탭 생성 시 배우자 선사망 필터 규칙

## 목적
- 상속권이 없는 선사망 배우자가 독립 사망자 탭으로 생성되는 오류를 막는다.
- 루트 배우자뿐 아니라 중간 단계 배우자에도 같은 기준을 적용한다.

## 핵심 규칙
- 사망자 탭 생성은 `isDeceased` 또는 `lost/disqualified` 예외 상태를 기준으로 검토한다.
- 다만 `배우자(wife / husband / spouse)`가 **현재 부모 상속 단계보다 먼저 사망한 경우**에는 탭 생성 대상에서 제외한다.

## 판정 기준
- `isSpouseNode = relation in [wife, husband, spouse]`
- `parentDeathDate = parentNode.deathDate || root.deathDate`
- `isPredeceasedSpouse = isSpouseNode && node.deathDate < parentDeathDate`
- `isPredeceasedSpouse === true` 이면 사망자 탭을 만들지 않는다.

## 적용 범위
- 루트의 배우자 선사망
- 중간 단계 배우자 선사망
- 예: `김명남의 남편 윤종옥`처럼 하위 탭의 배우자도 동일하게 제외

## 기대 효과
- 상속권이 없는 선사망 배우자로 이동되는 가이드/탭 오류 방지
- 상태 토글과 탭 이동이 실제 상속권 구조와 일치

## 재발 방지 원칙
- 배우자 선사망 예외는 루트 전용 규칙으로 두지 않는다.
- 탭 생성 필터는 항상 `현재 부모 사망일` 기준으로 비교한다.
