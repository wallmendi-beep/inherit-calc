# 🎨 상속지분 계산기 PRO v4.0 디자인 시스템 (UDS)

이 문서는 앱의 시각적 일관성을 유지하고 '전문적 신뢰감'을 확보하기 위한 최종 디자인 헌법입니다. 모든 컴포넌트는 아래 정의된 토큰만을 사용합니다.

## 1. 전역 컬러 팔레트 (Color Palette)

사용자가 지정한 **Deep Navy(#1e56a0)**를 핵심 정체성으로 삼으며, 노션(Notion) 스타일의 무채색을 보조로 활용합니다.

| 이름 | 토큰 (CSS/HEX) | 텍스트 (Deep) | 배경 (Soft) | 용도 |
| :--- | :--- | :--- | :--- | :--- |
| **Deep Navy (Key)** | `#1e56a0` | `#1e56a0` | `#edf4ff` | **강조 수치(상속지분)**, 활성 탭, 주요 아이콘 |
| **Neutral** | `#37352f` | `#37352f` | `#ffffff` | 기본 텍스트, 페이지 상단 헤더, 본문 카드 |
| **Muted** | `#787774` | `#787774` | `#f1f1ef` | 보조 설명, 테두리(`border-[#e9e9e7]`), 비활성 배경 |
| **Alert (Emoji)** | - | 🚫 / ❌ | `bg-neutral-50` | 계산불가, 필수 확인 항목 |
| **Warning (Emoji)**| - | ⚠️ / 🟡 | `bg-neutral-50` | 주의사항, 수동 확인 힌트 |

## 2. 타이포그래피 (Typography)

- **Standard Font**: **Pretendard**, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Watermark**: "Designed by J.H. Lee" (Cursive 필기체 스타일 유지)
- **Hierarchy**:
    - 활성 지분 분수: `text-[17px]` (헤더), `text-[11px]` (리스트), **font-black**, **#1e56a0** 고정.
    - 보조 정보: `text-[12px]`, `text-[#787774]` (회색 90% 명도).

## 3. 레이아웃 헌법 (Layout Consts)

- **고정 레이아웃 원칙**: 모바일 지원보다는 전문가용 데스크톱 환경의 안정성을 우선함.
- **Main Deck Width**: **1080px 고정** (화면 축소 시에도 깨지지 않고 가로 스크롤 발생).
- **Smart Guide Width**: **310px 고정** (본문 공간 확보를 위해 기존 360px에서 축소).
- **Gap & Offset**: 가이드와 헤더 사이 **30px** 여유 공간 확보 (가이드 시작점: `top-102px`).

## 4. 시각적 금기 사항 (Anti-Patterns)

- [ ] `animate-pulse` 등 불필요한 깜빡임 금지.
- [ ] 빨간색/노란색 등 원색 배경 카드 지양 (반드시 `neutral-50` 무채색 배경 사용).
- [ ] 가이드 패널 내 텍스트 배지 금지 (반드시 간결한 **이모지** 배지 사용).

---
> [!IMPORTANT]
> **워터마크 정책**: 워터마크는 절대 `fixed`로 배치하지 않으며, 메인 컨텐츠 카드의 하단(`absolute bottom-1 right-8`)에 배치하여 본문과 함께 탄력적으로 움직여야 합니다.
