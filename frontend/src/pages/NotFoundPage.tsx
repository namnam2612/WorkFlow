import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="mt-3 text-lg font-medium text-slate-800">Không tìm thấy trang</p>
      <p className="mt-1 text-sm text-slate-500">Trang bạn tìm không tồn tại hoặc đã bị di chuyển.</p>
      <Link to="/" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Về trang tổng quan
      </Link>
    </div>
  );
}
