/**
 * Utility to handle RunningHub URL proxying to avoid CORS issues.
 * Replaces hardcoded bucket domains with the local /rh-images proxy path.
 */
export const proxyRunningHubUrl = (url: string): string => {
    if (!url) return url;

    // Catch various RunningHub bucket variations (e.g., rh-images, rh-assets, etc. on myqcloud.com)
    // Example: https://rh-images-1252422369.cos.ap-beijing.myqcloud.com/path/to/image.png
    const rhBucketRegex = /https?:\/\/rh-[^/]+\.myqcloud\.com/i;

    if (rhBucketRegex.test(url)) {
        return url.replace(rhBucketRegex, '/rh-images');
    }

    return url;
};
