import { db } from '../services/db.js';

async function listUsers() {
  try {
    const users = await db.many('SELECT id, username, created_at FROM users');
    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Created: ${user.created_at}`);
    });
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

listUsers(); 