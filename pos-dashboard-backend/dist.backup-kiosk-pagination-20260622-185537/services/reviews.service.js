"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const axios_1 = __importDefault(require("axios"));
class ReviewsService {
    async fetchGoogleReviews(accessToken, locationPath) {
        // Google Business Profile API - reviews endpoint
        // Note: Requires business.manage scope and verified location
        const url = `https://mybusiness.googleapis.com/v4/${locationPath}/reviews`;
        try {
            const res = await axios_1.default.get(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { pageSize: 10 },
            });
            return (res.data.reviews || []).map((r) => ({
                id: r.reviewId,
                platform: 'google',
                author: r.reviewer?.displayName || 'Anonymous',
                rating: r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4 : 3,
                text: r.comment || '',
                date: r.createTime,
                reply: r.reviewReply?.comment,
            }));
        }
        catch (err) {
            console.error('Google reviews fetch failed', err);
            return [];
        }
    }
    async fetchFacebookReviews(accessToken, pageId) {
        // Facebook Graph API - ratings/reviews for a Page
        const url = `https://graph.facebook.com/v19.0/${pageId}/ratings`;
        try {
            const res = await axios_1.default.get(url, {
                params: {
                    access_token: accessToken,
                    fields: 'reviewer,rating,review_text,created_time,open_graph_story',
                    limit: 10,
                },
            });
            return (res.data.data || []).map((r) => ({
                id: r.id,
                platform: 'facebook',
                author: r.reviewer?.name || 'Anonymous',
                rating: r.rating || 0,
                text: r.review_text || '',
                date: r.created_time,
            }));
        }
        catch (err) {
            console.error('Facebook reviews fetch failed', err);
            return [];
        }
    }
    // Optional: reply to a review (if API supports it)
    async replyToReview(platform, accessToken, reviewId, replyText) {
        // Implementation for Google or Facebook reply endpoints would go here
        // For now, return false as placeholder
        console.log(`Reply requested for ${platform} review ${reviewId}: ${replyText}`);
        return false;
    }
}
exports.ReviewsService = ReviewsService;
//# sourceMappingURL=reviews.service.js.map