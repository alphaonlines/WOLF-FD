export interface Review {
    id: string;
    platform: 'google' | 'facebook';
    author: string;
    rating: number;
    text: string;
    date: string;
    reply?: string;
}
export declare class ReviewsService {
    fetchGoogleReviews(accessToken: string, locationPath: string): Promise<Review[]>;
    fetchFacebookReviews(accessToken: string, pageId: string): Promise<Review[]>;
    replyToReview(platform: 'google' | 'facebook', accessToken: string, reviewId: string, replyText: string): Promise<boolean>;
}
