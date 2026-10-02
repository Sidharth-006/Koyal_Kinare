import PurchaseDetailPage from './PurchaseDetailClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <PurchaseDetailPage />;
}
