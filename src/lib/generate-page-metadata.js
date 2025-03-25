/**
 * Generates dynamic metadata for the Frame page
 * @param {Object} options - Options for generating metadata
 * @param {string} options.title - The title of the page
 * @param {string} options.description - The description of the page
 * @param {string} options.imageUrl - The URL for the preview image (3:2 ratio recommended)
 * @param {string} options.buttonTitle - The title for the button
 * @param {string} options.appUrl - The app URL for the frame
 * @param {string} options.splashImageUrl - The splash image URL
 * @param {string} options.splashBackgroundColor - The background color for the splash screen
 * @param {string} options.queryParams - The query parameters from the URL
 * @returns {Object} The metadata object
 */
export async function generatePageMetadata(options = {}) {
  // Get query parameters from options if available
  const { queryParams } = options;
  
  // Check for image query parameter
  let finalImageUrl = 'https://images.kasra.codes/favorite-llm/image-url-default.png';
  if (queryParams?.image) {
    // Use the image parameter to construct the URL (without the bucket folder path)
    finalImageUrl = `https://images.kasra.codes/favorite-llm/${queryParams.image}`;
  }

  const {
    title = 'AI Best Friend Finder',
    description = 'Discover which AI understands you best!',
    imageUrl = finalImageUrl,
    buttonTitle = 'Analyze Me, AI',
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    splashImageUrl = 'https://images.kasra.codes/favorite-llm/splash-icon-transparent.png',
    splashBackgroundColor = '#ffffff',
  } = options;

  return {
    title,
    description,
    other: {
      'fc:frame': JSON.stringify({
        version: "next",
        imageUrl,
        button: {
          title: buttonTitle,
          action: {
            type: "launch_frame",
            name: "AI Best Friend Finder",
            url: appUrl,
            splashImageUrl,
            splashBackgroundColor
          }
        }
      })
    }
  };
} 