import { AppChrome } from "@/components/app-chrome";
import { LedgerTool } from "@/components/ledger-tool";

export default async function LedgerPage() {
  return (
    <AppChrome active="tool">
      <div className="mx-auto max-w-[1158px]">
        <LedgerTool />
      </div>
    </AppChrome>
  );
}
