exports.up = function (knex) {
    return knex.schema.createTable('cake_ingredients', (table) => {
        table.increments('id').primary();

        table.integer('quantity').nullable();

        table.integer('cake_id').unsigned().notNullable()
            .references('id').inTable('cakes').onDelete('CASCADE');

        table.integer('admin_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.integer('ingredient_id').unsigned().notNullable()
            .references('id').inTable('ingredients').onDelete('CASCADE');

        table.string('unit').nullable();

        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('cake_ingredients');
};