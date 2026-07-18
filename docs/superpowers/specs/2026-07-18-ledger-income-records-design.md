# 날짜별 거래 내역과 수입 항목 설계

## 목표

최근 지출 목록을 이미지 예시처럼 날짜별로 묶인 거래 내역으로 바꾼다. 거래 내역은 지출 `-` 항목뿐 아니라 수입 `+` 항목도 함께 보여준다.

현재 `수입 추가`와 `전월 이월`은 월 수입 숫자에 바로 더하는 동작이다. 앞으로는 이 동작을 별도 수입 항목으로 저장해 가계부에 반영한다. 사용자는 월별 총수입이 왜 늘었는지 거래 내역에서 확인할 수 있어야 한다.

## 선택한 방향

기존 지출 구조는 유지하고, 새 수입 항목 구조를 추가한다.

- `expenses`: 기존 지출 `-` 항목
- `income_records`: 새 수입 `+` 항목
- `month_incomes`: 기존 월 기본 수입

월 수입 input은 “기본 수입” 역할을 계속 가진다. `수입 추가`, `전월 이월`, 환급, 기타 입금은 `income_records`에 별도 거래로 저장한다.

이 방식은 하나의 통합 `transactions` 테이블로 갈아엎는 것보다 작게 시작할 수 있다. 기존 지출 추가/수정/삭제 흐름을 많이 유지하면서, 필요한 `+` 항목만 확장한다.

## 데이터 모델

새 타입을 추가한다.

```ts
export type IncomeCategoryId = 'salary' | 'side' | 'carryOver' | 'refund' | 'transfer' | 'other';

export interface IncomeRecord {
  id: string;
  date: string;
  month: string;
  categoryId: IncomeCategoryId;
  amount: number;
  memo: string;
  createdAt?: string;
}
```

`BudgetData`는 다음 필드를 가진다.

```ts
export interface BudgetData {
  version: 1;
  months: Record<string, MonthRecord>;
  expenses: Expense[];
  incomeRecords: IncomeRecord[];
  personRecords: PersonMoneyRecord[];
}
```

이전 백업 JSON에 `incomeRecords`가 없으면 빈 배열로 보정한다.

## Supabase 구조

새 테이블 `income_records`를 추가한다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 기본키 |
| `user_id` | `uuid` | 로그인 사용자 |
| `date` | `date` | 수입 발생일 |
| `month` | `text` | `YYYY-MM` |
| `category_id` | `text` | 수입 분류 |
| `amount` | `integer` | 0보다 큰 금액 |
| `memo` | `text` | 메모 |
| `created_at` | `timestamptz` | 생성 시각 |
| `updated_at` | `timestamptz` | 수정 시각 |

`category_id` 허용값은 다음과 같다.

```text
salary, side, carryOver, refund, transfer, other
```

RLS 정책은 기존 테이블과 동일하게 `auth.uid() = user_id`를 사용한다.

`replace_budget_data` RPC는 `p_income_records` 인자를 추가하고, 가져오기 시 수입 항목도 교체한다. `created_at`이 없으면 해당 수입 항목의 `date`를 timestamp로 사용한다.

## 계산 방식

월 요약 계산을 다음처럼 바꾼다.

```text
월 기본 수입 = month_incomes[selectedMonth].income
월 추가 수입 = income_records 중 selectedMonth 합계
월 총수입 = 월 기본 수입 + 월 추가 수입
월 지출 = expenses 중 selectedMonth 합계
남은 금액 = 월 총수입 - 월 지출
```

기존 화면의 `월 수입` 요약 카드에는 월 총수입을 보여준다. 입력 폼의 월 수입 input은 기본 수입을 수정한다.

## 수입 추가 동작

`수입 추가` 버튼을 누르면 팝업을 표시한다.

```text
수입 추가

날짜      [2026-07-18]
분류      [기타]
금액      [100,000]
메모      [환급]

[취소] [추가]
```

저장하면 `income_records`에 `+` 항목으로 저장한다. 월 기본 수입 숫자는 변경하지 않는다. 저장 후 거래 내역에 `+100,000원`으로 표시되고 월 총수입/남은 금액에 반영된다.

## 전월 이월 동작

`전월 이월` 버튼은 기존처럼 전월 남은 돈을 계산하고 확인 팝업을 표시한다. 확인 시 월 기본 수입에 더하지 않고 수입 항목으로 저장한다.

전월 이월 수입 항목은 다음 값을 사용한다.

- 날짜: 선택 월의 1일
- 분류: `carryOver`
- 금액: 전월 남은 돈
- 메모: `{전월} 잔액 이월`

예를 들어 선택 월이 `2026-07`이면 다음처럼 저장한다.

```text
date: 2026-07-01
categoryId: carryOver
amount: 185000
memo: 2026-06 잔액 이월
```

전월 남은 돈이 0원 이하이면 기존처럼 `이월한 남은 돈이 없습니다`를 표시하고 저장하지 않는다.

## 거래 내역 표시

최근 지출 영역을 `거래 내역`으로 바꾼다.

`expenses`와 `incomeRecords`를 합쳐 화면 전용 `LedgerEntry`로 변환한다.

```ts
type LedgerEntry =
  | { kind: 'expense'; id: string; date: string; amount: number; memo: string; categoryLabel: string; createdAt?: string }
  | { kind: 'income'; id: string; date: string; amount: number; memo: string; categoryLabel: string; createdAt?: string };
```

정렬은 다음 순서를 따른다.

```text
date DESC, createdAt DESC
```

같은 날짜의 항목은 하나의 날짜 그룹으로 묶는다. 날짜 헤더 오른쪽에는 그날 합계를 표시한다.

```text
일 합계 = 해당 날짜 수입 합계 - 해당 날짜 지출 합계
```

금액 표기는 다음을 따른다.

- 지출: `-20,420원`
- 수입: `+100,000원`
- 일 합계가 음수면 `-22,000원`
- 일 합계가 양수면 `+100,000원`
- 0원이면 `0원`

## 수정과 삭제

첫 구현에서는 지출 항목은 기존처럼 수정/삭제를 제공한다. 수입 항목도 수정/삭제를 제공한다.

수입 수정 팝업은 `날짜`, `분류`, `금액`, `메모`를 수정한다. 날짜를 바꾸면 `month`도 새 날짜 기준으로 갱신한다. 금액은 0보다 커야 한다.

전월 이월 항목도 일반 수입 항목처럼 수정/삭제 가능하다. 다만 삭제하면 월 요약에서 이월 금액이 빠진다.

## 모바일 UI 요구사항

모바일 360px, 390px에서 다음을 확인한다.

- 날짜 헤더의 날짜와 일 합계가 겹치지 않는다.
- 긴 메모는 항목 영역 안에서 줄바꿈된다.
- `+100,000원`, `-100,000원` 같은 금액이 오른쪽 밖으로 나가지 않는다.
- 수입/지출 수정 버튼이 모바일에서 줄바꿈되어도 항목을 가리지 않는다.
- 수입 추가/수입 수정 팝업은 작은 화면에서 1열로 쌓인다.

## 테스트

TDD로 다음 동작을 검증한다.

- `incomeRecords`가 없는 기존 JSON을 빈 배열로 보정한다.
- 월 요약에 월 기본 수입과 수입 항목 합계를 모두 반영한다.
- `addIncomeRecord`, `updateIncomeRecord`, `deleteIncomeRecord`가 저장소 성공 후 Pinia 상태를 바꾼다.
- 전월 이월은 선택 월 1일의 `carryOver` 수입 항목으로 저장된다.
- `수입 추가`는 월 기본 수입을 변경하지 않고 수입 항목을 추가한다.
- 거래 내역은 `expenses + incomeRecords`를 합쳐 `date DESC, createdAt DESC`로 정렬한다.
- 거래 내역은 같은 날짜별로 그룹화하고 일 합계를 계산한다.
- 수입 항목은 `+`, 지출 항목은 `-`로 표시한다.
- 수입 수정/삭제 후 월 요약과 거래 내역이 갱신된다.
- 전체 Vitest와 production build가 통과한다.

## 이번 범위에서 제외

- 계좌 간 이체를 별도 양방향 거래로 모델링하는 기능
- 수입/지출 반복 등록
- 수입 통계 전용 탭
- 실시간 동기화
- Spring Boot 백엔드

## Self-Review

- Placeholder scan: 미정 항목이나 임시 문구는 없다.
- Internal consistency: 월 기본 수입은 `month_incomes`, 추가 수입은 `income_records`, 지출은 `expenses`로 역할이 분리된다.
- Scope check: 날짜별 거래 내역과 수입 항목 반영에 집중하며, 계좌 이체/반복 등록/수입 통계는 제외했다.
- Ambiguity check: 전월 이월 날짜, 분류, 메모, 계산 방식, 표시 부호, 수정/삭제 범위를 명시했다.
