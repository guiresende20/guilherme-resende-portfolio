import { useParams } from "react-router-dom";

export default function BlogTag() {
  const { tag } = useParams();
  return <div className="container mx-auto p-8 text-foreground">Tag: {tag}</div>;
}
