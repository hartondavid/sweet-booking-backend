exports.up = function (knex) {
    return knex.schema.createTable('reservations', (table) => {
        table.increments('id').primary();

        table.integer('quantity').nullable();

        table.string('date').nullable();

        table.enum('status', ['placed', 'cancelled', 'picked_up']).nullable();


        table.integer('cake_id').unsigned().notNullable()
            .references('id').inTable('cakes').onDelete('CASCADE');

        table.integer('customer_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('reservations');
}; 