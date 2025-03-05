import HomeComponent from '@/components/HomeComponent';
import { generatePageMetadata } from '@/lib/generate-page-metadata';

export async function generateMetadata() {
  // You can pass dynamic parameters here
  return generatePageMetadata({
    // Example of dynamic parameters:
    // title: 'Dynamic Title',
    // description: 'Dynamic description based on page context'
  });
}

export default function Home() {
  return <HomeComponent />;
}
