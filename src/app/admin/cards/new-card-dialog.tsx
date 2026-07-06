"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CardForm } from "./card-form";

/*
 * Trigger + dialog for authoring a new card (moved out of a fixed sidebar
 * panel so the deck grid can use the full page width). The dialog stays
 * open after a successful create — CardForm resets itself in place — so the
 * DM can author several cards back-to-back without reopening it.
 */
export function NewCardDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" /> New Card
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New Card">
        <CardForm />
      </Dialog>
    </>
  );
}
