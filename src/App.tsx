import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";

const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BlogTag = lazy(() => import("./pages/BlogTag"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route
          path="/blog"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <Blog />
            </Suspense>
          }
        />
        <Route
          path="/blog/tag/:tag"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <BlogTag />
            </Suspense>
          }
        />
        <Route
          path="/blog/:slug"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <BlogPost />
            </Suspense>
          }
        />
        <Route path="*" element={<Index />} />
      </Routes>
    </BrowserRouter>
  );
}
