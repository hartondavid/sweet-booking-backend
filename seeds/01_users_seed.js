/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('users').del()

  // Reset the sequence to start from 1
  await knex.raw('ALTER SEQUENCE users_id_seq RESTART WITH 1')

  await knex('users').insert([
    { name: 'David', email: 'david@gmail.com', password: 'e302c093809151cc23e32ac93e775765', confirm_password: 'e302c093809151cc23e32ac93e775765', phone: '07254345' },
    { name: 'Admin', email: 'admin@gmail.com', password: 'f6fdffe48c908deb0f4c3bd36c032e72', confirm_password: 'f6fdffe48c908deb0f4c3bd36c032e72', phone: '0745123457' },
  ]);
};
