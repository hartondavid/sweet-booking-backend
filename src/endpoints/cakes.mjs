import { Router } from "express";
import path from "path";
import fs from "fs";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";
import createMulter from "../utils/uploadUtils.mjs";
import { uploadFile, deleteFile } from "../utils/supabaseStorage.mjs";

const upload = createMulter('uploads/cakes', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']);

const router = Router();

// Adaugă o prăjitură
router.post('/addCake', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {

    try {
        console.log('🎂 Starting addCake process...');
        console.log('📋 Request body:', req.body);
        console.log('📁 Files received:', req.files);

        const { name, price, description, kcal, grams_per_piece } = req.body;
        const userId = req.user?.id;

        console.log('👤 User ID:', userId);

        if (!req.files || !req.files['photo']) {
            console.log('❌ No photo file received');
            return sendJsonResponse(res, false, 400, "Image is required", null);
        }

        console.log('✅ Photo file received:', req.files['photo'][0]);

        // Read file buffer for Supabase upload
        const fileBuffer = fs.readFileSync(req.files['photo'][0].path);
        const fileName = req.files['photo'][0].originalname;
        console.log('📄 File name:', fileName);

        // Upload to Supabase Storage
        console.log('📤 Uploading to Supabase Storage...');
        const uploadResult = await uploadFile(fileBuffer, fileName, 'cakes', 'uploads');

        if (uploadResult.error) {
            console.error('❌ Upload failed:', uploadResult.error);
            return sendJsonResponse(res, false, 500, "Eroare la upload-ul imaginii!", { details: uploadResult.error });
        }

        console.log('✅ Upload successful, URL:', uploadResult.url);

        // Store the Supabase URL in database
        const imageUrl = uploadResult.url;

        console.log('🔍 Checking user rights...');
        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        console.log('🔐 User rights result:', userRights);

        if (!userRights) {
            console.log('❌ User not authorized');
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        console.log('✅ User authorized');

        if (!name || !price || !description || !kcal || !grams_per_piece) {
            console.log('❌ Missing required fields');
            return sendJsonResponse(res, false, 400, "Numele, prețul, descrierea, kcal-ul și cantitatea sunt obligatorii!", []);
        }

        console.log('✅ All required fields present');

        console.log('🔍 Checking if cake already exists...');
        const existingCake = await (await db())('cakes').where({ name }).first();
        if (existingCake) {
            console.log('❌ Cake already exists');
            return sendJsonResponse(res, false, 400, "Prăjitura există deja!", []);
        }

        console.log('✅ Cake name is unique');

        const price_per_kg = (price * 1000) / grams_per_piece;
        console.log('💰 Price per kg calculated:', price_per_kg);

        console.log('💾 Inserting cake into database...');
        const [newCake] = await (await db())('cakes').insert({
            name, price, description, photo: imageUrl, total_quantity: 0,
            kcal, admin_id: userId, grams_per_piece, price_per_kg
        }).returning('id');

        console.log('✅ Cake inserted, ID:', newCake.id);

        const cake = await (await db())('cakes').where({ id: newCake.id }).first();
        console.log('🎂 Final cake object:', cake);

        return sendJsonResponse(res, true, 201, "Prăjitura a fost adăugată cu succes!", { cake });
    } catch (error) {
        console.error('❌ Error in addCake:', error);
        console.error('🔍 Error stack:', error.stack);
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


        const cake = await (await db())('cakes').where({ id: cakeId }).first();

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
            console.log('📤 Uploading new photo to Supabase Storage...');

            // Read file buffer for Supabase upload
            const fileBuffer = fs.readFileSync(req.files['photo'][0].path);
            const fileName = req.files['photo'][0].originalname;

            // Upload to Supabase Storage
            const uploadResult = await uploadFile(fileBuffer, fileName, 'cakes', 'uploads');

            if (uploadResult.error) {
                console.error('❌ Upload failed:', uploadResult.error);
                return sendJsonResponse(res, false, 500, "Eroare la upload-ul imaginii!", { details: uploadResult.error });
            }

            console.log('✅ New photo uploaded successfully, URL:', uploadResult.url);
            updateData.photo = uploadResult.url;
        }

        const updated = await (await db())('cakes').where({ id: cakeId }).update(updateData);

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

        const cake = await (await db())('cakes').where({ id: cakeId }).first();
        const reservations = await (await db())('reservations').where({ cake_id: cakeId });

        if (!cake) return sendJsonResponse(res, false, 404, "Prăjitura nu există!", []);
        if (reservations.length > 0) return sendJsonResponse(res, false, 400, "Prăjitura are rezervări!", []);

        await (await db())('cakes').where({ id: cakeId }).del();

        return sendJsonResponse(res, true, 200, "Prăjitura a fost ștearsă cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea prăjiturii!", { details: error.message });
    }
});

// Obține o prăjitură după id
router.get('/getCake/:cakeId', userAuthMiddleware, async (req, res) => {
    const { cakeId } = req.params;
    try {
        const cake = await (await db())
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
        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }
        const cakes = await (await db())('cakes')
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
        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }
        const cakes = await (await db())('cakes')
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

        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await (await db())('cakes')
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

        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await (await db())('cakes')
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

        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await (await db())('cakes')
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

        const userRights = await (await db())('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cake = await (await db())('cakes').where({ id: cakeId }).first();

        if (!cake) return sendJsonResponse(res, false, 404, 'Prăjitura nu există!', []);


        // 1. Verifică dacă există suficient stoc pentru toate ingredientele
        const cake_ingredients = await (await db())('cake_ingredients').where({ cake_id: cakeId });
        for (const ci of cake_ingredients) {
            const ingredient = await (await db())('ingredients').where({ id: ci.ingredient_id }).first();
            if (Number(ingredient.stock_quantity) < Number(ci.quantity) * Number(quantity)) {
                return sendJsonResponse(res, false, 400, 'Nu există suficientă cantitate in stoc!', []);
            }
        }

        // 2. Dacă există, actualizează stocul pentru fiecare ingredient
        for (const ci of cake_ingredients) {
            const ingredient = await (await db())('ingredients').where({ id: ci.ingredient_id }).first();
            const amountToUpdate = Number(quantity) > 0 ? Number(ci.quantity) * Number(quantity) : 0;
            const stock = Number(ingredient.stock_quantity) - amountToUpdate;
            await (await db())('ingredients')
                .where({ id: ci.ingredient_id })
                .update('stock_quantity', stock);
        }

        const totalQuantity = Number(cake.total_quantity) + Number(quantity);

        const updated = await (await db())('cakes').where({ id: cakeId }).update({ total_quantity: totalQuantity });


        if (!updated) return sendJsonResponse(res, false, 404, 'Cantitatea nu a fost mărită!', []);

        return sendJsonResponse(res, true, 200, 'Cantitatea a fost mărită cu succes!', []);

    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la creșterea cantității!', { details: error.message });
    }
});

export default router; 