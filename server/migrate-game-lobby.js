const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'chat.db');
const db = new Database(dbPath);

console.log('🔄 Migrating game lobby from special room to bot system...\n');

try {
  // Step 1: Delete old game-lobby room
  const oldRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get('game-lobby');
  if (oldRoom) {
    console.log('🗑️  Deleting old game-lobby room...');
    db.prepare('DELETE FROM room_members WHERE room_id = ?').run('game-lobby');
    db.prepare('DELETE FROM messages WHERE room_id = ?').run('game-lobby');
    db.prepare('DELETE FROM rooms WHERE id = ?').run('game-lobby');
    console.log('✅ Old game-lobby room deleted');
  } else {
    console.log('ℹ️  No old game-lobby room found, skipping deletion');
  }

  // Step 2: Game progress data is already user-based, no migration needed
  console.log('✅ Game progress data preserved (user-based, not room-based)');

  console.log('\n✅ Migration completed successfully!');
  console.log('📌 Next steps:');
  console.log('   1. Start server: node server/index.js');
  console.log('   2. Register game-bot user if not exists');
  console.log('   3. Start game bot: node bots/game-bot/index.js');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
