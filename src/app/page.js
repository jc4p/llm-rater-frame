import HomeComponent from '@/components/HomeComponent';
import { generatePageMetadata } from '@/lib/generate-page-metadata';

export async function generateMetadata({ searchParams }) {
  const waitedSearchParams = await searchParams;
  return generatePageMetadata({
    queryParams: waitedSearchParams
  });
}

export default function Home() {
  return <HomeComponent />;
}
