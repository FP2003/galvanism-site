import { SignIn } from "@clerk/nextjs";
import { BrandMark } from "@/components/brand-mark";

// Login gate. Accounts are admin-provisioned, so this is sign-in only — no
// public sign-up. Clerk widget themed to the F.C.B. palette (info/website_idea.md).
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-void-navy px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark size={44} className="text-signal-cyan" />
        <div>
          <h1 className="font-[family-name:var(--font-rajdhani)] text-2xl font-bold uppercase tracking-[0.04em] text-case-file-white">
            F.C.B. Command
          </h1>
          <p className="mt-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            Authorized personnel only · Order, at any cost
          </p>
        </div>
      </div>

      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#0caadc",
            colorBackground: "#023a3b",
            colorForeground: "#ffffff",
            colorMutedForeground: "#9dbbcb",
            colorInput: "#0a0021",
            colorInputForeground: "#ffffff",
            colorDanger: "#c9502e",
            borderRadius: "0px",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          },
          elements: {
            cardBox: "border border-ledger-teal",
            card: "bg-ledger-teal",
            headerTitle:
              "font-[family-name:var(--font-chakra)] uppercase tracking-[0.06em]",
            formButtonPrimary:
              "font-[family-name:var(--font-chakra)] uppercase tracking-[0.08em] rounded-none",
            footerAction: "hidden",
          },
        }}
      />
    </main>
  );
}
