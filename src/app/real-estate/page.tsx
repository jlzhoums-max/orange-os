import { AppChrome } from "@/components/app-chrome";
import { RealEstateTracker } from "@/components/real-estate-tracker";

export default async function RealEstateToolPage() {
  return (
    <AppChrome active="tool">
      <RealEstateTracker />
    </AppChrome>
  );
}
