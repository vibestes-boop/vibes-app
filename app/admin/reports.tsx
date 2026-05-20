import { AdminWebConsole } from './AdminWebConsole';

export default function AdminReportsScreen() {
  return (
    <AdminWebConsole
      title="Moderation"
      subtitle="Reports, SLA und Enforcement laufen zentral im Web Command Center."
      primaryPath="/reports"
    />
  );
}
