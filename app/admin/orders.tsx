import { AdminWebConsole } from './AdminWebConsole';

export default function AdminOrdersScreen() {
  return (
    <AdminWebConsole
      title="Shop Operations"
      subtitle="Shop- und Creator-Operations werden zentral im Web-Admin geprüft."
      primaryPath="/payouts"
    />
  );
}
