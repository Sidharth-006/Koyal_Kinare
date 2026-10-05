import MenuItemRecipeClient from './MenuItemRecipeClient';

export const dynamicParams = true;

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <MenuItemRecipeClient />;
}
