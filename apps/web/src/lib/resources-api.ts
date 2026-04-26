import { apiGet } from "@/lib/api";

export type ResourcesContentItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export function getPublishedResourceItems() {
  return apiGet<ResourcesContentItem[]>("/resources/items");
}
