"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { localKey } from "@/lib/local-key";
import { saveSupplyListAction } from "@/modules/supplies/actions";
import type {
  ClassChoice,
  SubjectChoice,
} from "@/modules/supplies/components/supplies-manager";
import type {
  SupplyArticleChoice,
  SupplyListRow,
} from "@/modules/supplies/queries";

/**
 * One editable row. `key` is local only — items carry no identity that matters.
 *
 * `articleId` is what the row *is*: the wording comes off the catalogue and is
 * never typed here. `label` is carried only so a line written before the
 * catalogue existed can still say what it used to ask for while its article is
 * being chosen.
 */
type DraftItem = {
  key: string;
  articleId: string;
  label: string;
  quantity: string;
  notes: string;
  isRequired: boolean;
};

function emptyItem(): DraftItem {
  return {
    key: localKey("item"),
    articleId: "",
    label: "",
    quantity: "",
    notes: "",
    isRequired: true,
  };
}

/**
 * Writing a list: its heading, and the articles.
 *
 * The items are React state rendered as parallel hidden inputs, so a row that
 * is blank still occupies its slot in every array — the same shape the mark
 * sheet uses, and for the same reason: without it a missing quantity would
 * shift the next article's detail onto the wrong line.
 */
export function SupplyListDialog({
  list,
  classes,
  subjects,
  articles,
  onClose,
}: {
  list: SupplyListRow | null;
  classes: ClassChoice[];
  subjects: SubjectChoice[];
  /** The school's catalogue — the only thing a line may name. */
  articles: SupplyArticleChoice[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    saveSupplyListAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: onClose });

  const [items, setItems] = React.useState<DraftItem[]>(() =>
    list && list.items.length > 0
      ? list.items.map((item) => ({
          key: item.id,
          articleId: item.articleId ?? "",
          label: item.label,
          quantity: item.quantity === null ? "" : String(item.quantity),
          notes: item.notes ?? "",
          isRequired: item.isRequired,
        }))
      : [emptyItem()],
  );

  const errors = state.fieldErrors ?? {};

  function update(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  /**
   * The catalogue, by shelf — what makes eighty articles pickable.
   *
   * Grouped here rather than fetched grouped: the query already returns them in
   * category order, so this only has to cut the run into blocks, and the picker
   * and the configuration screen show the same order for the same reason.
   */
  const byCategory = React.useMemo(() => {
    const groups: { category: string; articles: SupplyArticleChoice[] }[] = [];
    for (const article of articles) {
      const last = groups[groups.length - 1];
      if (last?.category === article.category) last.articles.push(article);
      else groups.push({ category: article.category, articles: [article] });
    }
    return groups;
  }, [articles]);

  const articleById = React.useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  );

  /**
   * Choosing an article fills the quantity in, but only when the row is still
   * untouched — a teacher who typed 3 and then corrected the article meant 3.
   */
  function chooseArticle(item: DraftItem, articleId: string) {
    const article = articleById.get(articleId);
    update(item.key, {
      articleId,
      label: article?.label ?? item.label,
      quantity:
        item.quantity === "" && article?.defaultQuantity != null
          ? String(article.defaultQuantity)
          : item.quantity,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>
              {list ? t.supply.editList : t.supply.newList}
            </DialogTitle>
            <DialogDescription>{t.supply.itemsHint}</DialogDescription>
          </DialogHeader>

          {list ? <input type="hidden" name="id" value={list.id} /> : null}

          <div className="grid gap-4 py-4">
            <FormField
              name="title"
              label={t.supply.listTitle}
              error={errors.title}
              required
            >
              <Input
                {...controlProps("title", errors.title)}
                defaultValue={valueOf(state, "title", list?.title)}
                placeholder={t.supply.listTitlePlaceholder}
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="schoolClassId"
                label={t.supply.class}
                error={errors.schoolClassId}
                required
              >
                <Select
                  name="schoolClassId"
                  defaultValue={
                    valueOf(state, "schoolClassId", list?.schoolClassId) ||
                    classes[0]?.id
                  }
                >
                  <SelectTrigger id="schoolClassId" className="w-full">
                    <SelectValue placeholder={t.supply.class} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="subjectId"
                label={t.supply.subject}
                hint={t.supply.subjectHint}
                error={errors.subjectId}
              >
                <Select
                  name="subjectId"
                  defaultValue={
                    valueOf(state, "subjectId", list?.subjectId) || "__none__"
                  }
                >
                  <SelectTrigger id="subjectId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.common.none}</SelectItem>
                    {subjects.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Optional, and blank is the ordinary case: the general rentrée
              list simply stands. Once it is set it is also what retires the
              list from the families' app — see `dueOn` on SupplyList. */}
            <FormField
              name="dueOn"
              label={t.supply.dueOn}
              hint={t.supply.dueOnHint}
              error={errors.dueOn}
            >
              <Input
                {...controlProps("dueOn", errors.dueOn, t.supply.dueOnHint)}
                type="date"
                defaultValue={valueOf(state, "dueOn", list?.dueOn)}
              />
            </FormField>

            <div className="grid gap-2">
              <Label>{t.supply.items}</Label>

              {/* Nothing to pick from is a configuration problem, not a form
                error — say where to fix it rather than showing empty selects. */}
              {articles.length === 0 ? (
                <p className="text-warning text-xs text-pretty">
                  {t.supply.noArticles}
                </p>
              ) : null}

              <div className="grid gap-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[5rem_1fr_auto]"
                  >
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      inputMode="numeric"
                      dir="ltr"
                      value={item.quantity}
                      onChange={(event) =>
                        update(item.key, { quantity: event.target.value })
                      }
                      aria-label={t.supply.quantity}
                      placeholder={t.supply.quantity}
                    />
                    <div className="grid gap-2">
                      <Select
                        value={item.articleId}
                        onValueChange={(value) => chooseArticle(item, value)}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={t.supply.itemLabel}
                        >
                          <SelectValue placeholder={t.supply.pickArticle} />
                        </SelectTrigger>
                        <SelectContent>
                          {byCategory.map((group) => (
                            <SelectGroup key={group.category}>
                              <SelectLabel>
                                {t.supplyOptions.categories[
                                  group.category as keyof typeof t.supplyOptions.categories
                                ] ?? group.category}
                              </SelectLabel>
                              {group.articles.map((article) => (
                                <SelectItem key={article.id} value={article.id}>
                                  {article.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* A line written before the catalogue existed, or whose
                        article has since been withdrawn: what it used to ask
                        for, so nothing looks lost while it is re-picked. */}
                      {item.articleId === "" && item.label !== "" ? (
                        <p className="text-warning text-xs">
                          {interpolate(t.supply.articleWithdrawn, {
                            label: item.label,
                          })}
                        </p>
                      ) : null}

                      <Input
                        value={item.notes}
                        onChange={(event) =>
                          update(item.key, { notes: event.target.value })
                        }
                        aria-label={t.supply.itemNotes}
                        placeholder={
                          articleById.get(item.articleId)?.notes ??
                          t.supply.itemNotes
                        }
                        className="text-xs"
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <Checkbox
                          checked={item.isRequired}
                          onCheckedChange={(value) =>
                            update(item.key, { isRequired: value === true })
                          }
                        />
                        {t.supply.required}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.delete}
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems((current) =>
                            current.filter((row) => row.key !== item.key),
                          )
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>

                    {/* Parallel arrays, one slot per row — see the note above.
                      The wording is not among them: the server resolves it from
                      the article, so it cannot be forged. */}
                    <input
                      type="hidden"
                      name="itemArticleId"
                      value={item.articleId}
                    />
                    <input
                      type="hidden"
                      name="itemQuantity"
                      value={item.quantity}
                    />
                    <input type="hidden" name="itemNotes" value={item.notes} />
                    <input
                      type="hidden"
                      name="itemRequired"
                      value={item.isRequired ? "1" : "0"}
                    />
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, emptyItem()])}
              >
                <PlusIcon className="size-4" />
                {t.supply.addItem}
              </Button>
            </div>

            <FormField
              name="notes"
              label={t.supply.notes}
              hint={t.supply.notesHint}
              error={errors.notes}
            >
              <Textarea
                {...controlProps("notes", errors.notes, t.supply.notesHint)}
                defaultValue={valueOf(state, "notes", list?.notes)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
