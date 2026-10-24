/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Hidden Cost Calculator Engine
 * Extracts explicitly stated financial terms (free trials, recurring prices,
 * activation fees, preselected add-ons, surcharges, and cancellation penalties)
 * with verbatim supporting quotes and multi-currency (INR ₹, USD $, EUR €, GBP £) support.
 * Never invents prices, taxes, discounts, or dates.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'UNKNOWN';

export interface StatedFeeItem {
  id: string;
  label: string;
  displayAmount: string;
  numericValue?: number;
  isPercentage: boolean;
  isPreselectedAddon: boolean;
  isConditionalPenalty: boolean;
  evidenceQuote: string;
}

export interface PricingOptionComparison {
  monthlyPrice: number;
  annualPrice: number;
  annualizedMonthlyCost: number;
  differenceAmount: number;
  evidenceQuote: string;
}

export interface HiddenCostEstimate {
  hasCalculableFinancials: boolean;
  hasCalculableRecurringCost: boolean;
  currencySymbol: string;
  currencyCode: CurrencyCode;
  currencyAssumptionNote?: string;
  trialDurationDays?: number;
  trialEvidenceQuote?: string;
  initialPaymentAmount?: number;
  initialPaymentQuote?: string;
  recurringAmount?: number;
  billingFrequency?: 'monthly' | 'annual' | 'weekly';
  recurringEvidenceQuote?: string;
  setupFeeAmount?: number;
  setupFeeQuote?: string;
  preselectedAddonsTotal: number;
  estimatedMonthlyRecurring?: number;
  estimatedAnnualCost?: number;
  statedFees: StatedFeeItem[];
  cancellationConditions: string[];
  refundLimitations: string[];
  pricingComparison?: PricingOptionComparison;
  calculationAssumptions: string[];
}

export interface PeriodProjectionResult {
  months: number;
  baseRecurringTotal: number;
  upfrontAndSetupTotal: number;
  preselectedAddonsIncluded: number;
  estimatedTotalWithoutAddons: number;
  estimatedTotalWithAddons: number;
  formattedTotalWithoutAddons: string;
  formattedTotalWithAddons: string;
}

function parseNumericAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function formatCurrencyAmount(
  amount: number,
  symbol: string,
  code: CurrencyCode
): string {
  const effectiveSymbol = symbol || (code === 'INR' ? '₹' : '$');
  if (code === 'INR' || effectiveSymbol === '₹') {
    const formatted = amount.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `₹${formatted}`;
  }

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${effectiveSymbol}${formatted}`;
}

function detectCurrencyFromToken(token: string): {
  symbol: string;
  code: CurrencyCode;
} {
  const t = token.trim();
  if (t === '₹' || /^rs\.?$/i.test(t) || /^inr$/i.test(t)) {
    return { symbol: '₹', code: 'INR' };
  }
  if (t === '$' || /^usd$/i.test(t)) {
    return { symbol: '$', code: 'USD' };
  }
  if (t === '€' || /^eur$/i.test(t)) {
    return { symbol: '€', code: 'EUR' };
  }
  if (t === '£' || /^gbp$/i.test(t)) {
    return { symbol: '£', code: 'GBP' };
  }
  return { symbol: '', code: 'UNKNOWN' };
}

/**
 * Extracts all verifiable financial figures, trial transitions, and fee clauses from text.
 */
export function extractHiddenCostEstimate(rawText: string): HiddenCostEstimate {
  const cleanText = (rawText || '').replace(/\r\n/g, '\n').trim();
  if (!cleanText) {
    return {
      hasCalculableFinancials: false,
      hasCalculableRecurringCost: false,
      currencySymbol: '',
      currencyCode: 'UNKNOWN',
      preselectedAddonsTotal: 0,
      statedFees: [],
      cancellationConditions: [],
      refundLimitations: [],
      calculationAssumptions: [],
    };
  }

  const sentences = cleanText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  let detectedSymbol = '';
  let detectedCode: CurrencyCode = 'UNKNOWN';

  let trialDurationDays: number | undefined;
  let trialEvidenceQuote: string | undefined;

  let initialPaymentAmount: number | undefined;
  let initialPaymentQuote: string | undefined;

  let recurringAmount: number | undefined;
  let billingFrequency: 'monthly' | 'annual' | 'weekly' | undefined;
  let recurringEvidenceQuote: string | undefined;

  let setupFeeAmount: number | undefined;
  let setupFeeQuote: string | undefined;

  const statedFees: StatedFeeItem[] = [];
  const cancellationConditions: string[] = [];
  const refundLimitations: string[] = [];

  for (const sentence of sentences) {
    // 1. Detect Free Trial Duration
    if (trialDurationDays === undefined) {
      const trialMatch = sentence.match(
        /\b(\d{1,3})\s*[- ]?\s*days?\s+(?:free\s+|introductory\s+)?trial\b/i
      );
      if (trialMatch) {
        trialDurationDays = Number.parseInt(trialMatch[1], 10);
        trialEvidenceQuote = sentence;
        if (/\bfree\s+trial\b/i.test(sentence) && initialPaymentAmount === undefined) {
          initialPaymentAmount = 0;
          initialPaymentQuote = sentence;
        }
      }
    }

    // 2. Detect Recurring Subscription Price & Billing Frequency
    // Matches patterns like:
    // "paid monthly subscription of $29.99"
    // "subscription at ₹999/month" or "₹999 per month" or "Rs. 999 per month"
    // "billed at $199 per year" or "₹4,999/year"
    if (recurringAmount === undefined) {
      const recMatchA = sentence.match(
        /\b(?:paid\s+)?(monthly|annual|yearly|weekly)\s+(?:subscription|membership|plan|fee|rate)\s+(?:of|at|for|priced\s+at)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)/i
      );
      const recMatchB = sentence.match(
        /(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/|\s+per\s+|\s+every\s+|\s+a\s+)(month|mo|year|yr|annum|week|wk)\b/i
      );
      const recMatchC = sentence.match(
        /\b(?:automatically\s+billed|charged|renews\s+at|subscription\s+price\s+of)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)(?:\s*(?:\/|per)\s*(month|mo|year|yr))?/i
      );

      if (recMatchA && !/\b(?:never|no)\s+recurring\b/i.test(sentence)) {
        const freqRaw = recMatchA[1].toLowerCase();
        const curr = detectCurrencyFromToken(recMatchA[2]);
        const amt = parseNumericAmount(recMatchA[3]);
        if (amt > 0) {
          detectedSymbol = detectedSymbol || curr.symbol;
          detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
          recurringAmount = amt;
          billingFrequency =
            freqRaw === 'annual' || freqRaw === 'yearly'
              ? 'annual'
              : freqRaw === 'weekly'
              ? 'weekly'
              : 'monthly';
          recurringEvidenceQuote = sentence;
        }
      } else if (recMatchB && !/\b(?:never|no)\s+recurring\b/i.test(sentence)) {
        const curr = detectCurrencyFromToken(recMatchB[1]);
        const amt = parseNumericAmount(recMatchB[2]);
        const unitRaw = recMatchB[3].toLowerCase();
        if (amt > 0) {
          detectedSymbol = detectedSymbol || curr.symbol;
          detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
          recurringAmount = amt;
          billingFrequency =
            unitRaw === 'year' || unitRaw === 'yr' || unitRaw === 'annum'
              ? 'annual'
              : unitRaw === 'week' || unitRaw === 'wk'
              ? 'weekly'
              : 'monthly';
          recurringEvidenceQuote = sentence;
        }
      } else if (recMatchC) {
        const curr = detectCurrencyFromToken(recMatchC[1]);
        const amt = parseNumericAmount(recMatchC[2]);
        const unitRaw = (recMatchC[3] || 'month').toLowerCase();
        if (amt > 0) {
          detectedSymbol = detectedSymbol || curr.symbol;
          detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
          recurringAmount = amt;
          billingFrequency =
            unitRaw === 'year' || unitRaw === 'yr' ? 'annual' : 'monthly';
          recurringEvidenceQuote = sentence;
        }
      }
    }

    // 3. Detect Setup / Activation / Joining Fees
    if (setupFeeAmount === undefined) {
      const setupMatch = sentence.match(
        /\b(?:setup|activation|onboarding|initiation|registration)\s+(?:fee|charge)\s+of\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)/i
      );
      if (setupMatch) {
        const curr = detectCurrencyFromToken(setupMatch[1]);
        const amt = parseNumericAmount(setupMatch[2]);
        if (amt > 0) {
          detectedSymbol = detectedSymbol || curr.symbol;
          detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
          setupFeeAmount = amt;
          setupFeeQuote = sentence;
        }
      }
    }

    // 4. Detect Preselected Paid Add-ons
    const addonMatchA = sentence.match(
      /\b([A-Za-z\s]{3,35})\s*\((₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)\)\s+has\s+been\s+automatically\s+added/i
    );
    if (addonMatchA) {
      const curr = detectCurrencyFromToken(addonMatchA[2]);
      const amt = parseNumericAmount(addonMatchA[3]);
      detectedSymbol = detectedSymbol || curr.symbol;
      detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
      statedFees.push({
        id: `fee_addon_${statedFees.length + 1}`,
        label: `Preselected ${addonMatchA[1].trim()}`,
        displayAmount: formatCurrencyAmount(amt, curr.symbol, curr.code),
        numericValue: amt,
        isPercentage: false,
        isPreselectedAddon: true,
        isConditionalPenalty: false,
        evidenceQuote: sentence,
      });
    }

    const addonMatchB = sentence.match(
      /\boptional\s+(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)\s+([A-Za-z\s]{3,35}(?:plan|protection|warranty|bundle))\b/i
    );
    if (addonMatchB) {
      const curr = detectCurrencyFromToken(addonMatchB[1]);
      const amt = parseNumericAmount(addonMatchB[2]);
      detectedSymbol = detectedSymbol || curr.symbol;
      detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
      statedFees.push({
        id: `fee_addon_${statedFees.length + 1}`,
        label: `Optional ${addonMatchB[3].trim()}`,
        displayAmount: formatCurrencyAmount(amt, curr.symbol, curr.code),
        numericValue: amt,
        isPercentage: false,
        isPreselectedAddon: true,
        isConditionalPenalty: false,
        evidenceQuote: sentence,
      });
    }

    // 5. Detect Surcharges, Administrative / Restocking Fees, Early Termination Penalties, Liquidated Damages
    const pctSurchargeMatch = sentence.match(
      /\b(surcharge|early\s+termination\s+fee|processing\s+fee|service\s+fee)\s+of\s+(\d{1,2}(?:\.\d+)?)%/i
    );
    if (pctSurchargeMatch) {
      const labelRaw = pctSurchargeMatch[1].trim();
      const pct = Number.parseFloat(pctSurchargeMatch[2]);
      const isPenalty = /termination/i.test(labelRaw);
      statedFees.push({
        id: `fee_pct_${statedFees.length + 1}`,
        label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1),
        displayAmount: `${pct}%`,
        numericValue: pct,
        isPercentage: true,
        isPreselectedAddon: false,
        isConditionalPenalty: isPenalty,
        evidenceQuote: sentence,
      });
    }

    const flatFeeMatch = sentence.match(
      /\b(administrative\s+fee|restocking\s+fee|processing\s+fee|convenience\s+fee|liquidated\s+damages|penalty\s+fee|chargeback\s+penalty\s+fee)\s+of\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    if (flatFeeMatch) {
      const labelRaw = flatFeeMatch[1].trim();
      const curr = detectCurrencyFromToken(flatFeeMatch[2]);
      const amt = parseNumericAmount(flatFeeMatch[3]);
      detectedSymbol = detectedSymbol || curr.symbol;
      detectedCode = detectedCode === 'UNKNOWN' ? curr.code : detectedCode;
      const isPenalty = /damages|penalty/i.test(labelRaw);
      statedFees.push({
        id: `fee_flat_${statedFees.length + 1}`,
        label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1),
        displayAmount: formatCurrencyAmount(amt, curr.symbol, curr.code),
        numericValue: amt,
        isPercentage: false,
        isPreselectedAddon: false,
        isConditionalPenalty: isPenalty,
        evidenceQuote: sentence,
      });
    }

    // 6. Detect Cancellation Conditions & Deadlines
    if (
      /\b(?:cancel\s+at\s+least\s+\d+\s+(?:days|hours)|notify\s+us\s+at\s+least\s+\d+\s+days|certified\s+letter|postal\s+mail|early\s+termination\s+fee)/i.test(
        sentence
      ) &&
      cancellationConditions.length < 3
    ) {
      cancellationConditions.push(sentence);
    }

    // 7. Detect Refund Limitations
    if (
      /\b(?:non-refundable|no\s+(?:partial\s+)?refunds\s+or\s+credits)/i.test(
        sentence
      ) &&
      !/\b(?:full\s+refund)\b/i.test(sentence) &&
      refundLimitations.length < 3
    ) {
      refundLimitations.push(sentence);
    }
  }

  const preselectedAddonsTotal = statedFees
    .filter((f) => f.isPreselectedAddon && typeof f.numericValue === 'number')
    .reduce((sum, f) => sum + (f.numericValue || 0), 0);

  let estimatedMonthlyRecurring: number | undefined;
  let estimatedAnnualCost: number | undefined;

  if (recurringAmount !== undefined && billingFrequency) {
    if (billingFrequency === 'monthly') {
      estimatedMonthlyRecurring = Number(recurringAmount.toFixed(2));
      estimatedAnnualCost = Number((recurringAmount * 12).toFixed(2));
    } else if (billingFrequency === 'annual') {
      estimatedMonthlyRecurring = Number((recurringAmount / 12).toFixed(2));
      estimatedAnnualCost = Number(recurringAmount.toFixed(2));
    } else if (billingFrequency === 'weekly') {
      estimatedMonthlyRecurring = Number(((recurringAmount * 52) / 12).toFixed(2));
      estimatedAnnualCost = Number((recurringAmount * 52).toFixed(2));
    }
  }

  const hasCalculableRecurringCost =
    recurringAmount !== undefined && estimatedAnnualCost !== undefined;
  const hasCalculableFinancials =
    hasCalculableRecurringCost ||
    setupFeeAmount !== undefined ||
    statedFees.length > 0 ||
    trialDurationDays !== undefined;

  const calculationAssumptions: string[] = [];
  if (hasCalculableRecurringCost && recurringAmount !== undefined) {
    calculationAssumptions.push(
      `Assumes the explicitly stated ${billingFrequency} price of ${formatCurrencyAmount(
        recurringAmount,
        detectedSymbol,
        detectedCode
      )} remains unchanged throughout the selected projection period.`
    );
  }
  if (trialDurationDays !== undefined && hasCalculableRecurringCost) {
    calculationAssumptions.push(
      `Assumes the ${trialDurationDays}-day trial converts into the paid plan immediately after the trial window expires if not cancelled.`
    );
  }
  calculationAssumptions.push(
    'Estimates exclude unstated regional taxes (such as GST, VAT, or sales tax), usage-based overages, or future unannounced price increases.'
  );

  return {
    hasCalculableFinancials,
    hasCalculableRecurringCost,
    currencySymbol: detectedSymbol || (detectedCode === 'INR' ? '₹' : '$'),
    currencyCode: detectedCode,
    currencyAssumptionNote:
      detectedCode === 'UNKNOWN' && hasCalculableFinancials
        ? 'No explicit currency symbol was detected; figures are shown as stated in the text.'
        : undefined,
    trialDurationDays,
    trialEvidenceQuote,
    initialPaymentAmount,
    initialPaymentQuote,
    recurringAmount,
    billingFrequency,
    recurringEvidenceQuote,
    setupFeeAmount,
    setupFeeQuote,
    preselectedAddonsTotal: Number(preselectedAddonsTotal.toFixed(2)),
    estimatedMonthlyRecurring,
    estimatedAnnualCost,
    statedFees,
    cancellationConditions,
    refundLimitations,
    calculationAssumptions,
  };
}

/**
 * Calculates total cost over a user-selected duration in months (e.g., 1, 3, 6, 12, 24 months).
 */
export function calculatePeriodCostProjection(
  estimate: HiddenCostEstimate,
  months: number
): PeriodProjectionResult {
  const safeMonths = Math.max(1, Math.min(60, Math.floor(months || 12)));
  let baseRecurringTotal = 0;

  if (estimate.recurringAmount !== undefined && estimate.billingFrequency) {
    if (estimate.billingFrequency === 'monthly') {
      baseRecurringTotal = estimate.recurringAmount * safeMonths;
    } else if (estimate.billingFrequency === 'annual') {
      const annualCycles = Math.ceil(safeMonths / 12);
      baseRecurringTotal = estimate.recurringAmount * annualCycles;
    } else if (estimate.billingFrequency === 'weekly') {
      baseRecurringTotal = ((estimate.recurringAmount * 52) / 12) * safeMonths;
    }
  }

  const upfrontAndSetupTotal =
    (estimate.initialPaymentAmount || 0) + (estimate.setupFeeAmount || 0);
  const preselectedAddonsIncluded = estimate.preselectedAddonsTotal || 0;

  const estimatedTotalWithoutAddons = Number(
    (baseRecurringTotal + upfrontAndSetupTotal).toFixed(2)
  );
  const estimatedTotalWithAddons = Number(
    (estimatedTotalWithoutAddons + preselectedAddonsIncluded).toFixed(2)
  );

  return {
    months: safeMonths,
    baseRecurringTotal: Number(baseRecurringTotal.toFixed(2)),
    upfrontAndSetupTotal: Number(upfrontAndSetupTotal.toFixed(2)),
    preselectedAddonsIncluded: Number(preselectedAddonsIncluded.toFixed(2)),
    estimatedTotalWithoutAddons,
    estimatedTotalWithAddons,
    formattedTotalWithoutAddons: formatCurrencyAmount(
      estimatedTotalWithoutAddons,
      estimate.currencySymbol,
      estimate.currencyCode
    ),
    formattedTotalWithAddons: formatCurrencyAmount(
      estimatedTotalWithAddons,
      estimate.currencySymbol,
      estimate.currencyCode
    ),
  };
}
