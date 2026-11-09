import { BookOpen, FileText, FlaskConical, ListChecks, MessageSquare, Rocket, Search, type LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { api } from '../lib/api';
import { highlightSegments } from '../lib/search';
import { inputClass } from '../lib/styles';
import type { SearchKind, SearchResult } from '../types/api';

const KIND: Record<SearchKind, { label: string; icon: LucideIcon }> = {
  task: { label: 'Công việc', icon: ListChecks },
  wiki: { label: 'Tài liệu', icon: BookOpen },
  comment: { label: 'Bình luận', icon: MessageSquare },
  testCase: { label: 'Test case', icon: FlaskConical },
  release: { label: 'Phiên bản', icon: Rocket },
  file: { label: 'File', icon: FileText },
};

/** Tô đậm từ khóa trong đoạn trích, không phân biệt hoa/thường và dấu (gõ "dang" vẫn tô "đăng") */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((seg, i) =>
        seg.match ? (
          <mark key={i} className="rounded bg-white/20 px-0.5 text-inherit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const query = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResult>('/search', { q }),
    enabled: q.trim() !== '',
  });

  return (
    <>
      <PageHeader title="Tìm kiếm" description="Tìm xuyên các dự án bạn tham gia: công việc, bình luận, tài liệu, test case, phiên bản và file. Không phân biệt hoa thường hay dấu." />
      <form
        className="relative mb-6 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập từ khóa, ví dụ: dang nhap" aria-label="Từ khóa" className={`${inputClass} pl-9`} />
      </form>

      {q.trim() === '' ? (
        <EmptyState title="Nhập từ khóa để tìm" description="Nhiều từ khóa nghĩa là phải có đủ cả các từ (ở bất kỳ trường nào của mục đó)." />
      ) : query.isLoading ? (
        <PageLoader />
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.total === 0 ? (
        <EmptyState title={`Không tìm thấy "${q}"`} description="Thử từ khóa ngắn hơn hoặc bỏ bớt từ." />
      ) : (
        <div className="space-y-6">
          {query.data.groups.map((group) => {
            const meta = KIND[group.kind];
            const Icon = meta.icon;
            return (
              <Card key={group.kind} title={`${meta.label} (${group.hits.length})`} action={<Icon className="h-4 w-4 text-slate-400" aria-hidden />}>
                <ul className="divide-y divide-slate-100">
                  {group.hits.map((hit) => (
                    <li key={`${hit.kind}-${hit.id}`} className="py-3">
                      <Link to={hit.link} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                        <Highlight text={hit.title} terms={query.data.terms} />
                      </Link>
                      <p className="text-xs text-slate-500">{hit.projectName}</p>
                      {hit.snippet && (
                        <p className="mt-1 text-sm text-slate-600">
                          <Highlight text={hit.snippet} terms={query.data.terms} />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
