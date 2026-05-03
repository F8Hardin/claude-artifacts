// Shared Artifact type — all DB/storage logic lives in src/lib/supabase/artifacts.ts

export interface Artifact {
  id: string;
  slug: string;
  title: string;
  description: string;
  owner_id: string;
  storage_path: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  author_username: string | null;
  author_avatar: string | null;
}
