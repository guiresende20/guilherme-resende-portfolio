import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MarkdownRendererProps {
  body: string;
}

export default function MarkdownRenderer({ body }: MarkdownRendererProps) {
  return (
    <article
      className="prose prose-invert max-w-none
                 prose-headings:font-display prose-headings:tracking-tight
                 prose-h1:text-4xl prose-h1:text-neon
                 prose-h2:text-2xl prose-h2:text-foreground
                 prose-h3:text-xl
                 prose-p:font-sans prose-p:text-foreground prose-p:leading-relaxed
                 prose-a:text-electric prose-a:no-underline hover:prose-a:underline hover:prose-a:text-neon
                 prose-code:font-mono prose-code:text-electric prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                 prose-code:before:content-none prose-code:after:content-none
                 prose-pre:bg-card prose-pre:border prose-pre:border-border
                 prose-blockquote:border-l-neon prose-blockquote:text-muted-foreground prose-blockquote:italic
                 prose-img:rounded-md
                 prose-hr:border-neon/30
                 prose-li:marker:text-electric
                 prose-table:text-sm prose-th:bg-muted prose-th:border-border prose-td:border-border"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
