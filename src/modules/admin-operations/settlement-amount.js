import { ConflictError } from "../../classes/errorClasses.js";
import { fromMinorUnits, toMinorUnits } from "../logistics/money.js";

const asMinorUnits = value => BigInt(toMinorUnits(String(value)));

export const assertSellerSettlementWithinSubtotal = (amount, subtotal) => {
  const amountMinor = asMinorUnits(amount?.toString?.() ?? amount);
  const subtotalMinor = asMinorUnits(subtotal?.toString?.() ?? subtotal);
  if (amountMinor <= 0n || amountMinor > subtotalMinor) {
    throw new ConflictError("Seller settlement must be positive and cannot exceed the merchandise subtotal; customer delivery charges are not seller proceeds.");
  }
};

export const resolveSellerSettlementAmount = ({
  amount,
  subtotal,
  hasSucceededRefund = false,
  adjustmentReason,
}) => {
  const subtotalMinor = asMinorUnits(subtotal?.toString?.() ?? subtotal);
  const settlementMinor = amount === undefined
    ? subtotalMinor
    : asMinorUnits(amount?.toString?.() ?? amount);

  if (settlementMinor <= 0n || settlementMinor > subtotalMinor) {
    throw new ConflictError("Settlement amount must be positive and cannot exceed the merchandise subtotal. Customer delivery charges are excluded.");
  }
  if (hasSucceededRefund && (amount === undefined || settlementMinor >= subtotalMinor)) {
    throw new ConflictError("A processed refund requires an explicitly reduced merchandise settlement amount.");
  }
  if ((hasSucceededRefund || settlementMinor < subtotalMinor) && !adjustmentReason?.trim()) {
    throw new ConflictError("An adjustmentReason is required when settlement amount is reduced or refunds have been processed.");
  }

  return fromMinorUnits(settlementMinor);
};
