"use client";

import { BanknoteArrowUpIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import {
  FormActions,
  FormGrid,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Combobox } from "@/components/form/combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, toDateInputValue } from "@/lib/i18n/format";
import { recordDisbursementAction } from "@/modules/treasury/actions";
import { BankPicker } from "@/modules/treasury/components/bank-picker";
import {
  methodDetail,
  TENDER_METHODS,
  type TenderMethod,
} from "@/modules/treasury/enums";
import type {
  BankOption,
  CategoryOption,
  DrawerChoice,
  MotifOption,
  SupplierOption,
} from "@/modules/treasury/queries";

const NO_SUPPLIER = "__none__";
/** Blank for a Select, which cannot hold "". */
const NONE = "__none__";

/**
 * Décaissement: money out.
 *
 * ── Four fields, and the rest on request ────────────────────────────────────
 * A bursar paying the Lydec bill answers three questions — what, how much, how —
 * and a fourth when it is cash: out of which till. Those are what the screen
 * asks. The chart-of-accounts fields are still here and still written; they sit
 * behind « Plus de détails », because they are what a *report* needs rather than
 * what the payment needs, and nine payouts in ten are entered by somebody who
 * has the facture in one hand and no opinion about the sub-rubrique.
 *
 * Nothing was removed to achieve that. Filing a décaissement under no rubrique
 * is a hole in the finance reports, so the fields stay one click away and the
 * supplier shortcut still fills them in — see `chooseSupplier`.
 *
 * ── What this screen is *not* for ───────────────────────────────────────────
 * What staff are *owed* is paid where it is owed: a salary is a bulletin
 * (`/hr/payroll`) and an avance is an avance (`/hr/advances`). Both name the
 * employee's row and both write a décaissement through the same service, so the
 * ledger is unchanged; what has gone from here is the staff picker, which made
 * this form ask a question that has a better answer two screens away.
 *
 * A one-off that is not either — a reimbursement, an indemnité — is paid here as
 * an ordinary décaissement, named in the libellé.
 */
export function DisbursementForm({
  categories,
  motifs,
  banks,
  suppliers,
  drawers,
}: {
  /** Rubriques postable on the way out, each carrying its sub-rubriques. */
  categories: CategoryOption[];
  motifs: MotifOption[];
  banks: BankOption[];
  /**
   * The declared fournisseurs. Picking one fills the beneficiary and the
   * rubrique; leaving it on "autre" is how a one-off is paid.
   */
  suppliers: SupplierOption[];
  /**
   * The tills open today. Empty means no cash may leave at all — the submit is
   * held and the hint says why — but a virement can still be recorded.
   */
  drawers: DrawerChoice[];
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction] = React.useActionState(
    recordDisbursementAction,
    IDLE,
  );
  const [method, setMethod] = React.useState<TenderMethod>("CASH");
  const [supplierId, setSupplierId] = React.useState(NO_SUPPLIER);
  const [beneficiaryName, setBeneficiaryName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(NONE);
  const [subcategoryId, setSubcategoryId] = React.useState(NONE);
  const [motifId, setMotifId] = React.useState(NONE);
  const [label, setLabel] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  /** The cashier's own drawer, which is what a payout ordinarily comes out of. */
  const defaultDrawer =
    drawers.find((drawer) => drawer.isMine)?.id ?? drawers[0]?.id ?? "";
  const [cashSessionId, setCashSessionId] = React.useState(defaultDrawer);

  useActionFeedback(state, {
    onSuccess: () => {
      formRef.current?.reset();
      setMethod("CASH");
      setSupplierId(NO_SUPPLIER);
      setBeneficiaryName("");
      setCategoryId(NONE);
      setSubcategoryId(NONE);
      setMotifId(NONE);
      setLabel("");
      setCashSessionId(defaultDrawer);
      // The disclosure stays as the bursar left it: somebody entering a run of
      // invoices under the same rubrique should not have to reopen it each time.
    },
  });

  const errors = state.fieldErrors ?? {};

  /**
   * What the chosen method needs asking about, from the one table both this form
   * and the action read — see `METHOD_DETAILS`. The eight methods therefore fall
   * into three shapes of form rather than eight branches here.
   */
  const detail = methodDetail(method);
  const needsDrawer = detail === "DRAWER";
  /** No till open, and this payout wants one. */
  const drawerMissing = needsDrawer && drawers.length === 0;

  /**
   * Picking a fournisseur fills in everything its row already knows.
   *
   * The beneficiary, the rubrique and the sub-rubrique all come off the
   * supplier, which is what leaves the amount as the only thing that genuinely
   * has to be typed. Choosing "autre" clears them again rather than leaving the
   * last supplier's rubrique attached to a payment that is not theirs.
   */
  function chooseSupplier(value: string) {
    setSupplierId(value);

    if (value === NO_SUPPLIER) {
      setBeneficiaryName("");
      setCategoryId(NONE);
      setSubcategoryId(NONE);
      return;
    }

    const chosen = suppliers.find((option) => option.id === value);
    if (!chosen) return;

    setBeneficiaryName(chosen.label);
    setCategoryId(chosen.defaultCategoryId ?? NONE);
    setSubcategoryId(chosen.defaultSubcategoryId ?? NONE);
    if (label.trim() === "") setLabel(chosen.label);
  }

  const category =
    categories.find((option) => option.id === categoryId) ?? null;

  /**
   * A motif filed under the chosen rubrique, plus the ones filed under none.
   * Picking a rubrique narrows the list instead of emptying it — see the note
   * on OperationMotif.categoryId.
   */
  const availableMotifs = motifs.filter(
    (motif) => motif.categoryId === null || motif.categoryId === categoryId,
  );

  /** Changing the rubrique clears what hung off the old one. */
  function chooseCategory(value: string) {
    setCategoryId(value);
    setSubcategoryId(NONE);
    const stillOffered = motifs.find(
      (motif) =>
        motif.id === motifId &&
        (motif.categoryId === null || motif.categoryId === value),
    );
    if (!stillOffered) setMotifId(NONE);
  }

  /**
   * The motif fills the label, which is still what the ledger prints. Typing
   * over it afterwards is allowed and ordinary — "Achat de fournitures" becomes
   * "Achat de fournitures — rentrée 2026" — so the label stays a text box and
   * the motif stays the thing a report can group by.
   */
  function chooseMotif(value: string) {
    setMotifId(value);
    const chosen = motifs.find((motif) => motif.id === value);
    if (chosen && label.trim() === "") setLabel(chosen.name);
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <FormSection
        title={t.treasury.decaissement}
        description={t.treasury.decaissementSubtitle}
      >
        <FormField
          name="label"
          label={t.treasury.label}
          hint={t.treasury.labelHint}
          error={errors.label}
          required
        >
          <Input
            {...controlProps("label", errors.label, t.treasury.labelHint)}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </FormField>

        <FormGrid cols={needsDrawer ? 3 : 2}>
          <FormField
            name="amount"
            label={t.treasury.amount}
            error={errors.amount}
            required
          >
            <Input
              {...controlProps("amount", errors.amount)}
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField
            name="method"
            label={t.treasury.method}
            error={errors.method}
          >
            <Select
              name="method"
              value={method}
              onValueChange={(value) => setMethod(value as TenderMethod)}
            >
              <SelectTrigger id="method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENDER_METHODS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.treasuryOptions.methods[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Only when notes actually leave a drawer. A virement has no till,
              and offering one would invite the bursar to answer a question the
              movement does not have. */}
          {needsDrawer && drawers.length > 0 ? (
            <FormField
              name="cashSessionId"
              label={t.treasury.drawer}
              hint={t.treasury.drawerHint}
              error={errors.cashSessionId}
            >
              <Select
                name="cashSessionId"
                value={cashSessionId}
                onValueChange={setCashSessionId}
              >
                <SelectTrigger id="cashSessionId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {drawers.map((drawer) => (
                    <SelectItem key={drawer.id} value={drawer.id}>
                      {/* What it holds, beside its name: a payout the till
                          cannot cover is refused on the server, and reading the
                          figure here is what stops that being a surprise. */}
                      {drawer.label} —{" "}
                      {formatAmount(drawer.availableCentimes, locale)}
                      {drawer.isMine ? ` (${t.treasury.drawerMine})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
        </FormGrid>

        {/* The cheque's own fields, for the one method that is tracked paper. */}
        {detail === "CHEQUE" ? (
          <FormGrid cols={2}>
            <FormField
              name="chequeNumber"
              label={t.treasury.chequeNumber}
              error={errors.chequeNumber}
              required
            >
              <Input
                {...controlProps("chequeNumber", errors.chequeNumber)}
                dir="ltr"
                required
              />
            </FormField>
            <BankPicker banks={banks} label={t.treasury.bank} />
          </FormGrid>
        ) : null}

        {/* Everything else that is not cash: the traite's number, the virement's
            reference, the transaction number off the TPE slip. One shape of form
            for the six of them, because it is one question. */}
        {detail === "REFERENCE" ? (
          <FormGrid cols={2}>
            <FormField name="reference" label={t.treasury.reference}>
              <Input {...controlProps("reference")} dir="ltr" />
            </FormField>
            <BankPicker banks={banks} label={t.treasury.bank} />
          </FormGrid>
        ) : null}

        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
            <ChevronDownIcon
              className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
            />
            {t.treasury.moreDetails}
          </CollapsibleTrigger>

          {/* `forceMount`, and it is load-bearing: Radix unmounts the content
              when shut, and an unmounted input is not submitted. The supplier
              shortcut fills in the rubrique behind this panel, so without it a
              bursar who never opened it would file every payout under nothing.
              Shut, the content carries `hidden` — out of the layout, still in
              the form. */}
          <CollapsibleContent forceMount className="grid gap-5 pt-5">
            <p className="text-muted-foreground text-xs">
              {t.treasury.moreDetailsHint}
            </p>

            {suppliers.length > 0 ? (
              <FormField
                name="supplierId"
                label={t.treasury.supplier}
                hint={t.treasury.supplierHint}
              >
                <Combobox
                  id="supplierId"
                  name="supplierId"
                  value={supplierId}
                  onValueChange={chooseSupplier}
                  emptyOption={{
                    value: NO_SUPPLIER,
                    label: t.treasury.beneficiaryExternal,
                  }}
                  options={suppliers.map((option) => ({
                    value: option.id,
                    label: option.label,
                    // Searchable by the account number too — a bursar holding
                    // the facture has the police number in front of them, not
                    // the name.
                    keywords: `${option.code} ${option.accountRef ?? ""}`,
                  }))}
                />
              </FormField>
            ) : null}

            <FormGrid cols={2}>
              <FormField
                name="beneficiaryName"
                label={t.treasury.beneficiaryName}
                hint={t.treasury.beneficiaryHint}
                error={errors.beneficiaryName}
              >
                <Input
                  {...controlProps(
                    "beneficiaryName",
                    errors.beneficiaryName,
                    t.treasury.beneficiaryHint,
                  )}
                  value={beneficiaryName}
                  onChange={(event) => setBeneficiaryName(event.target.value)}
                />
              </FormField>

              <FormField
                name="occurredAt"
                label={t.treasury.occurredAt}
                error={errors.occurredAt}
              >
                <Input
                  {...controlProps("occurredAt", errors.occurredAt)}
                  type="date"
                  defaultValue={toDateInputValue(new Date())}
                  dir="ltr"
                />
              </FormField>
            </FormGrid>

            <FormGrid cols={2}>
              <FormField
                name="categoryId"
                label={t.treasury.operationCategory}
                error={errors.categoryId}
              >
                <Select
                  name="categoryId"
                  value={categoryId}
                  onValueChange={chooseCategory}
                >
                  <SelectTrigger id="categoryId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.common.none}</SelectItem>
                    {categories.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Only offered once a rubrique is chosen, and only its own
                  children: a sub-rubrique means nothing on its own. */}
              <FormField
                name="subcategoryId"
                label={t.treasury.operationSubcategory}
                hint={
                  category && category.subcategories.length === 0
                    ? t.treasury.noSubcategories
                    : undefined
                }
                error={errors.subcategoryId}
              >
                <Select
                  name="subcategoryId"
                  value={subcategoryId}
                  onValueChange={setSubcategoryId}
                  disabled={!category || category.subcategories.length === 0}
                >
                  <SelectTrigger id="subcategoryId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.common.none}</SelectItem>
                    {(category?.subcategories ?? []).map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </FormGrid>

            <FormField
              name="motifId"
              label={t.treasury.motif}
              hint={t.treasury.motifHint}
              error={errors.motifId}
            >
              <Select
                name="motifId"
                value={motifId}
                onValueChange={chooseMotif}
              >
                <SelectTrigger id="motifId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.common.none}</SelectItem>
                  {availableMotifs.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField name="notes" label={t.treasury.notes}>
              <Textarea {...controlProps("notes")} rows={2} />
            </FormField>
          </CollapsibleContent>
        </Collapsible>
      </FormSection>

      <FormActions hint={drawerMissing ? t.treasury.noOpenSession : undefined}>
        <SubmitButton size="lg" disabled={drawerMissing}>
          <BanknoteArrowUpIcon className="size-4" />
          {t.treasury.recordDisbursement}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
