import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="hero-title">404</p>
      <p className="mt-6 text-lg font-semibold tracking-tight text-white">Không tìm thấy trang</p>
      <p className="mt-1 text-sm text-slate-500">Trang bạn tìm không tồn tại hoặc đã bị di chuyển.</p>
      <Link to="/" className="mt-8 rounded-full bg-white px-8 py-[15px] text-sm font-semibold text-black transition duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[0_12px_36px_var(--glow)]">
        Về trang tổng quan
      </Link>
    </div>
  );
}
