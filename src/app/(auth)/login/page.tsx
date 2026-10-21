import { Suspense } from "react";
import { SignInForm } from "@/components/auth/AuthForms";
import { Card, LoadingBlock } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { safeNextPath } from "@/lib/validation";

export const metadata = pageMetadata({ title: "Sign in", description: "Sign in to manage your Yatra Travel bookings.", path: "/login", noindex: true });

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <SignInForm next={safeNextPath(typeof next === "string" ? next : null)} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Access your bookings, payments and trip updates.</p>
      <Suspense fallback={<LoadingBlock />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </Card>
  );
}
