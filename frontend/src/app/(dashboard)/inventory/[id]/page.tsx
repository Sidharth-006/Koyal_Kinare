import InventoryItemStockPage from './InventoryItemStockClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: { id: string } }) {
  return <InventoryItemStockPage params={params} />;
}
