import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Set a new password", description: "Choose a new password for your Yatra Travel account.", path: "/reset-password", noindex: true });

export default function ResetPasswordPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Open this page from the link in your reset email.</p>
      <ResetPasswordForm />
    </Card>
  );
}
