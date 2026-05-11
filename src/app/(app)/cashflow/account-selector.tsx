"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export interface AccountOption {
  id: string;
  label: string;
}

interface Props {
  current: string;
  accounts: AccountOption[];
}

export function AccountSelector({ current, accounts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (accounts.length <= 1) return null;

  function onChange(next: string | null) {
    const params = new URLSearchParams(searchParams);
    if (!next || next === ALL) params.delete("account");
    else params.set("account", next);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <Select
      value={current || ALL}
      onValueChange={onChange}
      disabled={pending}
    >
      <SelectTrigger className="w-56" aria-label="Filter by account">
        <SelectValue>
          {(value: string | null) => {
            if (!value || value === ALL) return "All accounts";
            return accounts.find((a) => a.id === value)?.label ?? "Account";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL} label="All accounts">All accounts</SelectItem>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id} label={a.label}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
