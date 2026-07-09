"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BallotForm } from "./ballot-form";

export function NewBallotDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" /> New Ballot
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New Ballot">
        <BallotForm />
      </Dialog>
    </>
  );
}
