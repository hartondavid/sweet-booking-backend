import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key not configured! Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload a file to Supabase Storage
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileName - The file name
 * @param {string} bucketName - The bucket name (default: 'cakes')
 * @param {string} folder - The folder path (default: 'uploads')
 * @returns {Promise<{url: string, path: string, error: string|null}>}
 */
export const uploadFile = async (fileBuffer, fileName, bucketName = 'cakes', folder = 'uploads') => {
    try {
        console.log('📤 Uploading file to Supabase Storage:', fileName);

        const filePath = `${folder}/${Date.now()}_${fileName}`;

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, fileBuffer, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Supabase upload error:', error);
            return { url: null, path: null, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        console.log('✅ File uploaded successfully:', urlData.publicUrl);

        return {
            url: urlData.publicUrl,
            path: filePath,
            error: null
        };
    } catch (error) {
        console.error('❌ Error uploading file:', error);
        return { url: null, path: null, error: error.message };
    }
};

/**
 * Delete a file from Supabase Storage
 * @param {string} filePath - The file path in storage
 * @param {string} bucketName - The bucket name (default: 'cakes')
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteFile = async (filePath, bucketName = 'cakes') => {
    try {
        console.log('🗑️ Deleting file from Supabase Storage:', filePath);

        const { error } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (error) {
            console.error('❌ Supabase delete error:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ File deleted successfully');
        return { success: true, error: null };
    } catch (error) {
        console.error('❌ Error deleting file:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get public URL for a file
 * @param {string} filePath - The file path in storage
 * @param {string} bucketName - The bucket name (default: 'cakes')
 * @returns {string} The public URL
 */
export const getPublicUrl = (filePath, bucketName = 'cakes') => {
    const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

    return data.publicUrl;
};

export default {
    uploadFile,
    deleteFile,
    getPublicUrl
}; 