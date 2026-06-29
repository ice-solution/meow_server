import { Navigate, useLocation } from 'react-router-dom';
import { getAdminToken } from '../utils/adminApi';

export default function AdminGuard({ children }) {
  const location = useLocation();
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
