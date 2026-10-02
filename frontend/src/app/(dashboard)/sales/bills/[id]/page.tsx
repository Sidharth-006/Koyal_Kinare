import BillDetailPage from './BillDetailClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <BillDetailPage />;
}
