import { useAuth } from '../auth/useAuth';
import { PageHeader } from '../components/ui/Card';

export default function DashboardPage() {
  const { user } = useAuth();
  return <PageHeader title={`Xin chào, ${user?.name ?? ''}`} description="Tổng quan công việc của bạn" />;
}
