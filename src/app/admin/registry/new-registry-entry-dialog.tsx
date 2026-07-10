"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RegistryEntryForm } from "./registry-entry-form";

export function NewRegistryEntryDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" /> New Entry
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New Registry Entry">
        <RegistryEntryForm />
      </Dialog>
    </>
  );
}
