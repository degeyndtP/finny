"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectBank } from "./actions";

interface Props {
  connectionId: string;
  institutionName: string;
}

export function DisconnectButton({ connectionId, institutionName }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    const ok = window.confirm(
      `Disconnect ${institutionName}?\n\n` +
        `This deletes the connection together with all its accounts and ` +
        `transactions from Finny, and revokes the consent at Enable Banking. ` +
        `This cannot be undone — you can re-link the bank afterwards.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await disconnectBank(connectionId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Disconnected ${institutionName}`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
