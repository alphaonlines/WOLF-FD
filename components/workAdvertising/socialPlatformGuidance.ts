import type { SocialAccount, SocialPlatform } from "../../services/socialApi";

export type SocialPlatformMeta = {
  id: SocialPlatform;
  label: string;
  docsUrl: string;
  helpText: string;
  externalIdLabel: string;
  externalIdPlaceholder: string;
  accessTokenLabel: string;
  refreshTokenLabel: string;
  configExample: string;
  requirements: string[];
};

export type TokenExpiryState = "unknown" | "valid" | "expiring" | "expired";

export type SocialAccountReadiness = {
  ready: boolean;
  severity: "ready" | "warning" | "error";
  headline: string;
  summary: string;
  issues: string[];
  warnings: string[];
  requirements: string[];
  tokenExpiryState: TokenExpiryState;
  tokenExpiryLabel: string;
};

const GOOGLE_LOCATION_PATH_RE = /^accounts\/[^/]+\/locations\/[^/]+$/i;
const EXPIRING_SOON_MS = 1000 * 60 * 60 * 24 * 7;

export const SOCIAL_PLATFORM_META_BY_ID: Record<SocialPlatform, SocialPlatformMeta> = {
  facebook: {
    id: "facebook",
    label: "Facebook",
    docsUrl: "https://developers.facebook.com/docs/pages-api/posts/",
    helpText:
      "Use a Facebook Page ID plus a Page access token. This app publishes to Pages, not personal profiles.",
    externalIdLabel: "Facebook Page ID",
    externalIdPlaceholder: "123456789012345",
    accessTokenLabel: "Page access token",
    refreshTokenLabel: "Refresh token",
    configExample: '{\n  "appId": "1234567890",\n  "notes": "Main showroom page"\n}',
    requirements: [
      "Meta's current Pages API docs call for a Page access token with pages_manage_engagement, pages_manage_posts, pages_read_engagement, and pages_read_user_engagement.",
      "Video publishing also needs publish_video.",
      "The app user should be able to perform CREATE_CONTENT, MANAGE, and MODERATE tasks on the Page.",
    ],
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing/",
    helpText:
      "Use an Instagram professional account ID plus a valid token. Media must stay publicly reachable on this server until publish time.",
    externalIdLabel: "Instagram professional account ID",
    externalIdPlaceholder: "17841400000000000",
    accessTokenLabel: "Instagram access token",
    refreshTokenLabel: "Refresh token",
    configExample:
      '{\n  "loginType": "facebook-login",\n  "pagePublishingAuthorizationCompleted": true,\n  "notes": "Main IG profile"\n}',
    requirements: [
      "Instagram publishing requires a professional Instagram account connected to a Facebook Page.",
      "The docs currently list instagram_business_basic + instagram_business_content_publish for Instagram Login, or instagram_basic + instagram_content_publish + pages_read_engagement for Facebook Login.",
      "Meta notes Page Publishing Authorization can still block posting, and there is no API check for it.",
      "Instagram currently limits API-published posts to 100 within a moving 24-hour period.",
    ],
  },
  google: {
    id: "google",
    label: "Google Business Profile",
    docsUrl: "https://developers.google.com/my-business/content/posts-data",
    helpText:
      "Use the exact Business Profile location path and OAuth tokens. Offline access with a refresh token is recommended for stable scheduling.",
    externalIdLabel: "Location path",
    externalIdPlaceholder: "accounts/123456789/locations/987654321",
    accessTokenLabel: "OAuth access token",
    refreshTokenLabel: "OAuth refresh token",
    configExample:
      '{\n  "oauthClientId": "your-app.apps.googleusercontent.com",\n  "projectId": "wolf-social",\n  "notes": "Primary GBP location"\n}',
    requirements: [
      "Google's current Business Profile docs require OAuth 2.0 with the business.manage scope.",
      "The localPosts endpoint uses accounts/{accountId}/locations/{locationId}/localPosts.",
      "Offline access and refresh tokens are recommended so scheduled posts survive access-token expiry.",
    ],
  },
};

export const SOCIAL_PLATFORM_OPTIONS = Object.values(SOCIAL_PLATFORM_META_BY_ID).map(({ id, label }) => ({
  id,
  label,
}));

function getTokenExpiryState(tokenExpiresAt: string | null | undefined) {
  if (!tokenExpiresAt) {
    return {
      state: "unknown" as TokenExpiryState,
      label: "No token expiry saved",
    };
  }

  const expiresAt = new Date(tokenExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      state: "unknown" as TokenExpiryState,
      label: "Token expiry is invalid",
    };
  }

  const delta = expiresAt.getTime() - Date.now();
  if (delta <= 0) {
    return {
      state: "expired" as TokenExpiryState,
      label: `Expired ${expiresAt.toLocaleString()}`,
    };
  }
  if (delta <= EXPIRING_SOON_MS) {
    return {
      state: "expiring" as TokenExpiryState,
      label: `Expires soon: ${expiresAt.toLocaleString()}`,
    };
  }
  return {
    state: "valid" as TokenExpiryState,
    label: `Expires ${expiresAt.toLocaleString()}`,
  };
}

export function getSocialAccountReadiness(
  platform: SocialPlatform,
  account: SocialAccount | null
): SocialAccountReadiness {
  const meta = SOCIAL_PLATFORM_META_BY_ID[platform];
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!account) {
    issues.push(`No saved ${meta.label} connection is selected.`);
    return {
      ready: false,
      severity: "error",
      headline: "Missing setup",
      summary: "No saved connection",
      issues,
      warnings,
      requirements: meta.requirements,
      tokenExpiryState: "unknown",
      tokenExpiryLabel: "No token expiry saved",
    };
  }

  const externalId = String(account.externalId || "").trim();
  const tokenState = getTokenExpiryState(account.tokenExpiresAt);

  if (!account.active) {
    issues.push("Connection is marked inactive.");
  }
  if (!externalId) {
    issues.push(`Missing ${meta.externalIdLabel}.`);
  }
  if (platform === "google" && externalId && !GOOGLE_LOCATION_PATH_RE.test(externalId)) {
    issues.push("Location path should look like accounts/{accountId}/locations/{locationId}.");
  }
  if (!account.accessTokenConfigured) {
    issues.push(`Missing ${meta.accessTokenLabel}.`);
  }
  if (tokenState.state === "expired") {
    issues.push("Saved access token is expired.");
  } else if (tokenState.state === "expiring") {
    warnings.push("Saved access token expires soon.");
  }

  if (platform === "google" && !account.refreshTokenConfigured) {
    warnings.push("No refresh token is saved, so Google scheduling may stop when the access token expires.");
  }

  const loginType = String(account.configJson?.loginType || "").trim().toLowerCase();
  if (platform === "instagram" && loginType !== "instagram-login" && loginType !== "facebook-login") {
    warnings.push("Set configJson.loginType to instagram-login or facebook-login so staff know which Meta permission set this connection uses.");
  }
  if (platform === "instagram" && account.configJson?.pagePublishingAuthorizationCompleted !== true) {
    warnings.push("Page Publishing Authorization is not confirmed in config. Meta can block Instagram publishing until it is completed.");
  }

  let severity: SocialAccountReadiness["severity"] = "ready";
  if (issues.length) severity = "error";
  else if (warnings.length) severity = "warning";

  return {
    ready: issues.length === 0,
    severity,
    headline:
      severity === "error" ? "Needs setup" : severity === "warning" ? "Ready with checks" : "Ready",
    summary: account.label || externalId || `${meta.label} connection`,
    issues,
    warnings,
    requirements: meta.requirements,
    tokenExpiryState: tokenState.state,
    tokenExpiryLabel: tokenState.label,
  };
}

