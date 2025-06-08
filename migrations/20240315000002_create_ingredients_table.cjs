exports.up = function (knex) {
    return knex.schema.createTable('ingredients', (table) => {
        table.increments('id').primary();

        table.string('name').nullable();

        table.integer('stock_quantity').nullable();

        table.integer('admin_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('ingredients');
}; 