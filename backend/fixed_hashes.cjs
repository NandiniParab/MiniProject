// fix-hashes.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const users = [
  { email: 'rohan.malhotra@precisionauto.in', password: 'Precision@2025' },
  { email: 'priya.sharma@precisionauto.in', password: 'TaxPro@2025' },
  { email: 'vikram.singh@precisionauto.in', password: 'SalesStar@2025' }
];

async function fix() {
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = $2`,
      [hash, user.email]
    );
    console.log(`Updated: ${user.email} → ${hash}`);
  }
  console.log('All hashes fixed!');
  process.exit();
}

fix();