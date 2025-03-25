import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Construct R2 endpoint URL from account ID if not provided directly
const getR2Endpoint = () => {
  // If R2_ENDPOINT is provided, use it
  if (process.env.R2_ENDPOINT) {
    return process.env.R2_ENDPOINT;
  }
  
  // Otherwise construct it from the account ID (standard Cloudflare R2 pattern)
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  
  // Fallback - this will likely cause errors but prevents immediate crash
  console.warn('Missing R2_ENDPOINT or R2_ACCOUNT_ID. Using fallback endpoint.');
  return 'https://example.r2.cloudflarestorage.com';
};

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: getR2Endpoint(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'placeholder-key',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'placeholder-secret',
  },
  forcePathStyle: true, // Required for Cloudflare R2
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME;

/**
 * Upload a file to R2 storage
 * @param {string} key - The file path/key in the bucket
 * @param {Buffer|Uint8Array|string} body - The file content
 * @param {string} contentType - The content type of the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
// Construct R2 public URL from bucket name and account ID if not provided directly
const getR2PublicUrl = () => {
  // If R2_PUBLIC_URL is provided, use it
  if (process.env.R2_PUBLIC_URL) {
    return process.env.R2_PUBLIC_URL;
  }
  
  // Otherwise construct it from the account ID and bucket name (standard Cloudflare R2 pattern)
  if (process.env.R2_ACCOUNT_ID && BUCKET_NAME) {
    return `https://${BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  
  // Fallback
  return 'https://placeholder-public-url.com';
};

export async function uploadToR2(key, body, contentType) {
  try {
    // Always attempt the upload, even in development
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME || 'default-bucket',
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    
    // Construct and return the URL
    const publicUrl = `${getR2PublicUrl()}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    
    // Create a more detailed error message
    const errorMsg = `R2 upload failed: ${error.message}. 
      Check your R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.
      Error details: ${JSON.stringify(error, null, 2)}`;
    console.error(errorMsg);
      
    // We'll rethrow the error since we want to always try uploading
    throw new Error(`Failed to upload to R2: ${error.message}`);
  }
}

/**
 * Retrieve a file from R2 storage
 * @param {string} key - The file path/key in the bucket
 * @returns {Promise<Buffer>} - The file content as a Buffer
 */
export async function getFromR2(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    // Convert the stream to a buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error retrieving from R2:', error);
    throw error;
  }
}
