import { permanentRedirect } from 'next/navigation';

export default function RootPage() {
  permanentRedirect('/en');
}
