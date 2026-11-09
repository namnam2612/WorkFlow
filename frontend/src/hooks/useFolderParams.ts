import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Trạng thái trang/sắp xếp của mỗi cấp trong URL (?page=&sortBy=&order=&includeEmpty=1) để bấm Back và chia sẻ link
 * đều giữ nguyên. Mặc định do từng cấp truyền vào.
 */
export function useFolderParams<S extends string>(sortFields: readonly S[], defaults: { sortBy: S; order: 'asc' | 'desc' }) {
  const [params, setParams] = useSearchParams();
  const rawSort = params.get('sortBy');
  const sortBy = sortFields.find((f) => f === rawSort) ?? defaults.sortBy;
  const rawOrder = params.get('order');
  const order: 'asc' | 'desc' = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaults.order;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const includeEmpty = params.get('includeEmpty') === '1';

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    sortBy,
    order,
    page,
    includeEmpty,
    setPage: (p: number) => update({ page: p > 1 ? String(p) : null }),
    setSort: (field: string, dir: 'asc' | 'desc') => update({ sortBy: field, order: dir, page: null }),
    setIncludeEmpty: (value: boolean) => update({ includeEmpty: value ? '1' : null, page: null }),
  };
}
