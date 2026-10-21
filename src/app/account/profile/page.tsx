import { ProfileForm } from "@/components/account/AccountForms";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "My profile", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const viewer = await requireUser("/account/profile");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, email, whatsapp_opt_in, marketing_opt_in")
    .eq("id", viewer.id)
    .single();

  return (
    <div className="space-y-6">
      <SectionHeading as="h1" title="Profile" intro={`Signed in as ${data?.email ?? viewer.email ?? ""}`} />
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Personal details &amp; preferences</h2>
        <ProfileForm
          profile={{
            full_name: data?.full_name ?? "",
            phone: data?.phone ?? "",
            whatsapp_opt_in: Boolean(data?.whatsapp_opt_in),
            marketing_opt_in: Boolean(data?.marketing_opt_in),
          }}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Change password</h2>
        <ResetPasswordForm />
      </Card>
    </div>
  );
}
