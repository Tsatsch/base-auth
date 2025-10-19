/**
 * Image Compression Utility
 * Compresses images before uploading to IPFS to save storage space and bandwidth
 */

import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

/**
 * Compresses an image file to optimize for IPFS storage
 * @param file The image file to compress
 * @param options Compression options
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 0.5, // Maximum file size in MB (500KB)
    maxWidthOrHeight: 512, // Maximum width or height in pixels
    useWebWorker: true, // Use web worker for better performance
    fileType: 'image/png', // Output format
    ...options,
  };

  try {
    console.log('🖼️  Compressing image...');
    console.log('   Original size:', (file.size / 1024).toFixed(2), 'KB');
    console.log('   Target size:', defaultOptions.maxSizeMB * 1024, 'KB');
    console.log('   Max dimensions:', defaultOptions.maxWidthOrHeight, 'px');

    const compressedFile = await imageCompression(file, defaultOptions);

    console.log('✅ Image compressed successfully');
    console.log('   Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');
    console.log('   Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1), '%');

    return compressedFile;
  } catch (error) {
    console.error('❌ Image compression error:', error);
    throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates if a file is a valid image
 * @param file The file to validate
 * @returns true if the file is a valid image
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB max before compression

  if (!validTypes.includes(file.type)) {
    console.error('Invalid file type:', file.type);
    return false;
  }

  if (file.size > maxSize) {
    console.error('File too large:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    return false;
  }

  return true;
}

/**
 * Converts a File to a data URL for preview
 * @param file The file to convert
 * @returns Promise resolving to data URL
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Gets image dimensions
 * @param file The image file
 * @returns Promise resolving to dimensions
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

