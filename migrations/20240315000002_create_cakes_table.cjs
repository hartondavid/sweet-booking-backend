exports.up = function (knex) {
    return knex.schema.createTable('cakes', (table) => {
        table.increments('id').primary();

        table.string('name').nullable();

        table.string('description').nullable();

        table.integer('total_quantity').nullable();

        table.float('price', 8, 2).nullable();

        table.string('photo').nullable();

        table.enum('status', ['available', 'unavailable']).nullable();

        table.float('kcal', 8, 2).nullable();

        table.integer('grams_per_piece').nullable();

        table.float('price_per_kg', 8, 2).nullable();

        table.integer('admin_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');


        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('cakes');
}; 