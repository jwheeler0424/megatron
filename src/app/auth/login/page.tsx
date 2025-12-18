import { use } from 'react';
import { LoginForm } from '../_components/LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = use(searchParams);
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm searchParams={params} />
      </div>
    </div>
  );
}
