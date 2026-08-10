"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormGrid } from "@/components/form/form-page";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_CODES } from "@/lib/school-settings";
import { localKey } from "@/lib/local-key";
import { BILLING_CYCLES } from "@/modules/billing/enums";
import { CheckRow } from "@/modules/setup/components/step-shell";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/**
 * What the school charges, what it costs this year, and what it takes off.
 *
 * Amounts are typed in dirhams and converted once, on the way in — the database
 * stores integer centimes, and asking a bursar for centimes is asking for a
 * mistake.
 */
export function FeesStep({
  setup,
  yearEnabled,
  error,
}: {
  setup: SetupState;
  /** Prices and réductions belong to a year; the catalogue does not. */
  yearEnabled: boolean;
  error?: string;
}) {
  const t = useT();
  const fees = setup.fees;

  return (
    <div className="grid gap-6">
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}

      <section className="grid gap-2">
        {fees.rows.map((fee) => (
          <div
            key={fee.key}
            className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[auto_1fr_9rem_8rem_7rem]"
          >
            <label className="flex items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={fee.included}
                onChange={(event) => fees.updateFee(fee.key, { included: event.target.checked })}
              />
              <span className="sr-only">{t.setup.fees.include}</span>
            </label>

            <div className="grid gap-0.5">
              <Input
                aria-label={t.setup.fees.name}
                value={fee.name}
                disabled={!fee.included}
                onChange={(event) => fees.updateFee(fee.key, { name: event.target.value })}
              />
              <span className="text-muted-foreground text-xs">
                {fee.code} · {t.configOptions.feeKinds[fee.kind as "TUITION"]}
              </span>
            </div>

            <Select
              value={fee.billingCycle}
              disabled={!fee.included}
              onValueChange={(value) => fees.updateFee(fee.key, { billingCycle: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_CYCLES.map((cycle) => (
                  <SelectItem key={cycle} value={cycle}>
                    {t.configOptions.billingCycles[cycle]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              aria-label={t.setup.fees.amount}
              type="number"
              min={0}
              value={fee.amount}
              disabled={!fee.included}
              onChange={(event) => fees.updateFee(fee.key, { amount: event.target.value })}
            />

            <label className="flex items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={fee.isMandatory}
                disabled={!fee.included}
                onChange={(event) => fees.updateFee(fee.key, { isMandatory: event.target.checked })}
              />
              {t.setup.fees.mandatory}
            </label>
          </div>
        ))}
        <p className="text-muted-foreground text-xs">{t.setup.fees.amountHint}</p>
      </section>

      {yearEnabled ? (
        <>
          <section className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t.setup.fees.perLevel}</h3>
              <p className="text-muted-foreground text-xs">{t.setup.fees.perLevelHint}</p>
            </div>

            {fees.rates.map((rate) => (
              <div key={rate.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                <Select
                  value={rate.feeCode}
                  onValueChange={(value) => {
                    fees.takeOverRates();
                    fees.updateRate(rate.key, { feeCode: value });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fees.rows
                      .filter((fee) => fee.included)
                      .map((fee) => (
                        <SelectItem key={fee.code} value={fee.code}>
                          {fee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={rate.levelCode || "__all__"}
                  onValueChange={(value) => {
                    fees.takeOverRates();
                    fees.updateRate(rate.key, { levelCode: value === "__all__" ? "" : value });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t.setup.fees.allLevels}</SelectItem>
                    {setup.cursus.chosenLevelCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  aria-label={t.setup.fees.amount}
                  type="number"
                  min={0}
                  value={rate.amount}
                  onChange={(event) => {
                    fees.takeOverRates();
                    fees.updateRate(rate.key, { amount: event.target.value });
                  }}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.setup.removeRow}
                  onClick={() => {
                    fees.takeOverRates();
                    fees.setRates((current) =>
                      (current ?? fees.rates).filter((item) => item.key !== rate.key),
                    );
                  }}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  fees.takeOverRates();
                  fees.setRates((current) => [
                    ...(current ?? fees.rates),
                    {
                      key: localKey("rate"),
                      feeCode: fees.rows.find((fee) => fee.included)?.code ?? "",
                      levelCode: "",
                      amount: "",
                    },
                  ]);
                }}
              >
                <PlusIcon className="size-4" />
                {t.setup.fees.addRate}
              </Button>
            </div>
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">{t.setup.fees.discounts}</h3>
            {fees.discounts.map((discount) => (
              <div
                key={discount.key}
                className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_7rem_1fr]"
              >
                <CheckRow
                  id={`discount-${discount.code}`}
                  value={discount.code}
                  checked={discount.included}
                  onCheckedChange={(checked) =>
                    fees.updateDiscount(discount.key, { included: checked })
                  }
                  label={discount.name}
                  badges={<Badge variant="secondary">{discount.code}</Badge>}
                  className="flex cursor-pointer items-start gap-3"
                />

                {discount.kind === "PERCENTAGE" ? (
                  <Input
                    aria-label={t.setup.fees.percent}
                    type="number"
                    min={1}
                    max={100}
                    value={discount.percent}
                    disabled={!discount.included}
                    onChange={(event) =>
                      fees.updateDiscount(discount.key, { percent: event.target.value })
                    }
                  />
                ) : (
                  <Input
                    aria-label={t.setup.fees.fixedAmount}
                    type="number"
                    min={1}
                    value={discount.amount}
                    disabled={!discount.included}
                    onChange={(event) =>
                      fees.updateDiscount(discount.key, { amount: event.target.value })
                    }
                  />
                )}

                <span className="text-muted-foreground text-xs">
                  {t.configOptions.discountReasons[discount.reason as "SIBLING"]}
                  {discount.feeCode ? ` · ${discount.feeCode}` : ` · ${t.setup.fees.anyFee}`}
                </span>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <FormGrid cols={4}>
        <FormField name="currencyCode" label={t.setup.fees.currency}>
          <Select value={fees.currencyCode} onValueChange={fees.setCurrencyCode}>
            <SelectTrigger id="currencyCode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="currencyCode" value={fees.currencyCode} />
        </FormField>

        <FormField
          name="defaultInstalmentCount"
          label={t.setup.fees.instalments}
          hint={t.setup.fees.instalmentsHint}
        >
          <Input
            {...controlProps("defaultInstalmentCount", undefined, t.setup.fees.instalmentsHint)}
            type="number"
            min={0}
            max={12}
            value={fees.instalmentCount}
            onChange={(event) => fees.setInstalmentCount(event.target.value)}
          />
        </FormField>

        <FormField name="feeDueDayOfMonth" label={t.setup.fees.dueDay}>
          <Input
            {...controlProps("feeDueDayOfMonth")}
            type="number"
            min={1}
            max={28}
            value={fees.feeDueDay}
            onChange={(event) => fees.setFeeDueDay(event.target.value)}
          />
        </FormField>
      </FormGrid>
    </div>
  );
}

/** The three parallel row tables the fees step posts. */
export function FeesInputs({
  setup,
  yearEnabled,
}: {
  setup: SetupState;
  yearEnabled: boolean;
}) {
  const fees = setup.fees;
  return (
    <>
      {fees.rows.map((fee) => (
        <React.Fragment key={fee.key}>
          <input type="hidden" name="feeIncluded" value={fee.included ? "1" : "0"} />
          <input type="hidden" name="feeCode" value={fee.code} />
          <input type="hidden" name="feeName" value={fee.name} />
          <input type="hidden" name="feeNameAr" value={fee.nameAr} />
          <input type="hidden" name="feeKind" value={fee.kind} />
          <input type="hidden" name="feeBillingCycle" value={fee.billingCycle} />
          <input type="hidden" name="feeMandatory" value={fee.isMandatory ? "1" : "0"} />
          <input type="hidden" name="feeAmount" value={yearEnabled ? fee.amount : ""} />
        </React.Fragment>
      ))}

      {yearEnabled
        ? fees.rates.map((rate) => (
            <React.Fragment key={rate.key}>
              <input type="hidden" name="rateFeeCode" value={rate.feeCode} />
              <input type="hidden" name="rateLevelCode" value={rate.levelCode} />
              <input type="hidden" name="rateAmount" value={rate.amount} />
            </React.Fragment>
          ))
        : null}

      {yearEnabled
        ? fees.discounts.map((discount) => (
            <React.Fragment key={discount.key}>
              <input type="hidden" name="discountIncluded" value={discount.included ? "1" : "0"} />
              <input type="hidden" name="discountCode" value={discount.code} />
              <input type="hidden" name="discountName" value={discount.name} />
              <input type="hidden" name="discountNameAr" value={discount.nameAr} />
              <input type="hidden" name="discountKind" value={discount.kind} />
              <input type="hidden" name="discountPercent" value={discount.percent} />
              <input type="hidden" name="discountAmount" value={discount.amount} />
              <input type="hidden" name="discountReason" value={discount.reason} />
              <input type="hidden" name="discountFeeCode" value={discount.feeCode} />
              <input type="hidden" name="discountStackable" value={discount.isStackable ? "1" : "0"} />
            </React.Fragment>
          ))
        : null}
    </>
  );
}
