import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClientWorkspace } from '../components/layout/ClientWorkspace';

const WorkspacePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const initialSessionId = idParam && idParam !== 'new' ? parseInt(idParam, 10) : null;

  return <ClientWorkspace initialSessionId={initialSessionId} />;
};

export default WorkspacePage;
