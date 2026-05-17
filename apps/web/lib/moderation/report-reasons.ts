export const POST_REPORT_REASONS = [
  { value: 'spam', label: 'Spam oder Betrug' },
  { value: 'nsfw', label: 'Nacktheit oder sexuelle Inhalte' },
  { value: 'violence', label: 'Gewalt oder gefährliche Inhalte' },
  { value: 'hate_speech', label: 'Hassrede oder Diskriminierung' },
  { value: 'harassment', label: 'Belästigung oder Mobbing' },
  { value: 'copyright', label: 'Copyright-Verstoß' },
  { value: 'other', label: 'Anderer Grund' },
] as const;

export type PostReportReason = (typeof POST_REPORT_REASONS)[number]['value'];

export const POST_REPORT_REASON_VALUES = POST_REPORT_REASONS.map((reason) => reason.value) as [
  PostReportReason,
  ...PostReportReason[],
];

export const USER_REPORT_REASONS = [
  { value: 'spam', label: 'Spam oder irreführend' },
  { value: 'harassment', label: 'Belästigung oder Mobbing' },
  { value: 'inappropriate', label: 'Unangemessene Inhalte' },
  { value: 'fake_account', label: 'Gefälschtes Konto' },
  { value: 'other', label: 'Anderer Grund' },
] as const;

export type UserReportReason = (typeof USER_REPORT_REASONS)[number]['value'];

export const USER_REPORT_REASON_VALUES = USER_REPORT_REASONS.map((reason) => reason.value) as [
  UserReportReason,
  ...UserReportReason[],
];
