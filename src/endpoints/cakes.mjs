import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";
import createMulter, { smartUpload } from "../utils/uploadUtils.mjs";
import path from 'path';

const upload = createMulter('public/uploads/cakes', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']);

const router = Router();

// Adaugă o prăjitură
router.post('/addCake', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {

    try {
        console.log('🔍 addCake - Request received');
        console.log('🔍 addCake - Request body:', req.body);
        console.log('🔍 addCake - Request files:', req.files);
        console.log('🔍 addCake - User ID:', req.user?.id);

        const { name, price, description, kcal, grams_per_piece } = req.body;
        const userId = req.user?.id;

        // Detect environment and choose storage method
        const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
        console.log('🔍 addCake - Environment detected:', {
            isProduction,
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV
        });


        console.log('🔍 addCake - Checking files...');
        if (!req.files || !req.files['photo']) {
            console.log('❌ addCake - No photo file found');
            return sendJsonResponse(res, false, 400, "Image is required", null);
        }

        console.log('🔍 addCake - Photo file found:', req.files['photo']);

        // Use smart upload function that automatically chooses storage method
        const photoUrl = await smartUpload(req.files['photo'][0], 'cakes');
        console.log('🔍 addCake - Photo URL determined:', photoUrl);

        console.log('🔍 addCake - Getting database instance...');
        const dbInstance = await db();
        console.log('🔍 addCake - Database instance obtained');

        console.log('🔍 addCake - Checking user rights...');
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        console.log('🔍 addCake - User rights result:', userRights);
        if (!userRights) {
            console.log('❌ addCake - User not authorized');
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        console.log('🔍 addCake - Validating required fields...');
        console.log('🔍 addCake - Fields:', { name, price, description, kcal, grams_per_piece });
        if (!name || !price || !description || !kcal || !grams_per_piece) {
            console.log('❌ addCake - Missing required fields');
            return sendJsonResponse(res, false, 400, "Numele, prețul, descrierea, kcal-ul și cantitatea sunt obligatorii!", []);
        }

        console.log('🔍 addCake - Checking for existing cake...');
        const existingCake = await dbInstance('cakes').where({ name }).first();
        if (existingCake) {
            console.log('❌ addCake - Cake already exists');
            return sendJsonResponse(res, false, 400, "Prăjitura există deja!", []);
        }

        console.log('🔍 addCake - Converting data types...');
        const priceNum = parseFloat(price);
        const kcalNum = parseFloat(kcal);
        const gramsPerPieceNum = parseInt(grams_per_piece);

        console.log('🔍 addCake - Converted values:', { priceNum, kcalNum, gramsPerPieceNum });

        // Validate converted values
        if (isNaN(priceNum) || isNaN(kcalNum) || isNaN(gramsPerPieceNum)) {
            console.log('❌ addCake - Invalid numeric values');
            return sendJsonResponse(res, false, 400, "Valorile numerice nu sunt valide!", []);
        }

        console.log('🔍 addCake - Converting price per kg...');
        const price_per_kg = (priceNum * 1000) / gramsPerPieceNum;
        console.log('🔍 addCake - Price per kg calculated:', price_per_kg);

        console.log('🔍 addCake - Inserting cake into database...');
        const insertData = {
            name,
            price: priceNum,
            description,
            photo: photoUrl,
            total_quantity: 0,
            kcal: kcalNum,
            admin_id: userId,
            grams_per_piece: gramsPerPieceNum,
            price_per_kg
        };
        console.log('🔍 addCake - Insert data:', insertData);
        console.log('🔍 addCake - Data types:', {
            name: typeof name,
            price: typeof price,
            description: typeof description,
            kcal: typeof kcal,
            grams_per_piece: typeof grams_per_piece,
            price_per_kg: typeof price_per_kg,
            userId: typeof userId
        });

        console.log('🔍 addCake - Attempting database insert...');
        const insertResult = await dbInstance('cakes').insert(insertData);
        console.log('🔍 addCake - Insert result:', insertResult);

        // Handle different database return formats
        let id;
        if (Array.isArray(insertResult)) {
            id = insertResult[0];
        } else if (insertResult && insertResult.length > 0) {
            id = insertResult[0];
        } else {
            // If no ID returned, try to get the last inserted ID
            const lastInserted = await dbInstance('cakes').orderBy('id', 'desc').first();
            id = lastInserted ? lastInserted.id : null;
        }

        console.log('🔍 addCake - Insert completed, ID:', id);

        if (!id) {
            console.log('❌ addCake - No ID returned from insert');
            return sendJsonResponse(res, false, 500, "Eroare la salvarea prăjiturii - ID invalid!", []);
        }

        console.log('🔍 addCake - Fetching created cake...');
        const cake = await dbInstance('cakes').where({ id }).first();
        console.log('🔍 addCake - Cake fetched:', cake);

        console.log('✅ addCake - Success! Returning response...');
        return sendJsonResponse(res, true, 201, "Prăjitura a fost adăugată cu succes!", { cake });
    } catch (error) {
        console.error('❌ addCake - Error occurred:', error);
        console.error('❌ addCake - Error stack:', error.stack);
        console.error('❌ addCake - Error message:', error.message);
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea prăjiturii!", { details: error.message });
    }
});

// Actualizează o prăjitură
router.put('/updateCake/:cakeId', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { name, price, description, kcal, grams_per_piece } = req.body;

        if (!name || !price || !description || !kcal || !grams_per_piece) {
            return sendJsonResponse(res, false, 400, "Numele, prețul, descrierea, kcal-ul și cantitatea sunt obligatorii!", []);
        }

        // Detect environment and choose storage method
        const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
        console.log('🔍 updateCake - Environment detected:', {
            isProduction,
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV
        });

        const dbInstance = await db();
        const cake = await dbInstance('cakes').where({ id: cakeId }).first();

        if (!cake) return sendJsonResponse(res, false, 404, "Prăjitura nu există!", []);

        const price_per_kg = (price * 1000) / grams_per_piece;

        const updateData = {
            name: name || cake.name,
            price: price || cake.price,
            description: description || cake.description,
            photo: cake.photo,
            kcal: kcal || cake.kcal,
            grams_per_piece: grams_per_piece || cake.grams_per_piece,
            price_per_kg: price_per_kg || cake.price_per_kg,
        }

        if (req.files && req.files['photo'] && req.files['photo'][0]) {
            // Use smart upload function that automatically chooses storage method
            const photoUrl = await smartUpload(req.files['photo'][0], 'cakes');
            console.log('🔍 updateCake - Photo URL determined:', photoUrl);
            updateData.photo = photoUrl;
        }

        const updated = await dbInstance('cakes').where({ id: cakeId }).update(updateData);

        if (!updated) return sendJsonResponse(res, false, 404, "Prăjitura nu a fost actualizată!", []);

        return sendJsonResponse(res, true, 200, "Prăjitura a fost actualizată cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la actualizarea prăjiturii!", { details: error.message });
    }
});

// Șterge o prăjitură
router.delete('/deleteCake/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;

        const dbInstance = await db();
        const cake = await dbInstance('cakes').where({ id: cakeId }).first();
        const reservations = await dbInstance('reservations').where({ cake_id: cakeId });

        if (!cake) return sendJsonResponse(res, false, 404, "Prăjitura nu există!", []);
        if (reservations.length > 0) return sendJsonResponse(res, false, 400, "Prăjitura are rezervări!", []);

        await dbInstance('cakes').where({ id: cakeId }).del();

        return sendJsonResponse(res, true, 200, "Prăjitura a fost ștearsă cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea prăjiturii!", { details: error.message });
    }
});

// Obține o prăjitură după id
router.get('/getCake/:cakeId', userAuthMiddleware, async (req, res) => {
    const { cakeId } = req.params;
    try {
        const dbInstance = await db();
        const cake = await dbInstance('cakes')
            .where('cakes.id', cakeId)
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.total_quantity',
                'cakes.kcal',
                'cakes.grams_per_piece',
            )
            .first();
        if (!cake) {
            return sendJsonResponse(res, false, 404, 'Prăjitura nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Prăjitura a fost găsită!', cake);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturii!', { details: error.message });
    }
});

router.get('/getCakes', userAuthMiddleware, async (req, res) => {
    try {

        const userId = req.user.id;
        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }
        const cakes = await dbInstance('cakes')
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.total_quantity',
                'cakes.kcal',
                'cakes.created_at',
                'cakes.grams_per_piece',
                'cakes.price_per_kg',
            )

        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există prăjituri!', []);
        }
        return sendJsonResponse(res, true, 200, 'Prăjituri a fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturilor!', { details: error.message });
    }
});

router.get('/getCakesByCustomerid', userAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }
        const cakes = await dbInstance('cakes')
            .where('cakes.total_quantity', '>', 0)
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.total_quantity',
                'cakes.kcal',
                'cakes.created_at',
                'cakes.grams_per_piece',
                'cakes.price_per_kg',
            )
        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există prăjituri!', []);
        }
        return sendJsonResponse(res, true, 200, 'Prăjituri a fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturilor!', { details: error.message });
    }
});

router.get('/getBoughtCakesByAdminId', userAuthMiddleware, async (req, res) => {
    try {


        const userId = req.user?.id;

        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await dbInstance('cakes')
            .join('reservations', 'cakes.id', 'reservations.cake_id')
            .join('users', 'reservations.customer_id', 'users.id')
            .where('reservations.status', 'picked_up')
            .select(
                'reservations.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'reservations.quantity',
                'cakes.kcal',
                'cakes.updated_at',
                'users.name as customer_name',
                'users.phone as customer_phone',
            )
        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există cantități rămase!', []);
        }
        return sendJsonResponse(res, true, 200, 'Cantitățile rămase au fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea cantităților rămase!', { details: error.message });
    }
});

router.get('/getBoughtCakesByCustomerId', userAuthMiddleware, async (req, res) => {
    try {

        const userId = req.user?.id;

        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await dbInstance('cakes')
            .join('reservations', 'cakes.id', 'reservations.cake_id')
            .join('users', 'reservations.customer_id', 'users.id')
            .where('reservations.customer_id', userId)
            .where('reservations.status', 'picked_up')
            .select(
                'reservations.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'reservations.quantity',
                'cakes.kcal',
                'reservations.updated_at',
                'users.name as customer_name',
            )
        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există rezervări!', []);
        }
        return sendJsonResponse(res, true, 200, 'Rezervările au fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea rezervărilor!', { details: error.message });
    }
});

router.get('/getRemainingCakes', userAuthMiddleware, async (req, res) => {
    try {

        const userId = req.user.id;

        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await dbInstance('cakes')
            .where('cakes.total_quantity', '>', 0)
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.total_quantity',
                'cakes.grams_per_piece',
                'cakes.price_per_kg',
            )


        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există prăjituri!', []);
        }
        return sendJsonResponse(res, true, 200, 'Prăjiturile au fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturilor!', { details: error.message });
    }
});

router.put('/increaseQuantity/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { quantity } = req.body;
        const userId = req.user.id;

        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cake = await dbInstance('cakes').where({ id: cakeId }).first();

        if (!cake) return sendJsonResponse(res, false, 404, 'Prăjitura nu există!', []);


        // 1. Verifică dacă există suficient stoc pentru toate ingredientele
        const cake_ingredients = await dbInstance('cake_ingredients').where({ cake_id: cakeId });
        for (const ci of cake_ingredients) {
            const ingredient = await dbInstance('ingredients').where({ id: ci.ingredient_id }).first();
            if (Number(ingredient.stock_quantity) < Number(ci.quantity) * Number(quantity)) {
                return sendJsonResponse(res, false, 400, 'Nu există suficientă cantitate in stoc!', []);
            }
        }

        // 2. Dacă există, actualizează stocul pentru fiecare ingredient
        for (const ci of cake_ingredients) {
            const ingredient = await dbInstance('ingredients').where({ id: ci.ingredient_id }).first();
            const amountToUpdate = Number(quantity) > 0 ? Number(ci.quantity) * Number(quantity) : 0;
            const stock = Number(ingredient.stock_quantity) - amountToUpdate;
            await dbInstance('ingredients')
                .where({ id: ci.ingredient_id })
                .update('stock_quantity', stock);
        }

        const totalQuantity = Number(cake.total_quantity) + Number(quantity);

        const updated = await dbInstance('cakes').where({ id: cakeId }).update({ total_quantity: totalQuantity });


        if (!updated) return sendJsonResponse(res, false, 404, 'Cantitatea nu a fost mărită!', []);

        return sendJsonResponse(res, true, 200, 'Cantitatea a fost mărită cu succes!', []);

    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la creșterea cantității!', { details: error.message });
    }
});

// Upload photo to Vercel Blob (optional alternative)
router.post('/uploadPhotoToBlob', userAuthMiddleware, async (req, res) => {
    try {
        if (!req.files || !req.files['photo']) {
            return sendJsonResponse(res, false, 400, "No photo file provided", null);
        }

        const file = req.files['photo'][0];
        const filename = `cakes/${Date.now()}_${file.originalname}`;

        // Upload to Vercel Blob
        const { put } = await import('@vercel/blob');
        const blob = await put(filename, file.buffer, {
            access: 'public',
        });

        return sendJsonResponse(res, true, 200, "Photo uploaded to Vercel Blob successfully", {
            url: blob.url,
            filename: filename
        });
    } catch (error) {
        console.error('❌ Vercel Blob upload error:', error);
        return sendJsonResponse(res, false, 500, "Vercel Blob upload failed", { details: error.message });
    }
});

// Add cake with Vercel Blob storage (alternative endpoint)
router.post('/addCakeWithBlob', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {
    try {
        console.log('🔍 addCakeWithBlob - Request received');
        console.log('🔍 addCakeWithBlob - Request body:', req.body);
        console.log('🔍 addCakeWithBlob - Request files:', req.files);
        console.log('🔍 addCakeWithBlob - User ID:', req.user?.id);

        const { name, price, description, kcal, grams_per_piece } = req.body;
        const userId = req.user?.id;

        console.log('🔍 addCakeWithBlob - Checking files...');
        if (!req.files || !req.files['photo']) {
            console.log('❌ addCakeWithBlob - No photo file found');
            return sendJsonResponse(res, false, 400, "Image is required", null);
        }

        console.log('🔍 addCakeWithBlob - Photo file found:', req.files['photo']);
        const file = req.files['photo'][0];
        const filename = `cakes/${Date.now()}_${file.originalname}`;

        // Upload to Vercel Blob
        console.log('🔍 addCakeWithBlob - Uploading to Vercel Blob...');
        const { put } = await import('@vercel/blob');
        const blob = await put(filename, file.buffer, {
            access: 'public',
        });

        console.log('🔍 addCakeWithBlob - Blob URL:', blob.url);

        console.log('🔍 addCakeWithBlob - Getting database instance...');
        const dbInstance = await db();
        console.log('🔍 addCakeWithBlob - Database instance obtained');

        console.log('🔍 addCakeWithBlob - Checking user rights...');
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        console.log('🔍 addCakeWithBlob - User rights result:', userRights);
        if (!userRights) {
            console.log('❌ addCakeWithBlob - User not authorized');
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        console.log('🔍 addCakeWithBlob - Validating required fields...');
        console.log('🔍 addCakeWithBlob - Fields:', { name, price, description, kcal, grams_per_piece });
        if (!name || !price || !description || !kcal || !grams_per_piece) {
            console.log('❌ addCakeWithBlob - Missing required fields');
            return sendJsonResponse(res, false, 400, "Numele, prețul, descrierea, kcal-ul și cantitatea sunt obligatorii!", []);
        }

        console.log('🔍 addCakeWithBlob - Checking for existing cake...');
        const existingCake = await dbInstance('cakes').where({ name }).first();
        if (existingCake) {
            console.log('❌ addCakeWithBlob - Cake already exists');
            return sendJsonResponse(res, false, 400, "Prăjitura există deja!", []);
        }

        console.log('🔍 addCakeWithBlob - Converting data types...');
        const priceNum = parseFloat(price);
        const kcalNum = parseFloat(kcal);
        const gramsPerPieceNum = parseInt(grams_per_piece);

        console.log('🔍 addCakeWithBlob - Converted values:', { priceNum, kcalNum, gramsPerPieceNum });

        // Validate converted values
        if (isNaN(priceNum) || isNaN(kcalNum) || isNaN(gramsPerPieceNum)) {
            console.log('❌ addCakeWithBlob - Invalid numeric values');
            return sendJsonResponse(res, false, 400, "Valorile numerice nu sunt valide!", []);
        }

        console.log('🔍 addCakeWithBlob - Converting price per kg...');
        const price_per_kg = (priceNum * 1000) / gramsPerPieceNum;
        console.log('🔍 addCakeWithBlob - Price per kg calculated:', price_per_kg);

        console.log('🔍 addCakeWithBlob - Inserting cake into database...');
        const insertData = {
            name,
            price: priceNum,
            description,
            photo: blob.url,
            total_quantity: 0,
            kcal: kcalNum,
            admin_id: userId,
            grams_per_piece: gramsPerPieceNum,
            price_per_kg
        };
        console.log('🔍 addCakeWithBlob - Insert data:', insertData);

        console.log('🔍 addCakeWithBlob - Attempting database insert...');
        const insertResult = await dbInstance('cakes').insert(insertData);
        console.log('🔍 addCakeWithBlob - Insert result:', insertResult);

        // Handle different database return formats
        let id;
        if (Array.isArray(insertResult)) {
            id = insertResult[0];
        } else if (insertResult && insertResult.length > 0) {
            id = insertResult[0];
        } else {
            // If no ID returned, try to get the last inserted ID
            const lastInserted = await dbInstance('cakes').orderBy('id', 'desc').first();
            id = lastInserted ? lastInserted.id : null;
        }

        console.log('🔍 addCakeWithBlob - Insert completed, ID:', id);

        if (!id) {
            console.log('❌ addCakeWithBlob - No ID returned from insert');
            return sendJsonResponse(res, false, 500, "Eroare la salvarea prăjiturii - ID invalid!", []);
        }

        console.log('🔍 addCakeWithBlob - Fetching created cake...');
        const cake = await dbInstance('cakes').where({ id }).first();
        console.log('🔍 addCakeWithBlob - Cake fetched:', cake);

        console.log('✅ addCakeWithBlob - Success! Returning response...');
        return sendJsonResponse(res, true, 201, "Prăjitura a fost adăugată cu succes în Vercel Blob!", { cake });
    } catch (error) {
        console.error('❌ addCakeWithBlob - Error occurred:', error);
        console.error('❌ addCakeWithBlob - Error stack:', error.stack);
        console.error('❌ addCakeWithBlob - Error message:', error.message);
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea prăjiturii cu Vercel Blob!", { details: error.message });
    }
});

// Serve images with CORS headers
router.get('/images/:filename', (req, res) => {
    const { filename } = req.params;

    // Set CORS headers for images
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });

    // Serve the image from the uploads directory
    const imagePath = path.join(process.cwd(), 'public', 'uploads', 'cakes', filename);
    res.sendFile(imagePath, (err) => {
        if (err) {
            console.error('Error serving image:', err);
            res.status(404).json({ error: 'Image not found' });
        }
    });
});

export default router; 