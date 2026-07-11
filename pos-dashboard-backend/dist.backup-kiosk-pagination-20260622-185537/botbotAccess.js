"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOTBOT_SKILL_CATALOG = void 0;
exports.normalizeRoleKey = normalizeRoleKey;
exports.userRoleKeys = userRoleKeys;
exports.isAdminRole = isAdminRole;
exports.inferBotBotSkill = inferBotBotSkill;
exports.skillDefaultsForUser = skillDefaultsForUser;
exports.isLocalProvider = isLocalProvider;
exports.defaultModelAllowed = defaultModelAllowed;
exports.resolveModelAccess = resolveModelAccess;
exports.resolveSkillAccess = resolveSkillAccess;
exports.BOTBOT_SKILL_CATALOG = [
    {
        skillKey: "dashboard_help",
        label: "Dashboard Help",
        description: "Explain the dashboard, navigation, and general workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "sales_analysis",
        label: "Sales Analysis",
        description: "Help interpret sales dashboards, trends, and performance views.",
        defaultAllowed: true,
    },
    {
        skillKey: "den_ups",
        label: "DEN UPS",
        description: "Help with UPS queue, customer handoffs, and DEN floor workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "crm_help",
        label: "CRM Help",
        description: "Help with customer lookup, CRM notes, and follow-up workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "tasks_help",
        label: "Tasks Help",
        description: "Help with task board usage, assignments, and follow-up steps.",
        defaultAllowed: true,
    },
    {
        skillKey: "meeting_help",
        label: "Meeting Help",
        description: "Help with meeting room and team meeting workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "message_board_help",
        label: "Message Board Help",
        description: "Help with team messages, announcements, and board etiquette.",
        defaultAllowed: true,
    },
    {
        skillKey: "product_search_help",
        label: "Product Search Help",
        description: "Help with product search, item lookups, and shop workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "social_marketing_help",
        label: "Social / Marketing Help",
        description: "Help with AMP, social posts, marketing, and promotions.",
        defaultAllowed: true,
    },
    {
        skillKey: "data_upload_help",
        label: "Data Upload Help",
        description: "Help with POS report uploads, manager specials, and database update workflows.",
        defaultAllowed: true,
    },
    {
        skillKey: "admin_help",
        label: "Admin Help",
        description: "Help owners/admins understand settings, permissions, and system controls.",
        defaultAllowed: false,
        adminOnly: true,
    },
    {
        skillKey: "ai_settings_admin",
        label: "AI Settings Admin",
        description: "Manage BotBot/AlphaAI models, skills, quotas, and usage controls.",
        defaultAllowed: false,
        adminOnly: true,
    },
    {
        skillKey: "api_model_access",
        label: "API Model Access",
        description: "Use owner-enabled API/cloud models through the alphahs control plane.",
        defaultAllowed: false,
        adminOnly: true,
    },
];
const SKILL_MAP = new Map(exports.BOTBOT_SKILL_CATALOG.map((skill) => [skill.skillKey, skill]));
function normalizeRoleKey(role) {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function userRoleKeys(user) {
    const roles = (user.roles || []).map(normalizeRoleKey).filter(Boolean);
    return roles.length ? roles : ["employee"];
}
function isAdminRole(user) {
    return userRoleKeys(user).some((role) => role === "owner" || role === "admin" || role === "administrator");
}
function inferBotBotSkill(pageContext) {
    const moduleName = String(pageContext?.module || "").toLowerCase();
    const pageName = String(pageContext?.pageName || "").toLowerCase();
    const haystack = `${moduleName} ${pageName}`;
    if (haystack.includes("sales") || haystack.includes("pulse"))
        return "sales_analysis";
    if (haystack.includes("ups"))
        return "den_ups";
    if (haystack.includes("crm") || haystack.includes("customer"))
        return "crm_help";
    if (haystack.includes("task"))
        return "tasks_help";
    if (haystack.includes("meeting"))
        return "meeting_help";
    if (haystack.includes("board") || haystack.includes("message"))
        return "message_board_help";
    if (haystack.includes("product") || haystack.includes("shop"))
        return "product_search_help";
    if (haystack.includes("amp") || haystack.includes("social") || haystack.includes("marketing"))
        return "social_marketing_help";
    if (haystack.includes("upload") || haystack.includes("database"))
        return "data_upload_help";
    if (haystack.includes("setting") || haystack.includes("admin"))
        return "admin_help";
    return "dashboard_help";
}
function skillDefaultsForUser(skillKey, user) {
    const skill = SKILL_MAP.get(skillKey);
    if (!skill)
        return false;
    if (skill.adminOnly && isAdminRole(user))
        return true;
    return skill.defaultAllowed;
}
function isLocalProvider(provider) {
    return provider === "wolfbot" || provider === "ollama";
}
function defaultModelAllowed(provider) {
    return isLocalProvider(provider);
}
async function resolveModelAccess(pool, user, modelKey, provider, fallbackQuota) {
    const userResult = await pool.query(`SELECT allowed, token_quota
     FROM botbot_model_access
     WHERE subject_type = 'user' AND subject_key = $1 AND model_key = $2
     LIMIT 1`, [String(user.id), modelKey]);
    if (userResult.rows[0]) {
        return {
            allowed: Boolean(userResult.rows[0].allowed),
            tokenQuota: Number(userResult.rows[0].token_quota ?? fallbackQuota),
            source: "user",
        };
    }
    const roles = userRoleKeys(user);
    const roleResult = await pool.query(`SELECT allowed, token_quota
     FROM botbot_model_access
     WHERE subject_type = 'role' AND subject_key = ANY($1::text[]) AND model_key = $2`, [roles, modelKey]);
    if (roleResult.rows.length) {
        const allowedRows = roleResult.rows.filter((row) => Boolean(row.allowed));
        const quotaRows = (allowedRows.length ? allowedRows : roleResult.rows)
            .map((row) => Number(row.token_quota ?? fallbackQuota))
            .filter((value) => Number.isFinite(value) && value >= 0);
        return {
            allowed: allowedRows.length > 0,
            tokenQuota: quotaRows.length ? Math.max(...quotaRows) : fallbackQuota,
            source: "role",
        };
    }
    return {
        allowed: defaultModelAllowed(provider),
        tokenQuota: fallbackQuota,
        source: "default",
    };
}
async function resolveSkillAccess(pool, user, skillKey) {
    const userResult = await pool.query(`SELECT allowed
     FROM botbot_skill_access
     WHERE subject_type = 'user' AND subject_key = $1 AND skill_key = $2
     LIMIT 1`, [String(user.id), skillKey]);
    if (userResult.rows[0]) {
        return { allowed: Boolean(userResult.rows[0].allowed), source: "user" };
    }
    const roles = userRoleKeys(user);
    const roleResult = await pool.query(`SELECT allowed
     FROM botbot_skill_access
     WHERE subject_type = 'role' AND subject_key = ANY($1::text[]) AND skill_key = $2`, [roles, skillKey]);
    if (roleResult.rows.length) {
        return {
            allowed: roleResult.rows.some((row) => Boolean(row.allowed)),
            source: "role",
        };
    }
    return {
        allowed: skillDefaultsForUser(skillKey, user),
        source: "default",
    };
}
//# sourceMappingURL=botbotAccess.js.map