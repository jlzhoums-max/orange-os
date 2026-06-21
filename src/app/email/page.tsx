import { AppChrome } from "@/components/app-chrome";
import { EmailClient } from "@/components/email-client";

export default function EmailPage() {
  return (
    <AppChrome active="life">
      <EmailClient />
    </AppChrome>
  );
}
