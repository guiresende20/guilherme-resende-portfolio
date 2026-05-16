import { useParams } from "react-router-dom";

export default function BlogPost() {
  const { slug } = useParams();
  return <div className="container mx-auto p-8 text-foreground">Post: {slug}</div>;
}
