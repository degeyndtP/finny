"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { upsertCategory } from "./actions";

type Kind = "income" | "expense" | "transfer";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  category?: {
    id: string;
    name: string;
    kind: Kind;
    color: string | null;
  };
}

export function CategoryFormDialog({ open, onOpenChange, category }: Props) {
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();

  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<Kind>(category?.kind ?? "expense");
  const [color, setColor] = useState(category?.color ?? "#6B7280");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertCategory({
        id: category?.id,
        name: name.trim(),
        kind,
        color,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories group your transactions for the dashboard. Pick a kind
            and a colour — both used to render the bars on /.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-name`}>Name</Label>
            <Input
              id={`${formId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Groceries"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-kind`}>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger id={`${formId}-kind`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-color`}>Colour</Label>
            <div className="flex items-center gap-3">
              <input
                id={`${formId}-color`}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 rounded-md border bg-background cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#6B7280"
                className="font-mono"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
