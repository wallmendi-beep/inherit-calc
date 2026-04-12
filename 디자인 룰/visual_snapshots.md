# 📸 상속지분 계산기 디자인 스냅샷 (v1.0)

이 문서는 AI가 코드를 수정할 때 절대 변질되어서는 안 되는 **디자인 원형(Truth)**을 박제한 것입니다.

---

## 1. 특수조건 뱃지 토글 (Hoju / Register)

슬라이더(Sliding Knob) 방식이 아닌, **뱃지(캡슐) 자체가 클릭 시 반전되는 형태**를 유지해야 합니다.

```jsx
// [InheritDesign.jsx]
export const BadgeToggle = ({ active, onToggle, activeLabel, inactiveLabel, isInferred = false }) => {
  const currentLabel = active ? activeLabel : inactiveLabel;
  const inferredClass = "border-blue-400 bg-blue-50/50 text-blue-700";
  const standardClass = active 
    ? "border-neutral-400 bg-neutral-100 text-[#37352f]" 
    : "border-[#e5e5e5] bg-[#f8f8f7] text-[#a3a3a3]";

  return (
    <button
      className={`px-3 py-1 rounded-full border text-[11px] font-black ... ${isInferred ? inferredClass : standardClass}`}
      onClick={() => onToggle(!active)}
    >
      {currentLabel}
    </button>
  );
};
```

---

## 2. 배율 뱃지 (Multiplier Badge)

디자인 룰 제 66조에 따라 **`[]` 형태(사각 직사각형)**를 유지해야 합니다.

```jsx
// [InheritDesign.jsx]
export const MultiplierBadge = ({ multiplier }) => {
  // rounded-full(동그라미)이 아님! rounded-[3px](사각) 필수
  const baseClass = "px-1.5 py-0.5 rounded-[3px] border text-[10px] font-black ...";
  // 감산: rose, 가산: sky 스타일 고정
};
```

---

## 3. UI 정렬 수치 (Fixed Layout)

`HeirRow.jsx`의 수평 정렬을 위한 여백 값입니다. (Rule 55-63)

- **Drag**: `ml-[10px]`
- **Main Toggle**: `ml-[20px]`
- **Name**: `ml-[50px]`
- **Relation**: `ml-[30px]`
- **Death**: `ml-[30px]`
- **Special**: `ml-[10px]`
- **Delete**: `ml-[30px] mr-[20px]`
