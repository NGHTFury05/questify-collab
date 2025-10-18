import { Navigate, useParams } from 'react-router-dom';

export default function PostDetailRedirect() {
  const { id, post_id } = useParams();
  const target = (id ?? post_id) ?? '';
  const to = target ? `/feed?thread=${encodeURIComponent(target)}` : '/feed';
  return <Navigate to={to} replace />;
}