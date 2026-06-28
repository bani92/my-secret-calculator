# PWA + IndexedDB + JSON 백업/복원 설계

## 목표

현재 로컬 가계부 앱을 갤럭시 S25에서 앱처럼 설치해 사용할 수 있게 만든다.

서버, 클라우드, 원격 DB는 사용하지 않는다. 데이터는 사용 중인 기기 내부에 저장하고, 기기 간 이동은 JSON 내보내기/가져오기로 처리한다.

## 선택한 방향

이번 구현은 **PWA + IndexedDB + JSON 백업/복원**으로 진행한다.

- PWA는 갤럭시 S25 Chrome에서 홈 화면에 추가해 앱처럼 실행하기 위한 포장이다.
- IndexedDB는 브라우저/설치된 PWA 내부의 로컬 데이터 저장소다.
- JSON 백업/복원은 PC와 폰 사이에서 데이터를 수동으로 옮기는 방법이다.

기존 localStorage 테스트 데이터는 자동 이관하지 않는다.

## 실행 위치와 저장 위치

```text
갤럭시 S25
├─ 실행 위치: Chrome 또는 홈 화면에 추가된 PWA
└─ 저장 위치: 갤럭시 S25 브라우저/PWA의 IndexedDB

PC
├─ 실행 위치: PC 브라우저
└─ 저장 위치: PC 브라우저의 IndexedDB
```

PC IndexedDB와 갤럭시 S25 IndexedDB는 서로 다른 저장소다. 자동 동기화는 없다.

## 사용자 흐름

### 갤럭시 S25에서 설치

1. 사용자가 갤럭시 S25 Chrome에서 배포된 앱 URL을 연다.
2. Chrome 메뉴에서 홈 화면에 추가한다.
3. 홈 화면 아이콘으로 앱을 실행한다.
4. 앱은 서버 없이 기기 내부 IndexedDB에 데이터를 저장한다.

### 데이터 백업

1. 사용자가 `내보내기`를 누른다.
2. 현재 IndexedDB에 있는 `BudgetData`를 JSON 파일로 다운로드한다.
3. 이 파일을 폰/PC/클라우드 드라이브 등에 사용자가 직접 보관한다.

### 데이터 복원

1. 사용자가 `가져오기`를 누른다.
2. JSON 파일을 선택한다.
3. 앱은 기존 `parseBudgetJson` 검증을 통과한 데이터만 IndexedDB에 저장한다.
4. 화면은 가져온 데이터 기준으로 갱신된다.

## 데이터 저장 설계

저장 구조는 단순하게 시작한다.

```text
IndexedDB database: local-budget-app
Object store: budget
Key: current
Value: BudgetData
```

`BudgetData` 전체를 하나의 record로 저장한다.

이 방식은 현재 앱 규모에 적합하다. 월별/항목별 검색을 IndexedDB 쿼리로 직접 수행하지 않고, 앱이 전체 데이터를 불러온 뒤 Vue/Pinia computed로 계산한다.

## 저장소 인터페이스 변경

현재 저장소 인터페이스는 동기식이다.

```ts
load(): BudgetData;
save(data: BudgetData): void;
```

IndexedDB는 비동기 API라서 저장소 인터페이스를 다음처럼 바꾼다.

```ts
load(): Promise<BudgetData>;
save(data: BudgetData): Promise<void>;
```

Pinia store는 앱 시작 시 비동기 초기화를 수행한다.

```text
앱 시작
→ store 생성
→ IndexedDB에서 BudgetData load
→ 로딩 중이면 짧은 로딩 상태 표시
→ 로딩 완료 후 입력/대시보드/통계/사람 탭 사용
```

## localStorage 자동 이관 제외

기존 localStorage 데이터는 테스트용 데이터로 보고 자동 이관하지 않는다.

IndexedDB에 데이터가 없으면 `createEmptyBudgetData()`로 빈 데이터를 시작한다.

기존 데이터를 살리고 싶을 때는 사용자가 JSON 백업 파일을 가져오면 된다.

## PWA 설계

PWA에 필요한 최소 요소를 추가한다.

- `manifest.webmanifest`
- 앱 이름: `로컬 가계부`
- 짧은 이름: `가계부`
- 시작 URL: `/`
- 표시 모드: `standalone`
- 테마 색상: 기존 Ocean Blue 계열 `#2864a6`
- 배경 색상: 기존 배경색 `#eef4f7`
- 앱 아이콘: `192x192`, `512x512`
- service worker: 빌드 결과물을 캐시해 기본 오프라인 실행을 지원

외부 PWA 플러그인은 첫 구현에서는 사용하지 않는다. Vite 앱에 필요한 정적 파일과 service worker를 직접 추가한다.

## 범위

이번 범위에 포함한다.

- PWA 설치 가능 상태 만들기
- 앱 아이콘 파일 추가
- service worker 등록
- 기본 앱 shell 캐싱
- IndexedDB 저장소 추가
- 저장소 인터페이스 비동기화
- JSON 내보내기/가져오기 유지
- IndexedDB 저장 테스트
- 기존 앱 동작 회귀 테스트

이번 범위에서 제외한다.

- localStorage 자동 이관
- PC와 폰 자동 동기화
- Spring Boot 서버
- 클라우드 DB
- 로그인
- 다중 기기 충돌 해결
- IndexedDB 내부에 월별/지출별 여러 object store 분리

## 기존 기술과 비교

### localStorage와 IndexedDB

localStorage는 JavaScript 객체를 문자열로 저장하는 단순 저장소다. 지금 앱처럼 작은 데이터에는 쉽지만, 용량과 구조 확장성이 제한적이다.

IndexedDB는 브라우저 안의 작은 로컬 DB에 가깝다. Java/Spring에서 DB 접근이 비동기 I/O를 포함하는 것처럼, 프론트엔드에서도 IndexedDB 접근은 비동기로 다뤄야 한다.

이번 앱에서는 IndexedDB를 복잡한 관계형 DB처럼 쓰지 않고, `BudgetData` 전체를 하나의 값으로 저장한다. 이렇게 하면 localStorage와 비슷한 단순함을 유지하면서 PWA 로컬 저장소로 확장할 수 있다.

### Spring Boot 서버와 PWA 로컬 저장

Spring Boot + DB를 쓰면 PC와 폰이 같은 서버를 바라보게 만들 수 있다. 자동 동기화와 계정 기반 접근이 가능하지만, 서버 운영과 보안, 배포, 비용 문제가 생긴다.

PWA + IndexedDB는 서버가 없다. 데이터가 각 기기 안에만 있으므로 월 비용이 없고 구현도 작다. 대신 자동 동기화는 없다.

## 테스트 전략

TDD로 진행한다.

- `IndexedDbBudgetRepository`가 빈 DB에서 빈 `BudgetData`를 반환하는지 테스트한다.
- 저장 후 다시 load하면 같은 `BudgetData`가 반환되는지 테스트한다.
- 잘못된 저장 데이터가 있으면 빈 데이터로 복구되는지 테스트한다.
- store가 비동기 초기화 후 기존 입력/대시보드/통계/사람 흐름을 유지하는지 테스트한다.
- JSON 가져오기 후 IndexedDB에 저장되고 화면이 갱신되는지 테스트한다.
- 빌드 결과에 manifest와 service worker가 포함되는지 확인한다.

## 검증 기준

- `npm run test` 통과
- `npm run build` 통과
- 브라우저에서 앱 첫 실행 시 빈 데이터로 시작
- 지출/수입/사람 기록 저장 후 새로고침해도 유지
- JSON 내보내기/가져오기 동작 유지
- 갤럭시 S25 Chrome에서 홈 화면 추가 가능
- 설치 후 standalone 창에서 앱 실행 가능

## 후속 확장

PWA + IndexedDB가 안정화된 뒤 다음을 검토할 수 있다.

- 백업 파일 자동 이름에 기기/시각 정보 추가
- IndexedDB 데이터 초기화 버튼
- localStorage 수동 가져오기 도구
- Spring Boot + DB 기반 자동 동기화
- 클라우드 저장소 연동

## Self-Review

- Placeholder scan: `TBD`, `TODO`, 미정 항목은 없다.
- Internal consistency: 서버/클라우드 없음, 자동 이관 없음, JSON 수동 이동이라는 방향이 문서 전체에서 일관된다.
- Scope check: PWA 설치와 IndexedDB 저장소 전환까지가 한 구현 계획으로 다룰 수 있는 범위다.
- Ambiguity check: 기존 localStorage 데이터는 자동 이관하지 않는다고 명시했다.
