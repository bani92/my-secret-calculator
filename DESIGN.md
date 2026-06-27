# 로컬 가계부 디자인 시스템

## 방향

개인 기록용 앱이므로 빠른 입력, 낮은 피로도, 명확한 숫자 가독성을 우선한다. 첫 화면은 모바일 입력 중심이며, 월별 분석은 별도 대시보드 탭에서 제공한다.

선택된 팔레트는 `오션 블루 + 코퍼`다.

## 색상 토큰

```css
:root {
  --color-bg: #eef4f7;
  --color-surface: #ffffff;
  --color-surface-strong: #e6eef5;
  --color-line: #ccd8e1;
  --color-text: #17212b;
  --color-muted: #637083;
  --color-primary: #2864a6;
  --color-primary-soft: #e6f0fb;
  --color-accent: #d08b45;
  --color-danger: #c44536;
}
```

## 형태와 간격

```css
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --touch-target: 44px;
}
```

## 타이포그래피

- 기본 폰트: Pretendard
- 숫자와 금액은 굵게 표시한다.
- 본문 텍스트는 16px 이상을 기본으로 한다.
- 작은 보조 텍스트도 대비 4.5:1 이상을 목표로 한다.

## 컴포넌트 원칙

- 탭은 `입력`, `대시보드`, `사람` 순서로 둔다.
- 버튼 높이는 최소 44px로 둔다.
- 카드 반경은 8px 이하로 유지한다.
- 카드는 반복 항목, 요약 수치, 독립된 입력 영역처럼 실제로 구분이 필요한 곳에만 사용한다.
- placeholder를 label 대체로 쓰지 않는다.
- 장식용 아이콘, 장식용 그라데이션, 의미 없는 그림자는 사용하지 않는다.

## 반응형 원칙

- 모바일: 입력 흐름이 최우선이다.
- 태블릿: 요약과 목록을 1-2열로 자연스럽게 배치한다.
- 데스크톱: 대시보드는 넓은 정보 확인 화면으로 사용한다.
