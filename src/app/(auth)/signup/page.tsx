import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/AuthForms";
import { Card, LoadingBlock } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { safeNextPath } from "@/lib/validation";

export const metadata = pageMetadata({ title: "Create an account", description: "Create a Yatra Travel account to book and manage trips.", path: "/signup", noindex: true });

async function Form({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const { next } = await searchParams;
  return <SignUpForm next={safeNextPath(typeof next === "string" ? next : null)} />;
}

export default function SignUpPage(props: PageProps<"/signup">) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Book trips, pay securely and track your bookings in one place.</p>
      <Suspense fallback={<LoadingBlock />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </Card>
  );
}
