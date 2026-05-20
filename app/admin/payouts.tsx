import { AdminWebConsole } from './AdminWebConsole';

export default function AdminPayoutsScreen() {
  return (
    <AdminWebConsole
      title="Creator Ops"
      subtitle="Seller-Guthaben und Auszahlungen liegen zentral im Web-Admin."
      primaryPath="/payouts"
    />
  );
}
