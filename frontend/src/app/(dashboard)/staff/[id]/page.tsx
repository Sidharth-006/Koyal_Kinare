import StaffDetailPage from './StaffDetailClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <StaffDetailPage />;
}
