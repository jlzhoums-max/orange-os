import { AppChrome } from "@/components/app-chrome";
import { AssetsClient } from "@/components/assets-client";

export default async function AssetsPage() {
  return (
    <AppChrome active="assets">
      <div className="mx-auto max-w-[1158px]">
        <AssetsClient />
      </div>
    </AppChrome>
  );
}
