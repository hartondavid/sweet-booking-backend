exports.up = function (knex) {
    return knex.schema.createTable('remaining_cakes', (table) => {
        table.increments('id').primary();

        table.string('date').nullable();

        table.integer('remaining_quantity').nullable();


        table.integer('cake_id').unsigned().notNullable()
            .references('id').inTable('cakes').onDelete('CASCADE');

        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('remaining_cakes');
};
