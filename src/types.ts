import type {
  AcceptedPayment,
  ChargeFeePayer,
  ChargeStatus,
  ConfirmationProgress,
  Environment,
  SettlementStatus,
  SwapAlternative,
} from '@klappay/types'

export type PaymentOption = AcceptedPayment & {
  chainId: number | null
  contractAddress: string | null
  amountUnits: string
}

export type CheckoutPayload = {
  id: string
  status: ChargeStatus
  settlementStatus: SettlementStatus | null
  amount: number
  feePayer: ChargeFeePayer
  feePercent: number
  feeAmount: number
  merchantAmount: number
  amountReceived: number | null
  isOverpaid: boolean
  currency: string
  environment: Environment
  address: string
  expiresAt: string
  redirectUrl: string | null
  paidWith: AcceptedPayment[]
  paymentOptions: PaymentOption[]
  swapAlternatives: SwapAlternative[]
}

export type CheckedCheckoutPayload = CheckoutPayload & {
  transactionSender: string | null
  confirmationProgress: ConfirmationProgress | null
}

export type CheckoutEvent =
  | { type: 'charge'; payload: CheckoutPayload }
  | { type: 'confirmation_progress'; progress: ConfirmationProgress }

export const OPEN_STATUSES: ReadonlySet<ChargeStatus> = new Set(['pending', 'partially_paid'])

export function isOpenStatus(status: ChargeStatus): boolean {
  return OPEN_STATUSES.has(status)
}

export function isWalletPayable(option: PaymentOption): boolean {
  return option.chainId !== null && option.contractAddress !== null
}

export type {
  AcceptedPayment,
  AltToken,
  Charge,
  ChargeFeePayer,
  ChargeStatus,
  CheckChargeRequest,
  ConfirmationProgress,
  CreateSwapQuoteInput,
  Environment,
  Network,
  SettlementStatus,
  SwapAlternative,
  SwapQuote,
  Token,
} from '@klappay/types'
