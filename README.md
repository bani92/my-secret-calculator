# 로컬 가계부

브라우저 안에서만 데이터를 저장하는 개인용 가계부 PWA입니다. 서버, 로그인, 클라우드 동기화 없이 수입과 지출을 기록하고 월별 대시보드, 통계, 캘린더, 사람별 정산 기록을 확인할 수 있습니다.

## 주요 기능

- 월 수입과 일일 지출 기록
- 월별 대시보드와 카테고리별 지출 요약
- 년도/월별 지출 통계와 항목 필터
- 월간 지출 캘린더
- 사람별 받을 돈/줄 돈 기록
- 브라우저 IndexedDB 저장
- JSON 백업 내보내기/가져오기
- PWA 설치용 manifest, service worker, 아이콘 포함

## 데이터 저장 방식

이 앱은 별도 백엔드가 없습니다.

```text
사용자 브라우저
  └─ IndexedDB
      └─ local-budget-app / budget / current
```

데이터는 사용자의 브라우저에만 저장됩니다. 다른 기기와 자동 동기화되지 않으므로, 기기를 바꾸거나 브라우저 데이터를 삭제하기 전에는 JSON 내보내기로 백업하세요.

## 기술 스택

- Vue 3
- Vite
- TypeScript
- Pinia
- Vitest
- IndexedDB
- Web App Manifest / Service Worker

## 로컬 실행

```bash
npm install
npm run dev
```

기본 개발 서버 주소는 다음과 같습니다.

```text
http://127.0.0.1:5173/
```

## 테스트와 빌드

```bash
npm run test
npm run build
```

빌드 결과물은 `dist/`에 생성되며, 저장소에는 커밋하지 않습니다.