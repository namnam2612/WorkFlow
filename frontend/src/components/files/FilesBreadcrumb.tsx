import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  /** Bỏ trống cho mục cuối (vị trí hiện tại) */
  to?: string;
}

/** Thanh đường dẫn "Kho tài liệu / Tên dự án / Tên task"; bấm từng phần để quay lại cấp đó */
export function FilesBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Đường dẫn thư mục" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
            <li className="min-w-0">
              {item.to ? (
                <Link to={item.to} className="max-w-[16rem] truncate text-slate-500 transition-colors hover:text-white" title={item.label}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="block max-w-[20rem] truncate font-medium text-slate-900" title={item.label}>
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
