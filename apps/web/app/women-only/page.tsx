import { redirect } from 'next/navigation';

/** Legacy entry point; all access states are rendered by /woz. */
export default function WomenOnlyPage() {
  redirect('/woz');
}
