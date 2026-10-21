import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Reset your password", description: "Request a password reset link for your Yatra Travel account.", path: "/forgot-password", noindex: true });

export default function ForgotPasswordPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Enter your email and we will send you a link to set a new password.</p>
      <ForgotPasswordForm />
    </Card>
  );
}
