import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Badge, Breadcrumbs, Container, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getBlogPosts } from "@/lib/data/catalog";
import { formatDate } from "@/lib/dates";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Travel Guides — Tirupati, Tirumala & Temples",
  description:
    "Practical travel guides for Tirupati and Tirumala: getting around, planning temple visits, sightseeing near Tirupati and tips for travelling with family and elders.",
  path: "/blog",
});

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <PageHeader title="Travel guides" intro="Practical, locally written guides for planning journeys around Tirupati, Tirumala and nearby temples.">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Travel guides" }]} />
      </PageHeader>

      <Container className="py-10">
        {posts.length === 0 ? (
          <EmptyState title="Travel guides are coming soon" action={<Link href="/tirumala-tirupati" className={buttonClass("gold")}>Read our Tirumala travel guide</Link>}>
            We are writing guides on getting around Tirupati, temple visits and sightseeing. Check back shortly.
          </EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id} className="flex">
                <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[16/9] bg-ivory-dark">
                    {post.cover_url && (
                      <Image
                        src={post.cover_url}
                        alt={post.cover_alt ?? ""}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {post.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 3).map((t) => (
                          <Badge key={t} tone="green">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <h2 className="text-lg font-semibold">
                      <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                        {post.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{post.excerpt}</p>
                    <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                      <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Container>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Travel guides", path: "/blog" }])} />
    </>
  );
}
