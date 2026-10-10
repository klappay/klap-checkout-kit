import type {
  AcceptedPayment,
  ChargeFeePayer,
  ChargeStatus,
  ConfirmationProgress,
  Environment,
  Network,
  SettlementStatus,
  SwapAlternative,
} from '@klappay/types'
import { EVM_NETWORKS } from '@klappay/types/constants'
import type { EvmNetwork } from '@klappay/types/constants'

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
  amountExact: string | null
  feePayer: ChargeFeePayer
  feePercent: number
  feeAmount: number
  merchantAmount: number
  amountReceived: number | null
  amountReceivedExact: string | null
  isOverpaid: boolean
  paymentUnavailable: boolean
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
  tokenSenders: string[]
  userOperationSenders: string[]
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

export function isEvmNetwork(network: Network): network is EvmNetwork {
  return EVM_NETWORKS.some((evmNetwork) => evmNetwork === network)
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
