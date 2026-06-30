export type ActivityType = "wrap" | "unwrap" | "transfer" | "delegation";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  asset: string;
  amount: string;
  timestamp: string;
  /** Epoch seconds – used for sorting (newest first) */
  sortKey: number;
  txHash: string;
}

export interface ActivityTypeConfig {
  label: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  wrap: {
    label: "Wrap",
    icon: "add_box",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  transfer: {
    label: "Transfer",
    icon: "send",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  unwrap: {
    label: "Unwrap",
    icon: "move_to_inbox",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  delegation: {
    label: "Delegation",
    icon: "group",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
  },
};

export const ACTIVITY_TYPES: ActivityType[] = [
  "wrap",
  "unwrap",
  "transfer",
  "delegation",
];
