/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('user_rights').del()

  // Reset the sequence to start from 1
  await knex.raw('ALTER SEQUENCE user_rights_id_seq RESTART WITH 1')

  // Get the actual user and right IDs from the database
  const david = await knex('users').where('email', 'david@gmail.com').first();
  const admin = await knex('users').where('email', 'admin@gmail.com').first();
  const customerRight = await knex('rights').where('right_code', 2).first();
  const adminRight = await knex('rights').where('right_code', 1).first();

  await knex('user_rights').insert([
    { user_id: david.id, right_id: customerRight.id },
    { user_id: admin.id, right_id: adminRight.id },
  ]);
};
