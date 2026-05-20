import { AdminWebConsole } from './AdminWebConsole';

export default function AdminUsersScreen() {
  return (
    <AdminWebConsole
      title="Nutzerverwaltung"
      subtitle="Nutzerrollen und Sperren werden zentral im Web-Admin verwaltet."
      primaryPath="/users"
    />
  );
}
