import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

const router = Router();

// Adaugă un ingredient nou (doar admin)
router.post('/addCakeIngredientToCake/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const { cakeId } = req.params;
        const { quantity, ingredient_id, unit } = req.body;
        const userId = req.user.id;

        if (!cakeId || !quantity || !ingredient_id || !unit) {
            return sendJsonResponse(res, false, 400, 'Cantitatea, ingredientul și unitatea sunt obligatorii!', []);
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
            quantity, cake_id: cakeId, ingredient_id, admin_id: userId,
            unit
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
                'cake_ingredients.unit'
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
                    'cake_ingredients.unit'

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


// router.get('/searchCake', userAuthMiddleware, async (req, res) => {

//     try {

//         const { searchField } = req.query;

//         if (!searchField) {
//             return sendJsonResponse(res, false, 400, 'Search field is required', null);
//         }

//         const userId = req.user.id;

//         const userRights = await db('user_rights')
//             .join('rights', 'user_rights.right_id', 'rights.id')
//             .where('rights.right_code', 1)
//             .where('user_rights.user_id', userId)
//             .first();

//         if (!userRights) {
//             return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
//         }


//         // Query the database to search for employees where name contains the searchField
//         const cakes = await db('cakes')
//             .where(function () {
//                 this.where('cakes.name', 'like', `%${searchField}%`)
//                     .orWhere('cakes.description', 'like', `%${searchField}%`)
//             })
//             .select('cakes.*');


//         if (cakes.length === 0) {
//             return sendJsonResponse(res, false, 404, 'Nu există prajituri!', []);
//         }

//         // Attach the employees to the request object for the next middleware or route handler
//         return sendJsonResponse(res, true, 200, 'Prajiturile au fost găsiți!', cakes);
//     } catch (err) {
//         console.error(err);
//         return sendJsonResponse(res, false, 500, 'An error occurred while retrieving cakes', null);
//     }
// })


// router.get('/searchStockIngredient', userAuthMiddleware, async (req, res) => {

//     try {

//         const { searchField } = req.query;

//         if (!searchField) {
//             return sendJsonResponse(res, false, 400, 'Search field is required', null);
//         }

//         const userId = req.user.id;

//         const userRights = await db('user_rights')
//             .join('rights', 'user_rights.right_id', 'rights.id')
//             .where('rights.right_code', 1)
//             .where('user_rights.user_id', userId)
//             .first();

//         if (!userRights) {
//             return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
//         }


//         // Query the database to search for employees where name contains the searchField
//         const cakeIngredients = await db('ingredients')
//             .where(function () {
//                 this.where('ingredients.name', 'like', `%${searchField}%`)
//             })
//             .select('ingredients.*');


//         if (cakeIngredients.length === 0) {
//             return sendJsonResponse(res, false, 404, 'Nu există ingredientele!', []);
//         }

//         // Attach the employees to the request object for the next middleware or route handler
//         return sendJsonResponse(res, true, 200, 'Ingredientele au fost găsite!', cakeIngredients);
//     } catch (err) {
//         console.error(err);
//         return sendJsonResponse(res, false, 500, 'An error occurred while retrieving cake ingredients', null);
//     }
// })
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