export type PollOption = {
  id: number; // 1..5
  title: string; // short title
  action: "add_rule" | "remove_rule" | "replace_rule";
  key: string; // rule key (e.g. "no_apologies")
  text?: string; // rule text (for add/replace)
};

export type PollState = {
  pollTweetId?: string;
  pollCreatedAt?: number; // unix ms
  pollOptions?: PollOption[];
  lastResult?: {
    winnerId: number;
    counts: Record<number, number>;
    totalVoters: number;
    appliedAt: number;
    appliedPatch?: {
      action: string;
      key: string;
      before?: any;
      after?: any;
    };
  };
};
