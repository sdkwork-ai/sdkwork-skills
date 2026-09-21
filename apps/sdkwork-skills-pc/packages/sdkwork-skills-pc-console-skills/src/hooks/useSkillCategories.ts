import { useEffect, useState } from 'react';
import {
  listSkillCategories,
  useSkillsClients,
  type SkillCategoryRecord,
} from '@sdkwork/skills-pc-core';

/**
 * Loads the admin-published Skill category catalog for the console.
 *
 * Category ownership stays with the module that owns the entity: this hook only
 * consumes `sdkwork-skills-pc-core`'s existing `listSkillCategories` app-api
 * binding, so the console never re-declares the wire contract and the admin
 * surface (which writes the same records through `skills-pc-admin-core`) stays
 * the single write path.
 */
export interface SkillCategoriesState {
  categories: SkillCategoryRecord[];
  loading: boolean;
  error: string | null;
}

export function useSkillCategories(): SkillCategoriesState {
  const clients = useSkillsClients();
  const [categories, setCategories] = useState<SkillCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listSkillCategories(clients)
      .then((page) => {
        if (active) setCategories(page.items ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clients]);

  return { categories, loading, error };
}
