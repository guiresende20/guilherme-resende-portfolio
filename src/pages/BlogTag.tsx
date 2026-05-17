import { useParams } from "react-router-dom";
import BlogLayout from "../components/blog/BlogLayout";

export default function BlogTag() {
  const { tag } = useParams();
  return (
    <BlogLayout>
      <div className="container mx-auto p-8 text-foreground">Tag: {tag}</div>
    </BlogLayout>
  );
}
