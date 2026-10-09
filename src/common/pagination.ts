import { z } from "zod";

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

/** Общая схема query-параметров пагинации — расширяется модулями через .extend() */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PER_PAGE)
    .default(DEFAULT_PER_PAGE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function buildMeta(params: {
  page: number;
  perPage: number;
  total: number;
}): PageMeta {
  const { page, perPage, total } = params;
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
