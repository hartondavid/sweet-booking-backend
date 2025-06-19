import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";
import createMulter from "../utils/uploadUtils.mjs";

const upload = createMulter('public/uploads/cakes', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']);

const router = Router();

// Adaugă o prăjitură nouă (doar admin)
router.post('/addCake', userAuthMiddleware, upload.fields([{ name: 'photo' }]), async (req, res) => {

    try {

        const { name, price, description, kcal, grams_per_piece } = req.body;
        const userId = req.user?.id;

        if (!req.files || !req.files['photo']) {
            return sendJsonResponse(res, false, 400, "Image is required", null);
        }

        let filePathForImagePath = req.files['photo'][0].path; // Get the full file path
        filePathForImagePath = filePathForImagePath.replace(/^public[\\/]/, '');

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const price_per_kg = (price * 1000) / grams_per_piece;

        const [id] = await db('cakes').insert({
            name, price, description, photo: filePathForImagePath, total_quantity: 0,
            kcal, admin_id: userId, grams_per_piece, price_per_kg
        });
        await db('remaining_cakes').insert({ remaining_quantity: 0, cake_id: id });


        const cake = await db('cakes').where({ id }).first();
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

        const cake = await db('cakes').where({ id: cakeId }).first();

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


        // // 1. Obține cantitatea veche a prăjiturii
        // const oldCake = await db('cakes').where({ id: cakeId }).first();
        // const oldQuantity = oldCake.total_quantity; // presupunem că ai un câmp 'quantity'

        const updated = await db('cakes').where({ id: cakeId }).update(updateData);


        // // 2. Calculează diferența
        // const diff = total_quantity - oldQuantity;

        // console.log('diff', diff);


        // // 3. Obține ingredientele și cantitățile per prăjitură
        // const cake_ingredients = await db('cake_ingredients').where({ cake_id: cakeId });

        // for (const ci of cake_ingredients) {
        //     // 4. Calculează cât trebuie scăzut/adăugat
        //     const amountToUpdate = Number(ci.quantity) * Number(total_quantity);
        //     console.log('amountToUpdate ', amountToUpdate);

        //     const ingredient = await db('ingredients').where({ id: ci.ingredient_id }).first();

        //     const stock = Number(ingredient.stock_quantity) - amountToUpdate;

        //     // 5. Update ingredient
        //     await db('ingredients')
        //         .where({ id: ci.ingredient_id })
        //         .update('stock_quantity', stock);
        // }






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

        const cake = await db('cakes').where({ id: cakeId }).first();
        const reservations = await db('reservations').where({ cake_id: cakeId });

        if (!cake) return sendJsonResponse(res, false, 404, "Prăjitura nu există!", []);
        if (reservations.length > 0) return sendJsonResponse(res, false, 400, "Prăjitura are rezervări!", []);

        await db('cakes').where({ id: cakeId }).del();

        await db('remaining_cakes').where({ cake_id: cakeId }).del();

        return sendJsonResponse(res, true, 200, "Prăjitura a fost ștearsă cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea prăjiturii!", { details: error.message });
    }
});

// Obține o prăjitură după id
router.get('/getCake/:cakeId', userAuthMiddleware, async (req, res) => {
    const { cakeId } = req.params;
    try {
        const cake = await db('cakes')
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


        const cakes = await db('cakes')
            .join('remaining_cakes', 'cakes.id', 'remaining_cakes.cake_id')
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
                'remaining_cakes.remaining_quantity',
            )

        console.log('cakes', cakes);
        if (cakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există prăjituri!', []);
        }
        return sendJsonResponse(res, true, 200, 'Prăjituri a fost găsite!', cakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturilor!', { details: error.message });
    }
});

router.get('/getCakesByCustomerId', userAuthMiddleware, async (req, res) => {
    try {


        const cakes = await db('cakes')
            .join('users', 'cakes.admin_id', 'users.id')
            .join('user_rights', 'users.id', 'user_rights.user_id')
            .join('remaining_cakes', 'cakes.id', 'remaining_cakes.cake_id')
            .where('user_rights.right_id', 2)
            .where('users.id', req.user.id)
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
                'remaining_cakes.remaining_quantity',
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

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await db('cakes')
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

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakes = await db('cakes')
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

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const remainingCakes = await db('remaining_cakes')
            .join('cakes', 'remaining_cakes.cake_id', 'cakes.id')
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'remaining_cakes.updated_at',
                'remaining_cakes.remaining_quantity',
            )


        if (remainingCakes.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există cantități rămase!', []);
        }
        return sendJsonResponse(res, true, 200, 'Cantitățile rămase au fost găsite!', remainingCakes);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea cantităților rămase!', { details: error.message });
    }
});

router.put('/increaseQuantity/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { quantity } = req.body;
        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cake = await db('cakes').where({ id: cakeId }).first();

        if (!cake) return sendJsonResponse(res, false, 404, 'Prăjitura nu există!', []);


        // 1. Verifică dacă există suficient stoc pentru toate ingredientele
        const cake_ingredients = await db('cake_ingredients').where({ cake_id: cakeId });
        for (const ci of cake_ingredients) {
            const ingredient = await db('ingredients').where({ id: ci.ingredient_id }).first();
            if (Number(ingredient.stock_quantity) < Number(ci.quantity) * Number(quantity)) {
                return sendJsonResponse(res, false, 400, 'Nu există suficientă cantitate in stoc!', []);
            }
        }

        // 2. Dacă există, actualizează stocul pentru fiecare ingredient
        for (const ci of cake_ingredients) {
            const ingredient = await db('ingredients').where({ id: ci.ingredient_id }).first();
            const amountToUpdate = Number(ci.quantity) * Number(quantity);
            const stock = Number(ingredient.stock_quantity) - amountToUpdate;
            await db('ingredients')
                .where({ id: ci.ingredient_id })
                .update('stock_quantity', stock);
        }


        const totalQuantity = Number(cake.total_quantity) + Number(quantity);

        const updated = await db('cakes').where({ id: cakeId }).update({ total_quantity: totalQuantity });

        await db('remaining_cakes').where({ cake_id: cakeId })
            .update({ remaining_quantity: totalQuantity });

        if (!updated) return sendJsonResponse(res, false, 404, 'Cantitatea nu a fost mărită!', []);

        return sendJsonResponse(res, true, 200, 'Cantitatea a fost mărită cu succes!', []);

    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la creșterea cantității!', { details: error.message });
    }
});

export default router; 