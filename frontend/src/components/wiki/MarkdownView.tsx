import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Hiển thị Markdown (GFM: bảng, danh sách việc, code). Không cho phép HTML thô nên không có XSS;
 * liên kết ngoài mở tab mới với noopener.
 */
export function MarkdownView({ source }: { source: string }) {
  if (source.trim() === '') return <p className="text-sm text-slate-500">Trang chưa có nội dung.</p>;
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
