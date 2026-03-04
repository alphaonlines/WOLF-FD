export type TabKey = "overview" | "trends" | "library" | "timing" | "campaigns" | "upload";
export type Platform = "Facebook" | "Instagram";
export type PlatformFilter = "both" | "facebook" | "instagram";
export type TrendMetric = "reach" | "engagements" | "engagementRate" | "views";

export type PostRecord = {
  id: string;
  platform: Platform;
  title: string;
  description: string;
  permalink: string;
  postType: string;
  durationSec: number;
  publishTime: Date;
  dayKey: string;
  dayLabel: string;
  dayOfWeek: number;
  hour: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  linkClicks: number;
  totalClicks: number;
  engagements: number;
  engagementRate: number;
  captionLength: number;
};

export type PendingUpload = {
  records: PostRecord[];
  fileNames: string[];
  platforms: Platform[];
  rangeLabel: string;
  issues: {
    missingPermalink: number;
    duplicates: number;
    overlap: boolean;
  };
};

export type Summary = {
  reach: number;
  views: number;
  engagements: number;
  engagementRate: number;
  linkClicks: number;
  saves: number;
  follows: number;
};
