/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('rights').del()

  // Reset the sequence to start from 1
  await knex.raw('ALTER SEQUENCE rights_id_seq RESTART WITH 1')

  await knex('rights').insert([
    { name: 'admin', right_code: 1 },
    { name: 'customer', right_code: 2 }
  ]);
};
