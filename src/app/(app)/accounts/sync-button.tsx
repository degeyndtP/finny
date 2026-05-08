"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncBank } from "./actions";

interface Props {
  connectionId: string;
  institutionName: string;
}

export function SyncButton({ connectionId, institutionName }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      const t = toast.loading(`Syncing ${institutionName}…`);
      const result = await syncBank(connectionId);
      toast.dismiss(t);

      if ("error" in result) {
        toast.error(`Sync failed: ${result.error}`);
        return;
      }

      const tx = result.added;
      const main =
        tx === 0
          ? `${institutionName} is up to date`
          : `Imported ${tx} transaction${tx === 1 ? "" : "s"} from ${institutionName}`;

      if (result.warnings.length) {
        toast.warning(main, { description: result.warnings.join("\n") });
      } else {
        toast.success(main);
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Syncing…" : "Sync"}
    </Button>
  );
}
