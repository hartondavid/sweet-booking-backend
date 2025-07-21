import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";
import createMulter from "../utils/uploadUtils.mjs";

const upload = createMulter('public/uploads/cakes', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']);

const router = Router();

// Adaugă o prăjitură
router.post('/addCake', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {

    try {

        const { name, price, description, kcal, grams_per_piece } = req.body;
        const userId = req.user?.id;


        if (!req.files || !req.files['photo']) {
            return sendJsonResponse(res, false, 400, "Image is required", null);
        }

        let filePathForImagePath = req.files['photo'][0].path; // Get the full file path
        filePathForImagePath = filePathForImagePath.replace(/^public[\\/]/, '');

        const dbInstance = await db();
        const userRights = await dbInstance('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        if (!name || !price || !description || !kcal || !grams_per_piece) {
            return sendJsonResponse(res, false, 400, "Numele, prețul, descrierea, kcal-ul și cantitatea sunt obligatorii!", []);
        }

        const existingCake = await dbInstance('cakes').where({ name }).first();
        if (existingCake) {
            return sendJsonResponse(res, false, 400, "Prăjitura există deja!", []);
        }


        const price_per_kg = (price * 1000) / grams_per_piece;

        const [id] = await dbInstance('cakes').insert({
            name, price, description, photo: filePathForImagePath, total_quantity: 0,
            kcal, admin_id: userId, grams_per_piece, price_per_kg
        });



        const cake = await dbInstance('cakes').where({ id }).first();
        return sendJsonResponse(res, true, 201, "Prăjitura a fost adăugată cu succes!", { cake });
    } catch (error) {
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
            let filePathForImagePath = req.files['photo'][0].path;
            filePathForImagePath = filePathForImagePath.replace(/^public[\\/]/, '');
            updateData.photo = filePathForImagePath;
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

export default router; 