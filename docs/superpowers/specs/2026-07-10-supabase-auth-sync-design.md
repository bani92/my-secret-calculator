# Supabase 인증 및 가계부 동기화 설계

## 목표

Vercel에 배포된 가계부를 집 밖에서도 사용하고, PC와 휴대폰이 동일한 데이터를 보도록 저장소를 브라우저의 IndexedDB에서 Supabase로 전환한다.

앱은 Supabase에 미리 생성한 단일 계정으로 로그인해야만 사용할 수 있다. 모든 데이터 행은 로그인 사용자 ID를 소유자로 가지며, Row Level Security(RLS)가 다른 사용자와 비로그인 요청의 접근을 차단한다.

기존 로컬 가계부 데이터는 이전하지 않고 빈 Supabase 가계부로 시작한다.

## 선택한 방향

기능별로 정규화한 3개 테이블과 `user_id` 기반 RLS를 사용한다.

- 월 수입은 `month_incomes`에 저장한다.
- 지출은 `expenses`에 저장한다.
- 빌려준 돈과 빌린 돈은 `person_money_records`에 저장한다.
- 모든 행은 `auth.users.id`를 참조하는 `user_id`를 가진다.
- 회원가입 UI는 제공하지 않고 이메일/비밀번호 로그인과 로그아웃만 제공한다.
- 앱에는 Publishable key만 포함하고 Secret key는 사용하지 않는다.
- 첫 버전에는 실시간 구독을 추가하지 않는다. 앱 실행 또는 새로고침 시 최신 데이터를 다시 불러온다.

## 데이터베이스 구조

### `month_incomes`

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| `user_id` | `uuid` | `auth.users(id)` 참조, `not null`, 기본값 `auth.uid()` |
| `month` | `text` | `not null`, `YYYY-MM` 형식 |
| `income` | `integer` | `not null`, 0 이상 |
| `created_at` | `timestamptz` | `not null`, 기본값 `now()` |
| `updated_at` | `timestamptz` | `not null`, 기본값 `now()` |

기본키는 `(user_id, month)` 복합키로 구성한다. 사용자마다 같은 월의 수입을 하나씩 가질 수 있다.

### `expenses`

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| `id` | `uuid` | 기본키 |
| `user_id` | `uuid` | `auth.users(id)` 참조, `not null`, 기본값 `auth.uid()` |
| `date` | `date` | `not null` |
| `month` | `text` | `not null`, `YYYY-MM` 형식 |
| `category_id` | `text` | `not null` |
| `amount` | `integer` | `not null`, 0 초과 |
| `memo` | `text` | `not null`, 기본값 빈 문자열 |
| `created_at` | `timestamptz` | `not null`, 기본값 `now()` |
| `updated_at` | `timestamptz` | `not null`, 기본값 `now()` |

`(user_id, date)` 인덱스를 추가해서 사용자별 날짜 조회를 지원한다.

### `person_money_records`

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| `id` | `uuid` | 기본키 |
| `user_id` | `uuid` | `auth.users(id)` 참조, `not null`, 기본값 `auth.uid()` |
| `date` | `date` | `not null` |
| `person_name` | `text` | `not null` |
| `direction` | `text` | `receivable` 또는 `payable` |
| `amount` | `integer` | `not null`, 0 초과 |
| `memo` | `text` | `not null`, 기본값 빈 문자열 |
| `settled` | `boolean` | `not null`, 기본값 `false` |
| `created_at` | `timestamptz` | `not null`, 기본값 `now()` |
| `updated_at` | `timestamptz` | `not null`, 기본값 `now()` |

`(user_id, date)` 인덱스를 추가한다.

Supabase 테이블은 비어 있으므로 기존 시험용 정책과 테이블을 정리한 뒤 위 구조로 다시 생성하는 SQL 스크립트를 제공한다. SQL 실행은 사용자가 Supabase SQL Editor에서 수행한다.

## RLS 정책

세 테이블 모두 RLS를 활성화하고 `authenticated` 역할에만 접근을 허용한다.

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

이 조건은 다음 동작을 보장한다.

- 비로그인 요청은 행을 조회하거나 변경할 수 없다.
- 로그인 사용자는 자신의 `user_id`를 가진 행만 조회, 생성, 수정, 삭제할 수 있다.
- 클라이언트가 다른 사용자의 `user_id`를 보내도 `with check` 조건 때문에 저장되지 않는다.
- Publishable key가 노출되어도 유효한 로그인 세션과 행 소유권이 없으면 데이터에 접근할 수 없다.

Supabase Authentication의 신규 이메일 가입은 비활성화한다. 계정 생성은 Supabase 대시보드 관리자가 수행한다.

## 클라이언트 구조

### Supabase 클라이언트

`src/lib/supabaseClient.ts`에서 다음 Vite 환경변수로 클라이언트를 한 번 생성한다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

환경변수가 없으면 사용자가 이해할 수 있는 설정 오류를 표시한다. Secret key는 로컬 환경변수와 Vercel 환경변수 어디에도 넣지 않는다.

### 인증 상태

작은 범위를 유지하기 위해 인증 전용 Pinia 스토어가 다음 상태와 동작을 담당한다.

- 초기 세션 확인 중
- 비로그인
- 로그인됨
- 로그인 오류
- 이메일/비밀번호 로그인
- 로그아웃
- Supabase 세션 변경 구독 및 해제

`App.vue`는 인증 확인 중에는 로딩 상태를, 비로그인 상태에는 로그인 폼을 표시한다. 로그인된 경우에만 가계부 스토어를 초기화하고 기존 탭을 표시한다.

회원가입과 비밀번호 재설정 UI는 이번 범위에서 제외한다.

### Supabase 저장소

`SupabaseBudgetRepository`가 Supabase 행과 기존 `BudgetData` 도메인 타입 사이의 변환을 담당한다.

현재의 `save(BudgetData)` 전체 저장 방식은 행 단위 명령으로 변경한다.

- 월 수입 설정: `month_incomes` 한 행 upsert
- 지출 추가: `expenses` 한 행 insert
- 지출 삭제: `expenses` 한 행 delete
- 사람별 기록 추가: `person_money_records` 한 행 insert
- 정산 상태 변경: `person_money_records.settled` 한 행 update
- JSON 가져오기: 현재 사용자 데이터 교체

원격 저장이 성공한 뒤 Pinia의 메모리 상태를 변경한다. 저장이 실패하면 기존 화면 상태를 유지하고 오류 메시지를 표시한다.

행 단위 저장을 사용하므로 한 기기에 남아 있는 오래된 전체 상태가 다른 기기에서 추가한 행을 통째로 덮어쓰지 않는다.

## 데이터 흐름

```text
Vercel의 Vue 앱
  ↓ Publishable key + 로그인 세션 토큰
Supabase Authentication
  ↓ 인증된 사용자 ID
Supabase Data API
  ↓ RLS: auth.uid() = user_id
month_incomes / expenses / person_money_records
  ↓ 조회 결과 변환
Pinia budgetStore
  ↓
가계부 화면
```

앱 시작 흐름은 다음과 같다.

1. Supabase 세션을 확인한다.
2. 세션이 없으면 로그인 화면을 표시한다.
3. 로그인에 성공하면 세 테이블에서 현재 사용자의 데이터를 불러온다.
4. 조회 결과를 `BudgetData`로 변환하고 기존 화면을 표시한다.
5. 입력, 삭제, 정산 작업은 해당 테이블의 행만 변경한다.
6. 로그아웃하면 가계부 메모리 상태를 비우고 로그인 화면으로 돌아간다.

## 동기화 범위

첫 버전은 실시간 동기화가 아니라 서버 중심 영속화를 제공한다.

- 앱을 새로 열거나 새로고침하면 Supabase의 최신 데이터를 가져온다.
- 한 기기에서 저장한 뒤 다른 기기에서 앱을 새로 열면 같은 데이터가 보인다.
- 두 기기가 동시에 열려 있을 때 다른 기기의 변경을 자동 반영하지 않는다.
- 행 단위 저장으로 서로 다른 지출을 추가하는 작업은 전체 데이터 덮어쓰기 없이 저장된다.

실시간 구독은 실제 사용 중 필요가 확인되면 후속 기능으로 추가한다.

## 오류 처리

- 로그인 실패 시 로그인 폼에 일반적인 오류 메시지를 표시한다.
- 세션 확인 실패 시 재시도할 수 있는 상태를 표시한다.
- 초기 데이터 조회 실패 시 기존의 `다시 시도` 동작을 유지한다.
- 원격 저장 실패 시 성공한 것처럼 로컬 화면을 변경하지 않는다.
- 인증 세션이 만료되면 로그인 화면으로 돌아간다.
- Supabase 응답의 내부 상세 내용이나 키는 화면에 노출하지 않는다.

## 테스트

TDD로 다음 동작을 검증한다.

- 로그인 세션 유무에 따라 로그인 화면과 가계부 화면이 전환된다.
- 이메일/비밀번호 로그인과 로그아웃이 호출된다.
- Supabase 테이블 행을 `BudgetData`로 올바르게 변환한다.
- 월 수입 upsert, 지출 insert/delete, 사람별 기록 insert/update가 올바른 테이블과 값으로 요청된다.
- 원격 저장 실패 시 Pinia 상태가 변경되지 않고 오류가 전달된다.
- 로그아웃 시 이전 사용자의 메모리 데이터가 제거된다.
- 기존 JSON 내보내기와 가져오기 기능이 유지된다.
- 전체 Vitest와 TypeScript/Vite 빌드가 통과한다.

RLS 자체는 프론트엔드 단위 테스트만으로 검증할 수 없으므로 Supabase SQL Editor 또는 배포 후 수동 검증으로 확인한다.

## 배포 및 검증

1. Supabase SQL Editor에서 확정된 스키마와 RLS SQL을 실행한다.
2. 로컬에서 로그인, 조회, 저장, 로그아웃을 검증한다.
3. 변경사항을 GitHub에 반영하고 Vercel에서 재배포한다.
4. 휴대폰에서 로그인하고 지출을 추가한다.
5. PC에서 앱을 새로고침해 같은 지출이 보이는지 확인한다.
6. 로그아웃 상태에서 데이터가 보이지 않는지 확인한다.

## 이번 범위에서 제외

- 기존 IndexedDB 데이터 자동 이전
- 회원가입과 비밀번호 재설정 화면
- 실시간 변경 구독
- 여러 사용자 관리 화면
- 오프라인 입력 후 자동 재동기화
- Spring Boot 백엔드

## Self-Review

- Placeholder scan: 미정 항목이나 임시 문구는 없다.
- Internal consistency: 3개 정규화 테이블, 행 단위 저장, `user_id` 기반 RLS가 전체 설계에서 일관된다.
- Scope check: 인증, 저장소 전환, 스키마 및 RLS에 한정되어 있으며 실시간·오프라인 동기화는 제외했다.
- Ambiguity check: 로그인 전후 화면, 테이블별 저장 대상, 동기화 시점, 오류 시 상태 변경 기준을 명시했다.
