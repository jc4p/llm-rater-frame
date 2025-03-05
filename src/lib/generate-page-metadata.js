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
 * @returns {Object} The metadata object
 */
export async function generatePageMetadata(options = {}) {
  const {
    title = 'LLM Rater Frame',
    description = 'A frame for rating LLM responses',
    imageUrl = 'https://placehold.co/1200x800/png',
    buttonTitle = 'Try now!',
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    splashImageUrl = 'https://placehold.co/1200x800/png',
    splashBackgroundColor = '#ffffff',
  } = options;

  // You can add dynamic logic here to generate metadata
  // For example, you could fetch data from an API or database

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
            name: "llm-rater-frame",
            url: appUrl,
            splashImageUrl,
            splashBackgroundColor
          }
        }
      })
    }
  };
} 