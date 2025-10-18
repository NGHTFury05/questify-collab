import { Navigate } from 'react-router-dom';

export default function QuizPageRedirect() {
  return <Navigate to="/lesson?quiz=open" replace />;
}
