import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

const router = Router();

// Adaugă un ingredient 
router.post('/addCakeIngredientToCake/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { quantity, ingredient_id } = req.body;
        const userId = req.user.id;

        if (!quantity || !ingredient_id) {
            return sendJsonResponse(res, false, 400, 'Cantitatea și ingredientul sunt obligatorii!', []);
        }


        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const [id] = await db('cake_ingredients').insert({
            quantity, cake_id: cakeId, ingredient_id, admin_id: userId
        });

        const cakeIngredient = await db('cake_ingredients').where({ id }).first();
        return sendJsonResponse(res, true, 201, "Ingredientul a fost adăugat cu succes!", { cakeIngredient });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea ingredientului!", { details: error.message });
    }
});

// Actualizează un ingredient
router.put('/updateCakeIngredient/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { quantity, ingredient_id } = req.body;


        if (!quantity || !ingredient_id) {
            return sendJsonResponse(res, false, 400, 'Cantitatea și ingredientul sunt obligatorii!', []);
        }

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakeIngredient = await db('cake_ingredients')
            .where({ ingredient_id, cake_id: cakeId }).first();
        if (!cakeIngredient) return sendJsonResponse(res, false, 404, "Ingredientul nu există!", []);

        await db('cake_ingredients').where({ ingredient_id, cake_id: cakeId }).update({
            quantity: quantity || cakeIngredient.quantity,
            cake_id: cakeId || cakeIngredient.cake_id
        });

        const updated = await db('cake_ingredients').where({ ingredient_id, cake_id: cakeId }).first();
        return sendJsonResponse(res, true, 200, "Ingredientul a fost actualizat cu succes!", { cakeIngredient: updated });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la actualizarea ingredientului!", { details: error.message });
    }
});


// Șterge un ingredient
router.delete('/deleteCakeIngredient/:cakeId/:ingredientId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId, ingredientId } = req.params;

        const userId = req.user.id;

        if (!ingredientId) {
            return sendJsonResponse(res, false, 400, 'ingredientul este obligatoriu!', []);
        }


        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakeIngredient = await db('cake_ingredients').where({ ingredient_id: ingredientId, cake_id: cakeId }).first();
        if (!cakeIngredient) return sendJsonResponse(res, false, 404, "Ingredientul nu există!", []);
        await db('cake_ingredients').where({ ingredient_id: ingredientId, cake_id: cakeId }).del();
        return sendJsonResponse(res, true, 200, "Ingredientul a fost șters cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea ingredientului!", { details: error.message });
    }
});

// Obține un ingredient după id
router.get('/getCakeIngredient/:cakeIngredientId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeIngredientId } = req.params;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const cakeIngredient = await db('cake_ingredients')
            .join('cakes', 'cake_ingredients.cake_id', 'cakes.id')
            .where('cake_ingredients.id', cakeIngredientId)
            .select(
                'cake_ingredients.id',
                'cake_ingredients.ingredient',
                'cake_ingredients.quantity',
                'cake_ingredients.cake_id',
                'cakes.name',
                'ingredients.unit'
            )
            .first();
        if (!cakeIngredient) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', cakeIngredient);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});



router.get('/getCakeIngredientsByCakeId', userAuthMiddleware, async (req, res) => {

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

        const cakes = await db('cakes')
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.kcal',
                'cakes.created_at',

            )
            .groupBy('cakes.id');



        const results = await Promise.all(cakes.map(async cake => {
            // Get order items for this order
            const ingredients = await db('cake_ingredients')
                .join('ingredients', 'cake_ingredients.ingredient_id', 'ingredients.id')
                .join('cakes', 'cake_ingredients.cake_id', 'cakes.id')
                .where('cake_ingredients.cake_id', cake.id)
                .select(
                    'cake_ingredients.id',
                    'cake_ingredients.ingredient_id',
                    'cake_ingredients.quantity',
                    'ingredients.name',
                    'cakes.created_at',
                    'ingredients.unit'

                );
            return {
                ...cake,
                ingredients: ingredients
            };
        }));



        if (!results) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', results);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});

router.get('/getIngredientsByCakeId/:cakeId', userAuthMiddleware, async (req, res) => {
    try {
        const { cakeId } = req.params;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('cake_ingredients')
            .join('ingredients', 'cake_ingredients.ingredient_id', 'ingredients.id')
            .where('cake_ingredients.cake_id', cakeId)
            .select(
                'cake_ingredients.id',
                'cake_ingredients.ingredient_id',
                'cake_ingredients.quantity',
                'ingredients.name',
                'cake_ingredients.created_at',
                'cake_ingredients.unit'
            )
        if (ingredients.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există ingredientele!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientele a fost găsite!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientelor!', { details: error.message });
    }
});




export default router; 