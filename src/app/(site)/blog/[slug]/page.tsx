import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { Badge, Breadcrumbs, ButtonLink, Container } from "@/components/ui";
import { getBlogPost, getBlogPosts } from "@/lib/data/catalog";
import { formatDate } from "@/lib/dates";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  // Cache Components requires at least one entry; unknown slugs render notFound().
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: "unavailable" }];
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = await getBlogPost(slug);
  if (!post) return pageMetadata({ title: "Article not found", path: `/blog/${slug}`, noindex: true });
  return pageMetadata({
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.cover_url?.endsWith(".svg") ? "/brand/og-default.png" : post.cover_url,
    imageAlt: post.cover_alt,
    type: "article",
  });
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const [post, posts] = await Promise.all([getBlogPost(slug), getBlogPosts()]);
  if (!post) notFound();

  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const updated = post.updated_at && post.updated_at.slice(0, 10) !== post.published_at.slice(0, 10);

  return (
    <>
      <div className="border-b border-line bg-gradient-to-b from-ivory-dark to-ivory">
        <Container className="max-w-4xl py-8">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/blog", label: "Travel guides" }, { label: post.title }]} />
          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Badge key={t} tone="green">{t}</Badge>
              ))}
            </div>
          )}
          <h1 className="text-3xl font-semibold sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-lg text-muted">{post.excerpt}</p>
          <p className="mt-4 text-sm text-muted">
            Published <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
            {updated && (
              <>
                {" · "}Updated <time dateTime={post.updated_at}>{formatDate(post.updated_at)}</time>
              </>
            )}
          </p>
        </Container>
      </div>

      <Container className="max-w-4xl py-10">
        {post.cover_url && (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-ivory-dark">
            <Image src={post.cover_url} alt={post.cover_alt ?? ""} fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </div>
        )}
        <Markdown source={post.body_markdown} />

        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-gradient-to-r from-gold-300 to-gold-400 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Planning a trip around Tirupati?</h2>
            <p className="mt-1 text-sm text-forest-900/80">Book a cab or tell us your plan and we will arrange the transport.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/cab-booking">Book a cab</ButtonLink>
            <ButtonLink href="/custom-itinerary" variant="outline" className="bg-white/60">Plan a trip</ButtonLink>
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-12">
            <h2 id="related-heading" className="text-2xl font-semibold">More travel guides</h2>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
              {related.map((p) => (
                <li key={p.id} className="p-4">
                  <Link href={`/blog/${p.slug}`} className="font-semibold text-forest-800 hover:underline">{p.title}</Link>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>

      <JsonLd data={articleJsonLd(post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Travel guides", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
    </>
  );
}
