import { ApiError, apiGet } from "@/lib/api";

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

export async function getPublishedResourceItems() {
  try {
    return await apiGet<ResourcesContentItem[]>("/resources/items");
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn("Resources endpoint unavailable; showing empty resources list.", {
        status: error.status,
        message: error.message,
      });
      return [];
    }

    throw error;
  }
}
