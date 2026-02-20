import api from "./client";
import type { Article, PdfPage } from "@/types/article";

export async function listArticles(params?: {
  skip?: number;
  limit?: number;
  project_id?: string;
  status_filter?: string;
}) {
  const { data } = await api.get<{ articles: Article[]; total: number }>(
    "/articles",
    { params }
  );
  return data;
}

export async function getArticle(articleId: string) {
  const { data } = await api.get<Article>(`/articles/${articleId}`);
  return data;
}

export async function uploadArticle(file: File, projectId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (projectId) {
    formData.append("project_id", projectId);
  }
  const { data } = await api.post<Article>("/articles/", formData);
  return data;
}

export async function deleteArticle(articleId: string) {
  await api.delete(`/articles/${articleId}`);
}

export async function getArticlePages(articleId: string) {
  const { data } = await api.get<PdfPage[]>(`/articles/${articleId}/pages`);
  return data;
}

export function getArticlePdfUrl(articleId: string) {
  return `/api/v1/articles/${articleId}/pdf`;
}
